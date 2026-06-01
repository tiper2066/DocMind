import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import {
  documents,
  documentVersions,
  approvals,
  agentRuns,
  agents,
  auditLogs,
} from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { deletePptxObjects } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  // 워크스페이스 격리: 본인 워크스페이스 문서만.
  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // 가드: 미결 승인이 걸린 문서는 삭제 차단(승인 큐 정합성 보호).
  const [pending] = await db
    .select({ id: approvals.id })
    .from(approvals)
    .innerJoin(agentRuns, eq(agentRuns.id, approvals.runId))
    .innerJoin(agents, eq(agents.id, agentRuns.agentId))
    .where(
      and(
        eq(approvals.documentId, id),
        eq(agents.workspaceId, ctx.workspaceId),
        isNull(approvals.decision),
      ),
    )
    .limit(1);
  if (pending) {
    return NextResponse.json({ error: "pending_approval" }, { status: 409 });
  }

  // 스토리지 정리용으로 버전들의 pptx 키 수집 (cascade 전에).
  const versions = await db
    .select({ key: documentVersions.pptxObjectKey })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, id));
  const pptxKeys = versions
    .map((v) => v.key)
    .filter((k): k is string => Boolean(k));

  // 삭제 — versions/document_sources/interview_sessions 는 FK cascade,
  // approvals.documentId 는 set null 로 자동 처리.
  await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.workspaceId, ctx.workspaceId)));

  // best-effort 스토리지 정리 (실패해도 삭제는 성공 처리).
  await deletePptxObjects(pptxKeys);

  await db.insert(auditLogs).values({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "document.delete",
    target: id,
  });

  return NextResponse.json({ ok: true });
}
