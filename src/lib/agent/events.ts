import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { agents, agentRuns, agentEvents, sourceChunks } from "@/db/schema";

export const AGENT_PHASES = [
  "detect",
  "perceive",
  "reason",
  "act",
  "learn",
] as const;
export type AgentPhase = (typeof AGENT_PHASES)[number];

// 워크스페이스당 monitor 에이전트 1개를 보장. 없으면 생성.
export async function ensureMonitorAgent(workspaceId: string): Promise<string> {
  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.workspaceId, workspaceId), eq(agents.kind, "monitor")))
    .limit(1);
  if (existing) return existing.id;

  const [row] = await db
    .insert(agents)
    .values({
      workspaceId,
      kind: "monitor",
      status: "active",
      autoRun: true,
      configJson: { policy: { publish: "manual" } },
    })
    .returning({ id: agents.id });
  return row.id;
}

export async function startRun(
  agentId: string,
  trigger: string,
  summary?: string,
): Promise<string> {
  const [row] = await db
    .insert(agentRuns)
    .values({ agentId, trigger, status: "running", summary: summary ?? null })
    .returning({ id: agentRuns.id });
  return row.id;
}

export async function endRun(
  runId: string,
  status: "succeeded" | "failed",
  summary?: string,
): Promise<void> {
  await db
    .update(agentRuns)
    .set({
      status,
      endedAt: new Date(),
      ...(summary ? { summary } : {}),
    })
    .where(eq(agentRuns.id, runId));
}

// 각 step 안에서 호출 → SSE(Phase 7) 가 이 row 를 대시보드로 흘려보낸다.
export async function appendEvent(
  runId: string,
  phase: AgentPhase | string,
  type: string,
  payload: unknown,
): Promise<void> {
  await db.insert(agentEvents).values({
    runId,
    phase,
    type,
    payloadJson: (payload ?? null) as object,
  });
}

// detect 가 갱신 전 비교할 "이전 본문" 을 청크에서 재구성.
export async function reconstructSourceText(sourceId: string): Promise<string> {
  const rows = await db
    .select({ ord: sourceChunks.ord, text: sourceChunks.text })
    .from(sourceChunks)
    .where(eq(sourceChunks.sourceId, sourceId))
    .orderBy(asc(sourceChunks.ord));
  return rows.map((r) => r.text).join("\n");
}

// 토큰 집합 Jaccard 거리 기반의 가벼운 변경 비율 (0=동일, 1=완전 상이).
export function changeRatio(oldText: string, newText: string): number {
  const tok = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[\s\p{P}]+/u)
        .filter((t) => t.length > 1),
    );
  const a = tok(oldText);
  const b = tok(newText);
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  if (union === 0) return 0;
  return 1 - inter / union;
}
