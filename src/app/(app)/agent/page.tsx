import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

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
import { AgentDocs, type DocGroup } from "@/components/agent/AgentDocs";
import {
  BulkApproveCard,
  type BulkPendingItem,
} from "@/components/agent/BulkApproveCard";
import { Badge } from "@/components/ui/badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function since24h(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-body-sm text-steel">{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
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

  // 우측 상태(감지/발행): monitor 에이전트 상태·autoRun.
  const agentRows = await db
    .select({
      kind: agents.kind,
      status: agents.status,
      autoRun: agents.autoRun,
    })
    .from(agents)
    .where(eq(agents.workspaceId, ctx.workspaceId));
  const monitor = agentRows.find((a) => a.kind === "monitor");
  const detectionActive = monitor?.status === "active";
  const autoPublish = monitor?.autoRun ?? false;

  // 버전(문서별 묶음용). 최근순으로 받아 문서 순서를 정한다.
  const versionRows = await db
    .select({
      id: documentVersions.id,
      version: documentVersions.version,
      status: documentVersions.status,
      documentId: documentVersions.documentId,
      documentTitle: documents.title,
      createdAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(eq(documents.workspaceId, ctx.workspaceId))
    .orderBy(desc(documentVersions.createdAt))
    .limit(50);

  // 대기 승인: versionId → {approvalId, runId}, 그리고 전체 승인 카드용 목록.
  const pendingRows = await db
    .select({
      id: approvals.id,
      kind: approvals.kind,
      runId: approvals.runId,
      payload: approvals.payload,
      docTitle: documents.title,
    })
    .from(approvals)
    .innerJoin(agentRuns, eq(agentRuns.id, approvals.runId))
    .innerJoin(agents, eq(agents.id, agentRuns.agentId))
    .leftJoin(documents, eq(documents.id, approvals.documentId))
    .where(and(eq(agents.workspaceId, ctx.workspaceId), isNull(approvals.decision)))
    .orderBy(desc(approvals.createdAt));

  const pendingByVersion = new Map<string, { approvalId: string; runId: string }>();
  const bulkItems: BulkPendingItem[] = [];
  for (const p of pendingRows) {
    const payload = (p.payload ?? {}) as {
      versionId?: string;
      version?: number;
      sourceTitle?: string | null;
    };
    if (payload.versionId) {
      pendingByVersion.set(payload.versionId, {
        approvalId: p.id,
        runId: p.runId,
      });
    }
    bulkItems.push({
      id: p.id,
      title:
        p.kind === "regenerate"
          ? (payload.sourceTitle ?? "소스 변경")
          : (p.docTitle ?? "문서"),
      version: payload.version ?? null,
    });
  }


  // 대기 런의 이벤트 백로그(피드/루프 초기값). 라이브는 클라 SSE 가 이어받음.
  const pendingRunIds = [...new Set(pendingRows.map((p) => p.runId))];
  const initialEventsByRun: Record<string, AgentEventMessage[]> = {};
  if (pendingRunIds.length > 0) {
    const evs = await db
      .select({
        id: agentEvents.id,
        runId: agentEvents.runId,
        phase: agentEvents.phase,
        type: agentEvents.type,
        ts: agentEvents.ts,
        payload: agentEvents.payloadJson,
      })
      .from(agentEvents)
      .where(inArray(agentEvents.runId, pendingRunIds))
      .orderBy(asc(agentEvents.ts))
      .limit(300);
    for (const e of evs) {
      (initialEventsByRun[e.runId] ??= []).push({
        id: e.id,
        runId: e.runId,
        phase: e.phase,
        type: e.type,
        ts: e.ts.toISOString(),
        payload: e.payload,
      });
    }
  }

  // 문서별 그룹(최근 문서 우선, 버전 desc).
  const docOrder: string[] = [];
  const byDoc = new Map<string, DocGroup>();
  for (const v of versionRows) {
    let g = byDoc.get(v.documentId);
    if (!g) {
      g = { documentId: v.documentId, title: v.documentTitle, versions: [] };
      byDoc.set(v.documentId, g);
      docOrder.push(v.documentId);
    }
    g.versions.push({
      id: v.id,
      version: v.version,
      status: v.status,
      pending: pendingByVersion.get(v.id) ?? null,
      dateLabel: v.createdAt.toLocaleDateString("ko-KR"),
    });
  }
  const documentGroups: DocGroup[] = docOrder.map((id) => {
    const g = byDoc.get(id)!;
    return { ...g, versions: [...g.versions].sort((a, b) => b.version - a.version) };
  });

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

  // 딥링크로 들어온 승인이 이미 처리됐다면 상단 배너로 안내(알림 동선 보존).
  let decidedHighlight: { docTitle: string | null; decision: string | null } | null =
    null;
  if (highlightId && !pendingRows.some((p) => p.id === highlightId)) {
    const [h] = await db
      .select({ decision: approvals.decision, docTitle: documents.title })
      .from(approvals)
      .innerJoin(agentRuns, eq(agentRuns.id, approvals.runId))
      .innerJoin(agents, eq(agents.id, agentRuns.agentId))
      .leftJoin(documents, eq(documents.id, approvals.documentId))
      .where(
        and(eq(agents.workspaceId, ctx.workspaceId), eq(approvals.id, highlightId)),
      )
      .limit(1);
    decidedHighlight = h ?? null;
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between gap-6">
        <div>
          <h1 className="font-heading text-heading-3 text-ink">에이전트</h1>
          <p className="mt-1 text-body-sm text-steel">
            소스 변경을 감지하고 5단계(감지→인식→판단→행동→학습)로 문서를 갱신합니다.
          </p>
        </div>
        <div className="shrink-0">
          <DetectButton agentId={monitorAgentId} />
        </div>
      </div>

      {decidedHighlight && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-hairline bg-canvas px-5 py-3">
          <span className="text-body-sm text-ink">
            링크로 열린 승인 · {decidedHighlight.docTitle ?? "문서"}
          </span>
          <Badge
            variant={
              decidedHighlight.decision === "reject" ? "destructive" : "outline"
            }
            className={
              decidedHighlight.decision === "approve"
                ? "border-transparent bg-success text-on-primary"
                : undefined
            }
          >
            {decidedHighlight.decision === "approve"
              ? "발행 승인됨"
              : decidedHighlight.decision === "reject"
                ? "거부됨"
                : "대기 중"}
          </Badge>
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <AgentDocs
            documents={documentGroups}
            initialEventsByRun={initialEventsByRun}
            highlightApprovalId={highlightId}
          />
        </div>

        {/* 우측 카드 상단을 좌측 첫 문서 카드 상단과 정렬 — 탭 스트립(약 38px)+탭/콘텐츠 간격(gap-2 8px + mt-4 16px) 높이만큼 내림 */}
        <aside className="space-y-6 md:mt-15.5">
          <div className="rounded-xl border border-hairline bg-canvas p-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-sm text-steel">감지</span>
                <span
                  className={`font-medium ${
                    detectionActive ? "text-link-blue" : "text-steel"
                  }`}
                >
                  {detectionActive ? "Active" : "대기"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-sm text-steel">발행</span>
                <span className="font-medium text-brand-green">
                  {autoPublish ? "자동" : "수동"}
                </span>
              </div>
            </div>

            <div className="my-4 border-t border-hairline" />

            <div className="space-y-2">
              <StatRow label="오늘 자동 실행 (최근 24h)" value={runsToday} />
              <StatRow label="갱신 문서 (발행 완료)" value={publishedCount} />
              <StatRow label="모니터링 (URL 소스)" value={monitored} />
            </div>
          </div>

          <BulkApproveCard items={bulkItems} />
        </aside>
      </div>
    </main>
  );
}
