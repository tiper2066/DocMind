import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { documents, documentVersions } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { DOC_TYPE_LABELS } from "@/lib/interview/machine";
import { diffDecks, diffStats } from "@/lib/diff";
import { Badge } from "@/components/ui/badge";
import { DocActions } from "@/components/docs/DocActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function versionStatusBadge(status: string) {
  if (status === "published") return { variant: "secondary" as const, label: "발행됨" };
  if (status === "rejected") return { variant: "destructive" as const, label: "거부됨" };
  return { variant: "outline" as const, label: "초안" };
}

export default async function DocDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ base?: string; target?: string }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");
  const { id } = await params;
  const { base: baseParam, target: targetParam } = await searchParams;

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.workspaceId, ctx.workspaceId)))
    .limit(1);
  if (!doc) notFound();

  const versions = await db
    .select({
      id: documentVersions.id,
      version: documentVersions.version,
      status: documentVersions.status,
      changeNote: documentVersions.changeNote,
      slidesJson: documentVersions.slidesJson,
      createdAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, id))
    .orderBy(desc(documentVersions.version));

  const latest = versions[0] ?? null;
  const target =
    versions.find((v) => v.id === targetParam) ?? latest;
  const base =
    versions.find((v) => v.id === baseParam) ??
    versions.find((v) => target && v.version === target.version - 1) ??
    null;

  const rows = base && target ? diffDecks(base.slidesJson, target.slidesJson) : [];
  const stats = diffStats(rows);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/docs" className="text-sm text-muted-foreground hover:underline">
        ← 문서함
      </Link>
      <div className="mt-2 mb-6">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary">{DOC_TYPE_LABELS[doc.type] ?? doc.type}</Badge>
          <Badge variant={doc.status === "ready" ? "outline" : "ghost"}>
            {doc.status === "ready" ? "완료" : "초안"}
          </Badge>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-heading-3 text-ink">{doc.title}</h1>
            <p className="mt-1 text-body-sm text-steel">
              {[
                doc.reader && `독자: ${doc.reader}`,
                doc.cta && `CTA: ${doc.cta}`,
                doc.objection && `반론: ${doc.objection}`,
                doc.lengthPages && `${doc.lengthPages}장`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <DocActions docId={doc.id} title={doc.title} redirectTo="/docs" />
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            버전 타임라인
          </h2>
          <ol className="space-y-3">
            {versions.map((v) => {
              const b = versionStatusBadge(v.status);
              const isTarget = target?.id === v.id;
              const isBase = base?.id === v.id;
              return (
                <li
                  key={v.id}
                  className={
                    isTarget || isBase
                      ? "rounded-lg border-2 border-primary p-3"
                      : "rounded-lg border p-3"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">v{v.version}</span>
                    <Badge variant={b.variant}>{b.label}</Badge>
                  </div>
                  {v.changeNote && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {v.changeNote}
                    </p>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {v.createdAt.toLocaleString("ko-KR")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <Link
                      href={`/deck/${v.id}`}
                      className="text-primary hover:underline"
                    >
                      미리보기
                    </Link>
                    <a
                      href={`/api/generate/${v.id}/pptx`}
                      className="text-primary hover:underline"
                    >
                      .pptx
                    </a>
                    {latest && v.id !== latest.id && (
                      <Link
                        href={`/docs/${id}?base=${v.id}&target=${latest.id}`}
                        className="text-muted-foreground hover:underline"
                      >
                        최신과 비교
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              버전 비교
            </h2>
            {base && target && (
              <span className="text-xs text-muted-foreground">
                v{base.version} → v{target.version} ·{" "}
                <span className="font-medium text-success">+{stats.added}</span>{" "}
                <span className="font-medium text-error">−{stats.removed}</span>
              </span>
            )}
          </div>

          {!base || !target ? (
            <p className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
              비교할 이전 버전이 없습니다.
            </p>
          ) : stats.added === 0 && stats.removed === 0 ? (
            <p className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
              두 버전의 내용이 동일합니다.
            </p>
          ) : (
            <pre className="overflow-x-auto rounded-lg border p-4 text-xs leading-6">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className={
                    r.type === "add"
                      ? "bg-success/10 text-success"
                      : r.type === "del"
                        ? "bg-error/10 text-error"
                        : "text-muted-foreground"
                  }
                >
                  <span className="select-none opacity-60">
                    {r.type === "add" ? "+ " : r.type === "del" ? "− " : "  "}
                  </span>
                  {r.text}
                </div>
              ))}
            </pre>
          )}
        </section>
      </div>
    </main>
  );
}
