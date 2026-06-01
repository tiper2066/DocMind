import { redirect } from "next/navigation";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  agents,
  agentRuns,
  agentEvents,
  approvals,
  documents,
  documentVersions,
  sources,
} from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { ensureMonitorAgent } from "@/lib/agent/events";
import type { AgentEventMessage } from "@/lib/sse";
import { DetectButton } from "@/components/agent/DetectButton";
import { AgentList, type AgentListItem } from "@/components/agent/AgentList";
import { AgentLive, type VersionCard } from "@/components/agent/AgentLive";
import { StatCard } from "@/components/agent/StatCard";
import {
  ApprovalQueue,
  type PendingApproval,
  type HighlightedApproval,
} from "@/components/agent/ApprovalQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// new Date() 를 컴포넌트 렌더 밖으로 (react-hooks/purity).
function since24h(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ approval?: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  const { approval: highlightId } = await searchParams;

  const monitorAgentId = await ensureMonitorAgent(ctx.workspaceId);

  // 좌측: 에이전트 목록 (마지막 run 상태 포함)
  const agentRows = await db
    .select({
      id: agents.id,
      kind: agents.kind,
      status: agents.status,
      autoRun: agents.autoRun,
    })
    .from(agents)
    .where(eq(agents.workspaceId, ctx.workspaceId))
    .orderBy(desc(agents.createdAt));

  const lastRuns = await db
    .select({
      agentId: agentRuns.agentId,
      status: agentRuns.status,
      startedAt: agentRuns.startedAt,
    })
    .from(agentRuns)
    .innerJoin(agents, eq(agents.id, agentRuns.agentId))
    .where(eq(agents.workspaceId, ctx.workspaceId))
    .orderBy(desc(agentRuns.startedAt));
  const lastStatusByAgent = new Map<string, string>();
  for (const r of lastRuns) {
    if (!lastStatusByAgent.has(r.agentId)) lastStatusByAgent.set(r.agentId, r.status);
  }
  const agentList: AgentListItem[] = agentRows.map((a) => ({
    id: a.id,
    kind: a.kind,
    status: a.status,
    autoRun: a.autoRun,
    lastRunStatus: lastStatusByAgent.get(a.id) ?? null,
  }));

  // 중앙 활동 피드 초기 적재 (SSE 백로그와 동일 shape, asc)
  const backlog = await db
    .select({
      id: agentEvents.id,
      runId: agentEvents.runId,
      phase: agentEvents.phase,
      type: agentEvents.type,
      ts: agentEvents.ts,
      payload: agentEvents.payloadJson,
    })
    .from(agentEvents)
    .innerJoin(agentRuns, eq(agentRuns.id, agentEvents.runId))
    .innerJoin(agents, eq(agents.id, agentRuns.agentId))
    .where(eq(agents.workspaceId, ctx.workspaceId))
    .orderBy(desc(agentEvents.ts))
    .limit(20);
  const initialEvents: AgentEventMessage[] = backlog
    .reverse()
    .map((e) => ({
      id: e.id,
      runId: e.runId,
      phase: e.phase,
      type: e.type,
      ts: e.ts.toISOString(),
      payload: e.payload,
    }));

  // 생성된 문서 (최근 버전)
  const versionRows = await db
    .select({
      id: documentVersions.id,
      version: documentVersions.version,
      status: documentVersions.status,
      createdAt: documentVersions.createdAt,
      documentTitle: documents.title,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(eq(documents.workspaceId, ctx.workspaceId))
    .orderBy(desc(documentVersions.createdAt))
    .limit(12);
  const versions: VersionCard[] = versionRows.map((v) => ({
    id: v.id,
    documentTitle: v.documentTitle,
    version: v.version,
    status: v.status,
    createdAt: v.createdAt.toISOString(),
  }));

  // 우측 통계
  const since = since24h();
  const [{ runsToday }] = await db
    .select({ runsToday: sql<number>`count(*)::int` })
    .from(agentRuns)
    .innerJoin(agents, eq(agents.id, agentRuns.agentId))
    .where(
      and(eq(agents.workspaceId, ctx.workspaceId), gte(agentRuns.startedAt, since)),
    );
  const [{ publishedCount }] = await db
    .select({ publishedCount: sql<number>`count(*)::int` })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(
      and(
        eq(documents.workspaceId, ctx.workspaceId),
        eq(documentVersions.status, "published"),
      ),
    );
  const [{ monitored }] = await db
    .select({ monitored: sql<number>`count(*)::int` })
    .from(sources)
    .where(
      and(eq(sources.workspaceId, ctx.workspaceId), eq(sources.kind, "url")),
    );

  // 승인 큐 (대기) + 딥링크 하이라이트(처리됨 포함)
  const pendingRows = await db
    .select({
      id: approvals.id,
      payload: approvals.payload,
      docTitle: documents.title,
    })
    .from(approvals)
    .innerJoin(agentRuns, eq(agentRuns.id, approvals.runId))
    .innerJoin(agents, eq(agents.id, agentRuns.agentId))
    .leftJoin(documents, eq(documents.id, approvals.documentId))
    .where(and(eq(agents.workspaceId, ctx.workspaceId), isNull(approvals.decision)))
    .orderBy(desc(approvals.createdAt));
  const pending: PendingApproval[] = pendingRows.map((p) => ({
    id: p.id,
    docTitle: p.docTitle,
    payload: p.payload,
  }));

  let highlighted: HighlightedApproval | null = null;
  if (highlightId && !pending.some((p) => p.id === highlightId)) {
    const [h] = await db
      .select({
        id: approvals.id,
        decision: approvals.decision,
        docTitle: documents.title,
      })
      .from(approvals)
      .innerJoin(agentRuns, eq(agentRuns.id, approvals.runId))
      .innerJoin(agents, eq(agents.id, agentRuns.agentId))
      .leftJoin(documents, eq(documents.id, approvals.documentId))
      .where(
        and(eq(agents.workspaceId, ctx.workspaceId), eq(approvals.id, highlightId)),
      )
      .limit(1);
    highlighted = h ?? null;
  }

  const savedHours = publishedCount * 3; // 데모 추정: 문서당 ~3h 절감

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">에이전트</h1>
          <p className="text-sm text-muted-foreground">
            소스 변경을 감지하고 5단계(감지→인식→판단→행동→학습)로 문서를 갱신합니다.
          </p>
        </div>
        <DetectButton agentId={monitorAgentId} />
      </div>

      <div className="grid gap-8 md:grid-cols-[200px_1fr_300px]">
        <AgentList agents={agentList} />

        <AgentLive initialEvents={initialEvents} versions={versions} />

        <aside className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="오늘 자동 실행" value={`${runsToday}`} hint="최근 24h" />
            <StatCard label="갱신 문서" value={`${publishedCount}`} hint="발행됨" />
            <StatCard label="시간 절감" value="87%" hint={`~${savedHours}h`} />
            <StatCard label="모니터링" value={`${monitored}`} hint="URL 소스" />
          </div>
          <ApprovalQueue
            pending={pending}
            highlighted={highlighted}
            highlightId={highlightId}
          />
        </aside>
      </div>
    </main>
  );
}
