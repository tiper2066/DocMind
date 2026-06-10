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
  PLAN_SYSTEM,
  PROPOSE_PLAN_TOOL,
  PLAN_KINDS,
  AGENDA_MAX,
  type PlanToolInput,
  type PlanSection,
} from "@/lib/prompts/outline";
import { SLIDE_FILL_SYSTEM, fillSlideTool } from "@/lib/prompts/slide-fill";
import {
  DeckSchema,
  SlideSchema,
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

  // Plan A — 본문 주제 리스트를 먼저 계획. 그 리스트가 곧 agenda 항목이자
  // 각 본문 슬라이드의 제목이 된다(개수·제목이 구조적으로 일치).
  // 풀버전(16장+)일 때만 주제들을 묶는 section 디바이더를 추가한다.
  const includeAgenda = input.lengthPages >= 6;
  const fullVersion = input.lengthPages >= 16;
  const fixed = 1 /*cover*/ + (includeAgenda ? 1 : 0) + 1 /*cta*/;
  const bodyBudget = Math.max(1, input.lengthPages - fixed); // 주제 + (선택)quote + (풀버전)section 디바이더

  const plan = await proposePlan({
    docTypeLabel,
    answers: input.answers,
    sectionCount: Math.min(bodyBudget, includeAgenda ? AGENDA_MAX : bodyBudget),
    fullVersion,
    kbHeadline: headlineMatches
      .map(
        (m) =>
          `- ${m.title ?? "(제목 없음)"}: ${m.text.slice(0, 200).replace(/\s+/g, " ")}`,
      )
      .join("\n"),
  });

  // quote 는 흐름에만 넣고 목차엔 안 올린다. 주제 슬라이드 수 = agenda 항목 수.
  const wantQuote = !!plan.includeQuote && bodyBudget >= 3;

  // 풀버전: 대단원(section) 디바이더 제목 확정(2~4개, 토픽·quote 예산 확보).
  let sectionTitles: string[] = [];
  if (fullVersion) {
    const provided = (plan.sectionTitles ?? [])
      .map((s) => stripNumberPrefix(s).slice(0, 60))
      .filter(Boolean);
    const candidates = provided.length >= 2 ? provided : DEFAULT_SECTION_TITLES;
    const maxG = Math.max(0, bodyBudget - (wantQuote ? 1 : 0) - 1);
    const g = Math.min(4, Math.max(2, Math.min(candidates.length, maxG)));
    sectionTitles = candidates.slice(0, g);
  }
  const groupCount = sectionTitles.length;

  // 주제(토픽) 수 = agenda 항목 수. section 디바이더·quote 예산을 뺀 뒤 AGENDA_MAX 로 캡.
  const cap = includeAgenda ? AGENDA_MAX : bodyBudget;
  const targetSections = Math.min(
    Math.max(bodyBudget - groupCount - (wantQuote ? 1 : 0), Math.max(groupCount, 1)),
    cap,
  );
  const sections = normalizeSections(
    plan.sections,
    targetSections,
    docTypeLabel,
  );

  // 채워야 할 LLM 슬라이드 명세(agenda·section 디바이더는 제외 — 코드가 직접 조립).
  type FillSpec = {
    kind: SlideKind;
    query: string;
    forcedSlideTitle?: string;
  };
  const specs: FillSpec[] = [];
  specs.push({ kind: "cover", query: headlineQuery || docTypeLabel });
  for (const s of sections) {
    specs.push({ kind: s.kind, query: s.title, forcedSlideTitle: s.title });
  }
  if (wantQuote) {
    specs.push({
      kind: "quote",
      query: `${input.answers.keyMessage} ${input.answers.reader} 고객 인용`,
    });
  }
  specs.push({
    kind: "cta",
    query: `${input.answers.cta} ${input.answers.keyMessage}`,
  });

  const specVectors = await embed(
    specs.map((s) => s.query.slice(0, 400)),
    "query",
  );
  const specMatches: KbMatch[][] = await Promise.all(
    specVectors.map((v) => kbMatchByVector(input.workspaceId, v, 3)),
  );

  const topics = sections.map((s) => s.title);
  const totalSlides =
    specs.length + (includeAgenda ? 1 : 0) + groupCount;
  const limit = pLimit(FILL_CONCURRENCY);
  const filled = await Promise.all(
    specs.map((spec, idx) =>
      limit(async () =>
        fillSlideWithRetry({
          input,
          docTypeLabel,
          kind: spec.kind,
          slideIndex: idx,
          totalSlides,
          topics,
          forcedSlideTitle: spec.forcedSlideTitle,
          matches: specMatches[idx],
        }),
      ),
    ),
  );

  // 조립: cover → (agenda) → [section 디바이더 + 그 그룹 주제]× → (quote) → cta
  const cover = filled[0];
  const topicSlides = filled.slice(1, 1 + sections.length);
  const trailing = filled.slice(1 + sections.length); // (quote?) + cta

  let alignedSlides: Slide[] = [cover];
  if (includeAgenda) {
    alignedSlides.push({ kind: "agenda", items: sections.map((s) => s.title) });
  }
  if (groupCount > 0) {
    const groups = distributeEvenly(topicSlides, groupCount);
    groups.forEach((grp, gi) => {
      alignedSlides.push({
        kind: "section",
        index: gi + 1,
        eyebrow: `SECTION ${String(gi + 1).padStart(2, "0")}`,
        title: sectionTitles[gi],
      });
      alignedSlides.push(...grp);
    });
  } else {
    alignedSlides.push(...topicSlides);
  }
  alignedSlides.push(...trailing);

  // 사용자가 직접 정한 제목(forcedTitle)이 있으면 표지 텍스트를 그 값으로 덮어쓴다.
  const forced = input.forcedTitle?.trim();
  if (forced && alignedSlides[0]?.kind === "cover") {
    alignedSlides = alignedSlides.map((s, i) =>
      i === 0 && s.kind === "cover" ? { ...s, title: forced } : s,
    );
  }

  // CTA 다음 마지막에 뒷표지(Back Cover)를 자동 추가 — plan/LLM 이 정하지 않고
  // cover/cta 처럼 강제. 본문 lengthPages 예산에는 포함하지 않는다(append).
  alignedSlides = [...alignedSlides, { kind: "backCover" }];

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

const DEFAULT_TOPICS = [
  "배경",
  "현황 분석",
  "핵심 제안",
  "기대 효과",
  "도입 사례",
  "구축 방안",
  "기능 상세",
  "비교 우위",
  "다음 단계",
];

// 풀버전(16장+)에서 플래너가 section 제목을 안 주거나 부족할 때의 폴백 대단원 제목.
const DEFAULT_SECTION_TITLES = ["배경과 현황", "핵심 제안", "실행 방안", "기대 효과"];

// 배열을 g 개의 연속 그룹으로 최대한 균등 분할(앞 그룹이 +1 흡수).
function distributeEvenly<T>(arr: T[], g: number): T[][] {
  if (g <= 1) return [arr];
  const out: T[][] = [];
  const base = Math.floor(arr.length / g);
  let rem = arr.length % g;
  let i = 0;
  for (let k = 0; k < g; k++) {
    const n = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
    out.push(arr.slice(i, i + n));
    i += n;
  }
  return out;
}

// 플랜 결과를 정확히 target 개로 맞춘다(초과 trim, 부족 시 기본 주제로 pad).
// 제목의 번호 prefix 를 제거하고 kind 를 유효 PlanKind 로 정규화한다.
function normalizeSections(
  raw: PlanSection[] | undefined,
  target: number,
  docTypeLabel: string,
): PlanSection[] {
  const cleaned: PlanSection[] = (raw ?? [])
    .filter((s) => s && typeof s.title === "string")
    .map((s) => ({
      title: stripNumberPrefix(s.title).slice(0, 60) || docTypeLabel,
      kind: (PLAN_KINDS as readonly string[]).includes(s.kind)
        ? s.kind
        : "bullets",
    }));

  const out = cleaned.slice(0, target);
  while (out.length < target) {
    out.push({
      title: DEFAULT_TOPICS[out.length % DEFAULT_TOPICS.length],
      kind: "bullets",
    });
  }
  return out;
}

async function proposePlan(args: {
  docTypeLabel: string;
  answers: GenerateInput["answers"];
  sectionCount: number;
  fullVersion: boolean;
  kbHeadline: string;
}): Promise<PlanToolInput> {
  const res = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 800,
    system: systemWithCache([PLAN_SYSTEM]),
    tools: [PROPOSE_PLAN_TOOL],
    tool_choice: { type: "tool", name: "propose_plan" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `<documentType>${args.docTypeLabel}</documentType>\n<sectionCount>${args.sectionCount}</sectionCount>\n<fullVersion>${args.fullVersion}</fullVersion>\n<answers>\n  reader: ${args.answers.reader}\n  cta: ${args.answers.cta}\n  objection: ${args.answers.objection}\n  keyMessage: ${args.answers.keyMessage}\n  length: ${args.answers.length}\n</answers>`,
          },
          ...(args.kbHeadline
            ? [contextBlock("kbContext", args.kbHeadline)]
            : []),
          {
            type: "text",
            text: `정확히 ${args.sectionCount}개의 본문 주제(section)를 propose_plan 으로 반환하라. 각 주제는 목차 한 줄이자 슬라이드 제목이 된다.`,
          },
        ],
      },
    ],
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("plan tool_use missing");
  }
  const input = toolUse.input as PlanToolInput;
  if (!Array.isArray(input.sections)) {
    return { sections: [], includeQuote: input.includeQuote };
  }
  return input;
}

type FillArgs = {
  input: GenerateInput;
  docTypeLabel: string;
  kind: SlideKind;
  slideIndex: number;
  totalSlides: number;
  topics: string[];
  // 주제 슬라이드일 때 강제할 제목(= 해당 section.title, agenda 항목과 동일).
  forcedSlideTitle?: string;
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
  return fallbackSlide(
    args.kind,
    args.slideIndex,
    args.docTypeLabel,
    lastErr,
    args.forcedSlideTitle,
  );
}

async function fillSlideOnce(args: FillArgs): Promise<Record<string, unknown>> {
  const kbText = args.matches
    .map(
      (m) =>
        `[sourceId=${m.sourceId} ord=${m.ord}] ${m.title ?? "(제목 없음)"}: ${m.text.slice(0, 360).replace(/\s+/g, " ")}`,
    )
    .join("\n");

  const tool = fillSlideTool(args.kind);
  const slideTitleTag = args.forcedSlideTitle
    ? `\n<slideTitle>${args.forcedSlideTitle}</slideTitle>`
    : "";
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
            text: `<documentType>${args.docTypeLabel}</documentType>\n<documentTitle>${args.input.documentTitle}</documentTitle>\n<slideIndex>${args.slideIndex + 1}/${args.totalSlides}</slideIndex>\n<kind>${args.kind}</kind>${slideTitleTag}\n<deckTopics>${args.topics.join(", ")}</deckTopics>\n<answers>\n  reader: ${args.input.answers.reader}\n  cta: ${args.input.answers.cta}\n  objection: ${args.input.answers.objection}\n  keyMessage: ${args.input.answers.keyMessage}\n  length: ${args.input.answers.length}\n</answers>`,
          },
          ...(kbText ? [contextBlock("kbContext", kbText)] : []),
          {
            type: "text",
            text: args.forcedSlideTitle
              ? `위 정보로 "${args.forcedSlideTitle}" 주제의 ${args.kind} 슬라이드 한 장을 fill_slide 도구로 채워라. title 은 그 주제와 동일하게.`
              : `위 정보로 ${args.kind} 슬라이드 한 장을 fill_slide 도구로 채워라.`,
          },
        ],
      },
    ],
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("fill_slide tool_use missing");
  }
  const raw = toolUse.input as Record<string, unknown>;
  // 주제 슬라이드는 제목을 코드가 강제 — agenda 항목과 정확히 동일 문자열 보장.
  if (args.forcedSlideTitle) {
    raw.title = args.forcedSlideTitle;
  }
  return raw;
}

function fallbackSlide(
  kind: SlideKind,
  index: number,
  docTypeLabel: string,
  err: unknown,
  forcedSlideTitle?: string,
): Slide {
  const errMsg = err instanceof Error ? err.message : String(err);
  console.error(`[generate] slide ${index} (${kind}) fallback:`, errMsg);
  // 주제 슬라이드 fallback 은 agenda 항목과 제목이 어긋나지 않도록 강제 제목을 쓴다.
  const t = forcedSlideTitle?.trim();
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
      return { kind: "section", index: index + 1, title: t || "섹션" };
    case "twoCol":
      return {
        kind: "twoCol",
        title: t || "비교",
        left: { label: "AS-IS", body: "현재 상태" },
        right: { label: "TO-BE", body: "제안 상태" },
      };
    case "metric":
      return {
        kind: "metric",
        title: t || "핵심 지표",
        metrics: [
          { label: "지표 1", value: "—" },
          { label: "지표 2", value: "—" },
          { label: "지표 3", value: "—" },
        ],
      };
    case "quote":
      return { kind: "quote", text: "—", attribution: "—" };
    case "image":
      return {
        kind: "image",
        title: t || "처리 흐름",
        nodes: ["입력", "처리", "출력"],
        direction: "horizontal",
      };
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
        title: t || "본문",
        bullets: [
          { text: "핵심 요지", level: 0 },
          { text: "근거", level: 0 },
        ],
      };
  }
}
