import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  anthropic,
  MODELS,
  systemWithCache,
  contextBlock,
} from "@/lib/anthropic";
import { embedOne } from "@/lib/embeddings";
import { INTERVIEW_SYSTEM, ASK_QUESTION_TOOL } from "@/lib/prompts/interview";
import { DOC_TYPE_LABELS, type AnswerableStep, type Answers } from "./machine";

export type KbMatch = {
  sourceId: string;
  title: string | null;
  ord: number;
  text: string;
  sim: number;
};

export type QuestionResult = {
  aiMessage: string;
  quickReplies: string[];
  insight?: string;
  matches?: KbMatch[];
};

const ToolSchema = z.object({
  aiMessage: z.string().min(1).max(300),
  quickReplies: z.array(z.string().min(1).max(40)).min(2).max(4),
  insight: z.string().max(500).optional(),
});

export async function kbMatchByVector(
  workspaceId: string,
  qVec: number[],
  k = 3,
): Promise<KbMatch[]> {
  const literal = `[${qVec.join(",")}]`;
  const rows = await db.execute<{
    source_id: string;
    title: string | null;
    ord: number;
    text: string;
    sim: number;
  }>(sql`
    SELECT s.id AS source_id, s.title, c.ord, c.text,
           1 - (c.embedding <=> ${literal}::vector) AS sim
    FROM source_chunks c
    JOIN sources s ON s.id = c.source_id
    WHERE s.workspace_id = ${workspaceId} AND s.status = 'ready'
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${k}
  `);
  return rows.map((r) => ({
    sourceId: r.source_id,
    title: r.title,
    ord: r.ord,
    text: r.text,
    sim: r.sim,
  }));
}

export async function kbMatch(
  workspaceId: string,
  query: string,
  k = 3,
): Promise<KbMatch[]> {
  const trimmed = query.trim().slice(0, 400) || "penta security";
  const qVec = await embedOne(trimmed, "query");
  return kbMatchByVector(workspaceId, qVec, k);
}

const STEPS_NEEDING_FRESH_KB = new Set(["sources"]);

function shouldFetchKb(
  step: AnswerableStep,
  hasAnswers: boolean,
  forceMatch: boolean,
): boolean {
  if (forceMatch) return true;
  if (!hasAnswers) return true;
  return STEPS_NEEDING_FRESH_KB.has(step);
}

export async function generateQuestion(input: {
  workspaceId: string;
  documentType: string;
  step: AnswerableStep;
  answers: Answers;
  forceKbMatch?: boolean;
}): Promise<QuestionResult> {
  const queryParts = [
    DOC_TYPE_LABELS[input.documentType] ?? input.documentType,
    input.answers.reader,
    input.answers.cta,
    input.answers.objection,
  ]
    .filter(Boolean)
    .join(" ");

  const hasAnswers = Object.keys(input.answers).length > 0;
  const fetchKb = shouldFetchKb(input.step, hasAnswers, !!input.forceKbMatch);
  const matches: KbMatch[] | undefined = fetchKb
    ? await kbMatch(input.workspaceId, queryParts, 3)
    : undefined;

  const docTypeLabel =
    DOC_TYPE_LABELS[input.documentType] ?? input.documentType;

  const userBlocks: Array<
    { type: "text"; text: string } | { type: "text"; text: string; cache_control: { type: "ephemeral" } }
  > = [
    {
      type: "text",
      text: `<documentType>${docTypeLabel}</documentType>\n<currentStep>${input.step}</currentStep>\n<previousAnswers>${formatAnswers(input.answers)}</previousAnswers>`,
    },
  ];
  if (matches && matches.length > 0) {
    const kbText = matches
      .map(
        (m) =>
          `- ${m.title ?? "(제목 없음)"} (sim ${m.sim.toFixed(2)}): ${m.text.slice(0, 240).replace(/\s+/g, " ")}`,
      )
      .join("\n");
    userBlocks.push(contextBlock("kbContext", kbText));
  }

  const res = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 600,
    system: systemWithCache([INTERVIEW_SYSTEM]),
    tools: [ASK_QUESTION_TOOL],
    tool_choice: { type: "tool", name: "ask_question" },
    messages: [{ role: "user", content: userBlocks }],
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }
  const parsed = ToolSchema.parse(toolUse.input);
  return { ...parsed, matches };
}

function formatAnswers(a: Answers): string {
  const entries = Object.entries(a);
  if (entries.length === 0) return "(없음)";
  return "\n" + entries.map(([k, v]) => `  ${k}: ${v}`).join("\n");
}
