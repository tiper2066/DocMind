import pLimit from "p-limit";
import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { documentSources } from "@/db/schema";
import {
  anthropic,
  MODELS,
  systemWithCache,
  contextBlock,
} from "@/lib/anthropic";
import { embed } from "@/lib/embeddings";
import { kbMatchByVector, type KbMatch } from "@/lib/interview/service";
import {
  OUTLINE_SYSTEM,
  PROPOSE_OUTLINE_TOOL,
  type OutlineToolInput,
} from "@/lib/prompts/outline";
import { SLIDE_FILL_SYSTEM, fillSlideTool } from "@/lib/prompts/slide-fill";
import {
  DeckSchema,
  SlideSchema,
  SLIDE_KINDS,
  type Deck,
  type DeckMeta,
  type Slide,
  type SlideKind,
} from "./types";
import { DOC_TYPE_LABELS } from "@/lib/interview/machine";

const FILL_CONCURRENCY = 4;
const MAX_FILL_RETRIES = 2;

export type GenerateInput = {
  workspaceId: string;
  documentId: string;
  documentType: string;
  documentTitle: string;
  answers: {
    reader: string;
    cta: string;
    objection: string;
    keyMessage: string;
    length: string;
  };
  lengthPages: number;
  securityLevel: 1 | 2 | 3 | 4 | 5;
  author?: string;
  // 사용자가 상세 페이지에서 제목을 직접 정했을 때. 표지·meta 를 LLM 제목 대신 이 값으로 고정.
  forcedTitle?: string;
};

export async function generateDeck(input: GenerateInput): Promise<Deck> {
  const docTypeLabel =
    DOC_TYPE_LABELS[input.documentType] ?? input.documentType;

  const headlineQuery = [
    docTypeLabel,
    input.answers.reader,
    input.answers.cta,
    input.answers.objection,
    input.answers.keyMessage,
  ]
    .filter(Boolean)
    .join(" ");

  const [headlineVec] = await embed([headlineQuery || docTypeLabel], "query");
  const headlineMatches = await kbMatchByVector(
    input.workspaceId,
    headlineVec,
    5,
  );

  const outline = await proposeOutline({
    docTypeLabel,
    answers: input.answers,
    lengthPages: input.lengthPages,
    kbHeadline: headlineMatches
      .map(
        (m) =>
          `- ${m.title ?? "(제목 없음)"}: ${m.text.slice(0, 200).replace(/\s+/g, " ")}`,
      )
      .join("\n"),
  });

  const sectionsLeft: number[] = [];
  outline.kinds.forEach((k, i) => {
    if (k === "section") sectionsLeft.push(i);
  });

  const slideQueries = outline.kinds.map(
    (kind) =>
      `${docTypeLabel} ${kind} ${input.answers.reader} ${input.answers.cta}`.slice(
        0,
        400,
      ),
  );
  const slideVectors = await embed(slideQueries, "query");
  const slideMatches: KbMatch[][] = await Promise.all(
    slideVectors.map((v) => kbMatchByVector(input.workspaceId, v, 3)),
  );

  const limit = pLimit(FILL_CONCURRENCY);
  const slides = await Promise.all(
    outline.kinds.map((kind, idx) =>
      limit(async () => {
        const sectionIndex =
          kind === "section"
            ? sectionsLeft.indexOf(idx) + 1
            : undefined;
        return await fillSlideWithRetry({
          input,
          docTypeLabel,
          kind,
          slideIndex: idx,
          totalSlides: outline.kinds.length,
          outline: outline.kinds,
          sectionIndex,
          matches: slideMatches[idx],
        });
      }),
    ),
  );

  let alignedSlides = alignAgendaAndSections(slides);

  // 사용자가 직접 정한 제목(forcedTitle)이 있으면 표지 텍스트를 그 값으로 덮어쓴다.
  const forced = input.forcedTitle?.trim();
  if (forced && alignedSlides[0]?.kind === "cover") {
    alignedSlides = alignedSlides.map((s, i) =>
      i === 0 && s.kind === "cover" ? { ...s, title: forced } : s,
    );
  }

  // 표지(첫 슬라이드) 제목을 deck 의 대표 제목으로 통일 — 미리보기 헤더·PPT 메타·
  // 문서함 카드가 모두 같은 제목을 쓰도록. 표지가 없으면 forcedTitle→입력 제목 순.
  const coverSlide = alignedSlides[0];
  const deckTitle =
    coverSlide?.kind === "cover"
      ? coverSlide.title
      : (forced ?? input.documentTitle);

  const meta: DeckMeta = {
    title: deckTitle,
    reader: input.answers.reader,
    cta: input.answers.cta,
    objection: input.answers.objection,
    lengthPages: input.lengthPages,
    securityLevel: input.securityLevel,
    author: input.author,
    date: new Date().toISOString().slice(0, 10),
  };

  const sourceRefMap = new Map<string, Set<number>>();
  for (const s of alignedSlides) {
    for (const r of s.sourceRefs ?? []) {
      const set = sourceRefMap.get(r.sourceId) ?? new Set();
      for (const o of r.chunkOrds) set.add(o);
      sourceRefMap.set(r.sourceId, set);
    }
  }
  const sourceRefs = [...sourceRefMap.entries()].map(([sourceId, ords]) => ({
    sourceId,
    chunkOrds: [...ords].sort((a, b) => a - b),
  }));

  return DeckSchema.parse({ meta, slides: alignedSlides, sourceRefs });
}

// deck.sourceRefs → document_sources 정규화. 에이전트 reason 단계가 "이 문서가
// 어떤 소스를 참조하는가" 를 이 테이블로 조회하므로 생성 시점에 반드시 채운다.
export async function normalizeDocumentSources(
  documentId: string,
  deck: Deck,
): Promise<void> {
  const counts = new Map<string, number>();
  for (const ref of deck.sourceRefs ?? []) {
    counts.set(ref.sourceId, (counts.get(ref.sourceId) ?? 0) + 1);
  }
  if (counts.size === 0) return;

  const values = [...counts.entries()].map(([sourceId, n]) => ({
    documentId,
    sourceId,
    importance: n,
  }));

  await db
    .insert(documentSources)
    .values(values)
    .onConflictDoUpdate({
      target: [documentSources.documentId, documentSources.sourceId],
      set: { importance: sql`excluded.importance` },
    });
}

const NUMBER_PREFIX_RE =
  /^\s*(?:\d{1,2}|[IVXLCDM]+|[①-⑩])[.)\]\s]+\s*/u;

function stripNumberPrefix(s: string): string {
  return s.replace(NUMBER_PREFIX_RE, "").trim();
}

function alignAgendaAndSections(slides: Slide[]): Slide[] {
  const cleaned = slides.map((s): Slide => {
    if (s.kind === "section") {
      return { ...s, title: stripNumberPrefix(s.title) };
    }
    return s;
  });

  const sectionTitles = cleaned
    .filter((s): s is Extract<Slide, { kind: "section" }> => s.kind === "section")
    .map((s) => s.title);

  return cleaned.map((s): Slide => {
    if (s.kind !== "agenda") return s;
    const fromSections =
      sectionTitles.length >= 2 ? sectionTitles.slice(0, 7) : null;
    const items = (fromSections ?? s.items).map(stripNumberPrefix);
    return { ...s, items };
  });
}

async function proposeOutline(args: {
  docTypeLabel: string;
  answers: GenerateInput["answers"];
  lengthPages: number;
  kbHeadline: string;
}): Promise<OutlineToolInput> {
  const res = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 600,
    system: systemWithCache([OUTLINE_SYSTEM]),
    tools: [PROPOSE_OUTLINE_TOOL],
    tool_choice: { type: "tool", name: "propose_outline" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `<documentType>${args.docTypeLabel}</documentType>\n<lengthPages>${args.lengthPages}</lengthPages>\n<answers>\n  reader: ${args.answers.reader}\n  cta: ${args.answers.cta}\n  objection: ${args.answers.objection}\n  keyMessage: ${args.answers.keyMessage}\n  length: ${args.answers.length}\n</answers>`,
          },
          ...(args.kbHeadline
            ? [contextBlock("kbContext", args.kbHeadline)]
            : []),
          {
            type: "text",
            text: `${args.lengthPages}장짜리 deck 의 슬라이드 종류 시퀀스를 propose_outline 으로 반환하라.`,
          },
        ],
      },
    ],
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("outline tool_use missing");
  }
  const input = toolUse.input as OutlineToolInput;
  if (!Array.isArray(input.kinds) || input.kinds.length === 0) {
    throw new Error("outline returned empty kinds");
  }
  let kinds = input.kinds.filter((k): k is SlideKind =>
    (SLIDE_KINDS as readonly string[]).includes(k),
  );
  if (kinds.length === 0) throw new Error("outline returned no valid kinds");
  if (kinds[0] !== "cover") kinds = ["cover", ...kinds];
  if (kinds[kinds.length - 1] !== "cta") kinds = [...kinds, "cta"];
  if (kinds.length > args.lengthPages) kinds = kinds.slice(0, args.lengthPages);
  while (kinds.length < args.lengthPages) {
    kinds.splice(kinds.length - 1, 0, "bullets");
  }
  return { kinds };
}

type FillArgs = {
  input: GenerateInput;
  docTypeLabel: string;
  kind: SlideKind;
  slideIndex: number;
  totalSlides: number;
  outline: SlideKind[];
  sectionIndex?: number;
  matches: KbMatch[];
};

async function fillSlideWithRetry(args: FillArgs): Promise<Slide> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= MAX_FILL_RETRIES; attempt++) {
    try {
      const raw = await fillSlideOnce(args);
      return SlideSchema.parse({ ...raw, kind: args.kind });
    } catch (e) {
      lastErr = e;
    }
  }
  return fallbackSlide(args.kind, args.slideIndex, args.docTypeLabel, lastErr);
}

async function fillSlideOnce(args: FillArgs): Promise<Record<string, unknown>> {
  const kbText = args.matches
    .map(
      (m) =>
        `[sourceId=${m.sourceId} ord=${m.ord}] ${m.title ?? "(제목 없음)"}: ${m.text.slice(0, 360).replace(/\s+/g, " ")}`,
    )
    .join("\n");

  const tool = fillSlideTool(args.kind);
  const res = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 1200,
    system: systemWithCache([SLIDE_FILL_SYSTEM]),
    tools: [tool],
    tool_choice: { type: "tool", name: "fill_slide" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `<documentType>${args.docTypeLabel}</documentType>\n<documentTitle>${args.input.documentTitle}</documentTitle>\n<slideIndex>${args.slideIndex + 1}/${args.totalSlides}</slideIndex>\n<kind>${args.kind}</kind>${args.sectionIndex ? `\n<sectionIndex>${args.sectionIndex}</sectionIndex>` : ""}\n<outline>${args.outline.join(", ")}</outline>\n<answers>\n  reader: ${args.input.answers.reader}\n  cta: ${args.input.answers.cta}\n  objection: ${args.input.answers.objection}\n  keyMessage: ${args.input.answers.keyMessage}\n  length: ${args.input.answers.length}\n</answers>`,
          },
          ...(kbText ? [contextBlock("kbContext", kbText)] : []),
          {
            type: "text",
            text: `위 정보로 ${args.kind} 슬라이드 한 장을 fill_slide 도구로 채워라.`,
          },
        ],
      },
    ],
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("fill_slide tool_use missing");
  }
  return toolUse.input as Record<string, unknown>;
}

function fallbackSlide(
  kind: SlideKind,
  index: number,
  docTypeLabel: string,
  err: unknown,
): Slide {
  const errMsg = err instanceof Error ? err.message : String(err);
  console.error(`[generate] slide ${index} (${kind}) fallback:`, errMsg);
  switch (kind) {
    case "cover":
      return {
        kind: "cover",
        title: docTypeLabel,
        subtitle: "",
        date: new Date().toISOString().slice(0, 10),
      };
    case "agenda":
      return { kind: "agenda", items: ["배경", "현황", "제안", "기대 효과", "다음 단계"] };
    case "section":
      return { kind: "section", index: index + 1, title: "섹션" };
    case "twoCol":
      return {
        kind: "twoCol",
        title: "비교",
        left: { label: "AS-IS", body: "현재 상태" },
        right: { label: "TO-BE", body: "제안 상태" },
      };
    case "metric":
      return {
        kind: "metric",
        title: "핵심 지표",
        metrics: [
          { label: "지표 1", value: "—" },
          { label: "지표 2", value: "—" },
          { label: "지표 3", value: "—" },
        ],
      };
    case "quote":
      return { kind: "quote", text: "—", attribution: "—" };
    case "image":
      return { kind: "image", imageRef: "diagram" };
    case "cta":
      return {
        kind: "cta",
        headline: "다음 단계로 진행해 주세요",
        action: "담당자와 일정 협의",
      };
    case "bullets":
    default:
      return {
        kind: "bullets",
        title: "본문",
        bullets: [
          { text: "핵심 요지", level: 0 },
          { text: "근거", level: 0 },
        ],
      };
  }
}
