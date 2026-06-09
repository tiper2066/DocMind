import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { sources, auditLogs } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { getWorkspaceContext } from "@/lib/rbac";
import { deleteSourceObjects } from "@/lib/storage";

export const runtime = "nodejs";

const PatchBody = z.object({
  // 파일 소스: 새로 업로드한 파일의 storage key(내용 교체). URL 소스: 생략(외부 변경 재감지).
  key: z.string().min(1).max(400).optional(),
});

// 소스 내용 "수정". 파일 소스는 새 파일로 교체(제목·content_hash 는 유지 — detect 가 라이브
// 새 내용 vs 저장된 옛 해시를 비교해 변경을 잡아야 하므로 해시를 미리 갱신하지 않는다).
// 교체 후 agent/detect.requested 를 쏘면 detect 가 변경을 감지 → 영향받은 PPT 가 대기 문서로.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const parsed = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const [src] = await db
    .select({
      id: sources.id,
      kind: sources.kind,
      fileKey: sources.fileKey,
    })
    .from(sources)
    .where(and(eq(sources.id, id), eq(sources.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!src) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let oldFileKey: string | null = null;
  if (src.kind === "file") {
    const key = parsed.data.key;
    if (!key) {
      return NextResponse.json({ error: "key_required" }, { status: 400 });
    }
    if (!key.startsWith(`${ctx.workspaceId}/`)) {
      return NextResponse.json({ error: "key_prefix_mismatch" }, { status: 403 });
    }
    oldFileKey = src.fileKey;
    // fileKey 만 새 파일로 교체. content_hash·title·status(ready) 는 유지 → detect 가 diff 감지.
    await db
      .update(sources)
      .set({ fileKey: key, updatedAt: new Date() })
      .where(and(eq(sources.id, id), eq(sources.workspaceId, ctx.workspaceId)));
  }
  // URL 소스는 교체할 내용이 없고, 외부 페이지 변경을 detect 가 재크롤로 잡는다.

  await inngest.send({
    name: "agent/detect.requested",
    data: { workspaceId: ctx.workspaceId, sourceId: id },
  });

  // 옛 파일은 best-effort 정리(키가 실제로 바뀌었을 때만).
  if (oldFileKey && oldFileKey !== parsed.data.key) {
    await deleteSourceObjects([oldFileKey]);
  }

  await db.insert(auditLogs).values({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "source.update",
    target: id,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  // 워크스페이스 격리: 본인 워크스페이스 소스만.
  const [src] = await db
    .select({ id: sources.id, fileKey: sources.fileKey })
    .from(sources)
    .where(and(eq(sources.id, id), eq(sources.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!src) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // 삭제 — source_chunks / document_sources 는 FK cascade,
  // change_events.sourceId 는 set null 로 자동 처리.
  await db
    .delete(sources)
    .where(and(eq(sources.id, id), eq(sources.workspaceId, ctx.workspaceId)));

  // best-effort 스토리지 정리 (파일 소스만 해당, 실패해도 삭제는 성공 처리).
  if (src.fileKey) await deleteSourceObjects([src.fileKey]);

  await db.insert(auditLogs).values({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "source.delete",
    target: id,
  });

  return NextResponse.json({ ok: true });
}
