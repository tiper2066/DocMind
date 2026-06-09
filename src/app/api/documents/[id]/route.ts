import { NextResponse } from "next/server";
import { z } from "zod";
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

const PatchBody = z.object({
  title: z.string().trim().min(1).max(200),
});

// 제목 변경: documents.title + titleManual, 모든 버전 deck 의 meta.title·표지
// slides[0].title 동기화, 캐시된 .pptx 무효화.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const title = parsed.data.title;

  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await db
    .update(documents)
    .set({ title, titleManual: true, updatedAt: new Date() })
    .where(eq(documents.id, id));

  // 모든 버전의 deck 표지·메타 제목을 새 제목으로 맞춘다(버전 간 제목 정합 + 비교
  // diff 에 제목이 잡히지 않도록). 캐시된 pptx 는 무효화(다음 다운로드 시 재렌더).
  const versions = await db
    .select({
      id: documentVersions.id,
      slidesJson: documentVersions.slidesJson,
      pptxObjectKey: documentVersions.pptxObjectKey,
    })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, id));

  const staleKeys: string[] = [];
  for (const v of versions) {
    const deck = v.slidesJson as {
      meta?: { title?: string };
      slides?: Array<{ kind?: string; title?: string }>;
    } | null;
    if (!deck) continue;
    const next = {
      ...deck,
      meta: { ...(deck.meta ?? {}), title },
      slides: (deck.slides ?? []).map((s, i) =>
        i === 0 && s.kind === "cover" ? { ...s, title } : s,
      ),
    };
    await db
      .update(documentVersions)
      .set({ slidesJson: next, pptxObjectKey: null })
      .where(eq(documentVersions.id, v.id));
    if (v.pptxObjectKey) staleKeys.push(v.pptxObjectKey);
  }

  await deletePptxObjects(staleKeys);

  await db.insert(auditLogs).values({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "document.rename",
    target: id,
  });

  return NextResponse.json({ ok: true, title });
}

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
