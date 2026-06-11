import { and, eq, inArray, lt } from "drizzle-orm";
import { z } from "zod";

import { inngest, TrendScanRequested } from "./client";
import { db } from "@/db/client";
import { agents, sources, sourceChunks } from "@/db/schema";
import { anthropic, MODELS, systemWithCache } from "@/lib/anthropic";
import { embed } from "@/lib/embeddings";
import { chunkText } from "@/lib/chunk";
import { dispatchParse, generateSourceMetadata, sha256 } from "./functions";

// 회당 최대 등록 수(성공 기준) / 후보 수집 상한 / 동향 소스 보존 기간 / 기준 시간대.
// timezone 은 IANA 식별자 — cron 은 매시 정각에 돌고, 이 시간대의 현지 시각이
// 0시/12시인 워크스페이스만 실행된다 (워크스페이스별 나라/시간대 지원).
const DEFAULTS = {
  maxPerRun: 20,
  candidatesMax: 40,
  expireDays: 30,
  timezone: "Asia/Seoul",
};

type TrendConfig = typeof DEFAULTS;

const SCAN_LOCAL_HOURS = [0, 12];

export function localHour(timezone: string, at: Date): number {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hourCycle: "h23",
      }).format(at),
    );
  } catch {
    // 잘못된 시간대 설정은 기본값으로 폴백.
    return localHour(DEFAULTS.timezone, at);
  }
}

const TREND_SEARCH_SYSTEM = `너는 사내 지식 베이스(KB)의 "최신 동향 수집기"다. 주어진 KB 주제 목록을 읽고, 웹 검색 도구로 해당 주제들과 직접 관련된 **최신** 자료(뉴스·기술 문서·리포트·블로그)를 찾는다.

규칙:
- KB 주제와 명확히 관련된 결과만 채택한다. **관련성이 낮으면 채택하지 않는다 — 개수를 채우기 위해 무관한 URL 을 넣지 말 것.** 관련 자료가 없으면 빈 배열을 출력한다.
- 최신성(최근 수개월 내)을 우선하되, 표준 문서처럼 시점 무관한 권위 자료도 허용.
- 같은 사이트의 중복·유사 페이지는 1개만.
- 로그인 필요/페이월 페이지는 제외.

최종 응답은 반드시 JSON 배열 **만** 출력한다 (설명 문장·코드펜스 금지, url/title 외 필드 금지):
[{"url": "https://...", "title": "페이지 제목"}]`;

const CandidateSchema = z.array(
  z.object({
    url: z.string().url(),
    title: z.string().optional(),
    reason: z.string().optional(),
  }),
);

type Candidate = z.infer<typeof CandidateSchema>[number];

// 비교용 URL 정규화 — 호스트 소문자, 해시/utm 제거, 트레일링 슬래시 제거.
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    for (const k of [...u.searchParams.keys()]) {
      if (k.startsWith("utm_")) u.searchParams.delete(k);
    }
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw;
  }
}

export async function searchCandidates(
  topics: string[],
  max: number,
): Promise<Candidate[]> {
  let messages: Array<{
    role: "user" | "assistant";
    content: string | unknown[];
  }> = [
    {
      role: "user",
      content: `<kb_topics>\n${topics.join("\n")}\n</kb_topics>\n\n위 KB 주제들과 관련된 최신 동향 자료를 웹에서 검색해, 관련성 높은 URL 을 최대 ${max}개 JSON 배열로 출력하라. 관련성이 낮으면 더 적게 또는 빈 배열로.`,
    },
  ];

  const call = () =>
    anthropic.messages.create({
      model: MODELS.sonnet,
      max_tokens: 8000,
      system: systemWithCache([TREND_SEARCH_SYSTEM]),
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      messages:
        messages as Parameters<typeof anthropic.messages.create>[0]["messages"],
    });

  let res = await call();
  // 서버 도구 루프가 한도에 닿으면 pause_turn — assistant 턴을 붙여 재요청하면 이어서 실행된다.
  let guard = 0;
  while (res.stop_reason === "pause_turn" && guard++ < 3) {
    messages = [...messages, { role: "assistant", content: res.content }];
    res = await call();
  }

  const text = res.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return parseCandidates(text);
}

// 모델이 코드펜스/서두 문장(대괄호 포함 가능: 예 "[demo]")을 섞어도 견고하게 파싱:
// ① ```json 펜스 안 → ② 각 '[' 위치에서 마지막 ']' 까지 순차 시도.
function parseCandidates(text: string): Candidate[] {
  const bodies: string[] = [];
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fence) bodies.push(fence[1]);
  const last = text.lastIndexOf("]");
  for (
    let i = text.indexOf("[");
    i >= 0 && i < last && bodies.length < 8;
    i = text.indexOf("[", i + 1)
  ) {
    bodies.push(text.slice(i, last + 1));
  }
  // max_tokens 로 배열이 중간에 잘린 경우 — 마지막 완전한 객체까지 살려 복구.
  const firstBracket = text.indexOf("[");
  const lastBrace = text.lastIndexOf("}");
  if (firstBracket >= 0 && lastBrace > firstBracket) {
    bodies.push(text.slice(firstBracket, lastBrace + 1) + "]");
  }
  for (const b of bodies) {
    try {
      const parsed = CandidateSchema.safeParse(JSON.parse(b));
      if (parsed.success && parsed.data.length > 0) return parsed.data;
    } catch {
      // 다음 후보 구간 시도
    }
  }
  return [];
}

// 후보를 소스로 등록하기 **전에** 크롤·추출을 먼저 수행하고 성공한 것만 insert 한다.
// 실패 후보는 행 자체가 생기지 않으므로 (a) 실패 카드가 존재할 수 없고
// (b) maxPerRun 카운트는 성공 수만 센다.
export async function ingestCandidate(
  workspaceId: string,
  url: string,
): Promise<boolean> {
  const pseudo = {
    id: "trend-candidate",
    kind: "url",
    url,
    fileKey: null,
  } as Parameters<typeof dispatchParse>[0];

  const result = await dispatchParse(pseudo);
  const text = result.text.trim();
  if (text.length === 0) throw new Error("empty extraction");

  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error("0 chunks");
  const vectors = await embed(
    chunks.map((c) => c.text),
    "document",
  );
  const meta = await generateSourceMetadata(text, result.title ?? null);

  const [row] = await db
    .insert(sources)
    .values({
      workspaceId,
      kind: "url",
      origin: "trend",
      url,
      title: meta.title,
      summary: meta.summary,
      tags: meta.tags,
      status: "ready",
      contentHash: sha256(text),
      lastCrawledAt: new Date(),
    })
    .returning({ id: sources.id });

  await db.insert(sourceChunks).values(
    chunks.map((c, i) => ({
      sourceId: row.id,
      ord: c.ord,
      text: c.text,
      tokenCount: c.tokenCount,
      embedding: vectors[i],
    })),
  );
  return true;
}

export const trendScan = inngest.createFunction(
  {
    id: "trend-scan",
    name: "Trend scan (최신 지식 및 동향)",
    retries: 1,
    triggers: [
      // 매시 정각 — 워크스페이스별 시간대의 현지 0시/12시 게이트는 핸들러에서.
      { cron: "0 * * * *" },
      { event: "agent/trend.scan.requested" },
    ],
  },
  async ({ event, step }) => {
    const isCron = event.name === "inngest/scheduled.timer";
    const data: { workspaceId?: string } = isCron
      ? {}
      : TrendScanRequested.parse((event as { data?: unknown }).data ?? {});

    const targets = await step.run("load-targets", async () => {
      const rows = await db
        .select({
          workspaceId: agents.workspaceId,
          autoRun: agents.autoRun,
          configJson: agents.configJson,
        })
        .from(agents)
        .where(eq(agents.kind, "trend"));
      const now = new Date();
      return rows.filter((r) => {
        if (!r.autoRun) return false;
        if (data.workspaceId && r.workspaceId !== data.workspaceId)
          return false;
        if (isCron) {
          // 명시 이벤트(스위치 ON)는 즉시, cron 은 현지 0시/12시에만.
          const tz =
            (r.configJson as Partial<TrendConfig>).timezone ??
            DEFAULTS.timezone;
          return SCAN_LOCAL_HOURS.includes(localHour(tz, now));
        }
        return true;
      });
    });

    let totalIngested = 0;
    const diag: Array<{
      ws: string;
      topics: number;
      candidates: number;
      ingested: number;
    }> = [];

    for (const target of targets) {
      const ws = target.workspaceId;
      const cfg: TrendConfig = {
        ...DEFAULTS,
        ...(target.configJson as Partial<TrendConfig>),
      };

      const topics = await step.run(`topics-${ws}`, async () => {
        const rows = await db
          .select({
            title: sources.title,
            summary: sources.summary,
            tags: sources.tags,
          })
          .from(sources)
          .where(
            and(
              eq(sources.workspaceId, ws),
              eq(sources.status, "ready"),
              eq(sources.origin, "user"),
            ),
          )
          .limit(30);
        return rows
          .filter((r) => r.title)
          .map(
            (r) =>
              `- ${r.title}${r.tags?.length ? ` [${r.tags.join(", ")}]` : ""}${r.summary ? ` — ${r.summary.slice(0, 120)}` : ""}`,
          );
      });
      if (topics.length === 0) continue;

      const candidates = await step.run(`search-${ws}`, async () => {
        const found = await searchCandidates(topics, cfg.candidatesMax);
        const existing = await db
          .select({ url: sources.url })
          .from(sources)
          .where(eq(sources.workspaceId, ws));
        const known = new Set(
          existing.filter((e) => e.url).map((e) => normalizeUrl(e.url!)),
        );
        const seen = new Set<string>();
        return found.filter((c) => {
          const n = normalizeUrl(c.url);
          if (known.has(n) || seen.has(n)) return false;
          seen.add(n);
          return true;
        });
      });

      // 순차 ingest — 실패는 카운트하지 않고 다음 후보로. 성공이 maxPerRun 에
      // 도달하면 중단. 후보가 부족하면 부족한 대로 끝낸다(억지 충원 금지).
      let ingested = 0;
      for (let i = 0; i < candidates.length; i++) {
        if (ingested >= cfg.maxPerRun) break;
        const ok = await step.run(`ingest-${ws}-${i}`, async () => {
          try {
            return await ingestCandidate(ws, candidates[i].url);
          } catch {
            return false;
          }
        });
        if (ok) ingested += 1;
      }
      totalIngested += ingested;
      diag.push({
        ws,
        topics: topics.length,
        candidates: candidates.length,
        ingested,
      });

      await step.run(`cleanup-${ws}`, async () => {
        const cutoff = new Date(
          Date.now() - cfg.expireDays * 24 * 60 * 60 * 1000,
        );
        const stale = await db
          .select({ id: sources.id })
          .from(sources)
          .where(
            and(
              eq(sources.workspaceId, ws),
              eq(sources.origin, "trend"),
              lt(sources.createdAt, cutoff),
            ),
          );
        if (stale.length > 0) {
          await db.delete(sources).where(
            inArray(
              sources.id,
              stale.map((s) => s.id),
            ),
          );
        }
        return stale.length;
      });
    }

    return {
      ok: true,
      workspaces: targets.length,
      ingested: totalIngested,
      diag,
    };
  },
);
