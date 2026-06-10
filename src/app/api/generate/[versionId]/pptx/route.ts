import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, documentVersions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { renderPptx } from "@/lib/ppt/pptx";
import { DeckSchema } from "@/lib/ppt/types";
import { uploadPptx, downloadPptx } from "@/lib/storage";

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

// RFC 5987 ext-value: percent-encode everything outside attr-char.
function rfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

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
      docTitle: documents.title,
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

  // 다운로드 파일명: "<문서 제목> v<버전>.pptx" (파일명에 못 쓰는 문자 정리).
  const safeTitle = (row.docTitle || "document")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const downloadName = `${safeTitle} v${row.v.version}.pptx`;

  let bytes: ArrayBuffer;
  if (row.v.pptxObjectKey) {
    bytes = await downloadPptx(row.v.pptxObjectKey);
  } else {
    const deck = DeckSchema.parse(row.v.slidesJson);
    const buf = await renderPptx(deck);

    const key = `${ctx.workspaceId}/${row.v.documentId}/v${row.v.version}.pptx`;
    await uploadPptx(key, buf);

    await db
      .update(documentVersions)
      .set({ pptxObjectKey: key })
      .where(eq(documentVersions.id, row.v.id));

    bytes = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
  }

  // ASCII 폴백 filename + RFC 5987 filename*(UTF-8) 동시 제공 → 한글 파일명 정상 표기.
  const asciiFallback = downloadName.replace(/[^\x20-\x7E]/g, "_");

  return new Response(bytes, {
    headers: {
      "Content-Type": PPTX_MIME,
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${rfc5987(downloadName)}`,
      "X-Download-Filename": rfc5987(downloadName),
      "Cache-Control": "no-store",
    },
  });
}
