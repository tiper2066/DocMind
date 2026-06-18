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
import { UI_ONLY } from "@/lib/demo-mode";
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

// keyMessage 로 교체되며 "소스 고르기" 단계가 사라져, 특정 step 에서 KB 를 다시
// 끌어올 필요가 없어졌다(초기 SSR·forceMatch 시에만 매칭, 이후는 store 유지).
const STEPS_NEEDING_FRESH_KB = new Set<string>([]);

function shouldFetchKb(
  step: AnswerableStep,
  hasAnswers: boolean,
  forceMatch: boolean,
): boolean {
  if (forceMatch) return true;
  if (!hasAnswers) return true;
  return STEPS_NEEDING_FRESH_KB.has(step);
}

// UI-only 데모 모드용 고정 질문/빠른답변. AI 호출 없이 인터뷰 흐름을 그대로
// 둘러볼 수 있게 한다(데모 시나리오: 독자=임원·CTA=계약·반론=가격·핵심메시지).
const CANNED_QUESTIONS: Record<AnswerableStep, QuestionResult> = {
  reader: {
    aiMessage: "이 자료를 가장 먼저 읽을 사람은 누구인가요?",
    quickReplies: ["임원·결정권자", "실무 담당자", "기술 검토팀", "고객사"],
  },
  cta: {
    aiMessage: "자료를 읽은 뒤 그분이 어떤 행동을 하길 바라나요?",
    quickReplies: ["계약 체결", "도입 검토 승인", "예산 배정", "미팅 일정 확정"],
  },
  objection: {
    aiMessage: "그분이 가장 먼저 떠올릴 반론이나 우려는 무엇일까요?",
    quickReplies: ["가격이 부담된다", "도입 기간이 길다", "기존 시스템과 호환", "효과가 불확실"],
  },
  keyMessage: {
    aiMessage: "이 자료가 전달할 단 하나의 핵심 메시지를 한 줄로 정해주세요.",
    quickReplies: [
      "WAPPLES로 웹 위협 선제 차단",
      "검증된 기술로 안전하게",
      "도입 즉시 효과 입증",
      "최고의 비용 대비 효과",
    ],
  },
  length: {
    aiMessage: "분량과 보안 레벨을 선택해주세요.",
    quickReplies: ["10 ~ 12장", "8 ~ 9장", "13 ~ 15장", "16장 이상"],
  },
};

export async function generateQuestion(input: {
  workspaceId: string;
  documentType: string;
  step: AnswerableStep;
  answers: Answers;
  forceKbMatch?: boolean;
}): Promise<QuestionResult> {
  // UI-only 데모: AI(질문 생성)·Voyage(KB 매칭) 호출 없이 고정 질문 반환.
  if (UI_ONLY) {
    return CANNED_QUESTIONS[input.step];
  }

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
