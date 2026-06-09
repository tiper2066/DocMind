import { redirect } from "next/navigation";
import { and, desc, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, documentVersions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { DOC_TYPE_LABELS } from "@/lib/interview/machine";
import { DocsFolderView, type DocCard } from "@/components/docs/DocsFolderView";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DocsPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  // 최종 PPT 생성 전(draft)은 문서함에 노출하지 않는다 (미완성 초안 숨김).
  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      type: documents.type,
      status: documents.status,
      updatedAt: documents.updatedAt,
      // New = 생성 24시간 이내. Update = 갱신 24시간 이내(+ 버전>1 조건은 아래 map 에서).
      createdRecent: sql<boolean>`${documents.createdAt} > now() - interval '24 hours'`,
      updatedRecent: sql<boolean>`${documents.updatedAt} > now() - interval '24 hours'`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.workspaceId, ctx.workspaceId),
        ne(documents.status, "draft"),
      ),
    )
    .orderBy(desc(documents.updatedAt));

  const agg = await db
    .select({
      documentId: documentVersions.documentId,
      latest: sql<number>`max(${documentVersions.version})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(documentVersions)
    .innerJoin(documents, eq(documents.id, documentVersions.documentId))
    .where(eq(documents.workspaceId, ctx.workspaceId))
    .groupBy(documentVersions.documentId);
  const aggByDoc = new Map(agg.map((a) => [a.documentId, a]));

  const cards: DocCard[] = docs.map((d) => {
    const a = aggByDoc.get(d.id);
    return {
      id: d.id,
      title: d.title,
      type: d.type,
      status: d.status,
      updatedAt: d.updatedAt.toISOString(),
      latest: a?.latest ?? null,
      count: a?.count ?? 0,
      isNew: d.createdRecent,
      // 버전이 2개 이상(재생성·에이전트 갱신)이고 24h 이내 갱신된 경우만 "Update".
      isUpdated: d.updatedRecent && (a?.count ?? 0) > 1,
    };
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <DocsFolderView docs={cards} typeLabels={DOC_TYPE_LABELS} />
    </main>
  );
}
