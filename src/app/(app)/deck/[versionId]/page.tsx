import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, documentVersions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { DeckSchema } from "@/lib/ppt/types";
import { DeckViewer } from "@/components/deck/DeckViewer";

export const dynamic = "force-dynamic";

export default async function DeckPage({
  params,
}: {
  params: Promise<{ versionId: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

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
  if (!row) notFound();

  const deck = DeckSchema.parse(row.v.slidesJson);

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <DeckViewer deck={deck} versionId={versionId} />
    </main>
  );
}
