import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, documentVersions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { renderPptx } from "@/lib/ppt/pptx";
import { DeckSchema } from "@/lib/ppt/types";
import { uploadPptx, createPptxDownloadUrl } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { versionId } = await params;

  const rows = await db
    .select({
      v: documentVersions,
      docWorkspaceId: documents.workspaceId,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documents.workspaceId, ctx.workspaceId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (row.v.pptxObjectKey) {
    const url = await createPptxDownloadUrl(row.v.pptxObjectKey);
    return NextResponse.json({ url, cached: true });
  }

  const deck = DeckSchema.parse(row.v.slidesJson);
  const buf = await renderPptx(deck);

  const key = `${ctx.workspaceId}/${row.v.documentId}/v${row.v.version}.pptx`;
  await uploadPptx(key, buf);

  await db
    .update(documentVersions)
    .set({ pptxObjectKey: key })
    .where(eq(documentVersions.id, row.v.id));

  const url = await createPptxDownloadUrl(key);
  return NextResponse.json({ url, cached: false });
}
