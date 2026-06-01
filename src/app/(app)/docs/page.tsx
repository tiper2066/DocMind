import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, documentVersions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { DOC_TYPE_LABELS } from "@/lib/interview/machine";
import { Badge } from "@/components/ui/badge";
import { DocActions } from "@/components/docs/DocActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_FILTERS = [
  { key: "", label: "전체 유형" },
  ...Object.entries(DOC_TYPE_LABELS).map(([key, label]) => ({ key, label })),
];
const STATUS_FILTERS = [
  { key: "", label: "전체 상태" },
  { key: "ready", label: "완료" },
  { key: "draft", label: "초안" },
];

function buildHref(params: { type?: string; status?: string }): string {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.status) sp.set("status", params.status);
  const q = sp.toString();
  return q ? `/docs?${q}` : "/docs";
}

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  const { type = "", status = "" } = await searchParams;

  const conds = [eq(documents.workspaceId, ctx.workspaceId)];
  if (type) conds.push(eq(documents.type, type));
  if (status) conds.push(eq(documents.status, status));

  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      type: documents.type,
      status: documents.status,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(...conds))
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="font-heading text-heading-3 text-ink">문서함</h1>
      <p className="mt-1 mb-6 text-body-sm text-steel">
        생성·갱신된 문서와 버전 이력을 확인합니다.
      </p>

      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <Link key={f.key || "all"} href={buildHref({ type: f.key, status })}>
              <Badge variant={type === f.key ? "default" : "outline"}>
                {f.label}
              </Badge>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <Link key={f.key || "all"} href={buildHref({ type, status: f.key })}>
              <Badge variant={status === f.key ? "default" : "outline"}>
                {f.label}
              </Badge>
            </Link>
          ))}
        </div>
      </div>

      {docs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          조건에 맞는 문서가 없습니다.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => {
            const a = aggByDoc.get(d.id);
            return (
              <li key={d.id} className="relative">
                <Link
                  href={`/docs/${d.id}`}
                  className="block rounded-lg bg-canvas p-4 pr-12 ring-1 ring-hairline transition duration-200 hover:-translate-y-0.5 hover:bg-surface hover:shadow-elevation-2"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="secondary">
                      {DOC_TYPE_LABELS[d.type] ?? d.type}
                    </Badge>
                    <Badge variant={d.status === "ready" ? "outline" : "ghost"}>
                      {d.status === "ready" ? "완료" : "초안"}
                    </Badge>
                  </div>
                  <div className="line-clamp-2 text-sm font-medium">{d.title}</div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {a ? `v${a.latest} · ${a.count}개 버전` : "버전 없음"} ·{" "}
                    {d.updatedAt.toLocaleDateString("ko-KR")}
                  </div>
                </Link>
                <div className="absolute top-3 right-3 z-10">
                  <DocActions docId={d.id} title={d.title} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
