import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { sources, sourceChunks } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import {
  Sheet,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KbFolderTabs } from "@/components/kb/KbFolderTabs";
import { SourceCard } from "@/components/kb/SourceCard";
import { SourceSheet } from "@/components/kb/SourceSheet";
import { SourceActions } from "@/components/kb/SourceActions";
import { UrlInput } from "@/components/kb/UrlInput";
import { DropZone } from "@/components/kb/DropZone";
import { KbAutoRefresh } from "@/components/kb/KbAutoRefresh";

type Source = typeof sources.$inferSelect;
type SourceWithCount = Source & { chunkCount: number };

export const dynamic = "force-dynamic";

export default async function KbPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const rows = await db
    .select({
      id: sources.id,
      workspaceId: sources.workspaceId,
      kind: sources.kind,
      url: sources.url,
      fileKey: sources.fileKey,
      title: sources.title,
      summary: sources.summary,
      tags: sources.tags,
      status: sources.status,
      lastCrawledAt: sources.lastCrawledAt,
      contentHash: sources.contentHash,
      fingerprint: sources.fingerprint,
      createdAt: sources.createdAt,
      updatedAt: sources.updatedAt,
      chunkCount: sql<number>`(SELECT COUNT(*)::int FROM ${sourceChunks} WHERE ${sourceChunks.sourceId} = ${sources.id})`,
    })
    .from(sources)
    .where(eq(sources.workspaceId, ctx.workspaceId))
    .orderBy(desc(sources.createdAt));

  const urlSources = rows.filter((s) => s.kind === "url");
  const fileSources = rows.filter((s) => s.kind === "file");
  const anyCrawling = rows.some((s) => s.status === "crawling");

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-1">
        <h1 className="font-heading text-heading-3 text-ink">지식 베이스</h1>
        <p className="text-body-sm text-steel">
          사내 URL · 파일을 등록하면 AI 가 학습합니다.
        </p>
      </div>

      <KbFolderTabs>
        <Tabs defaultValue="url" className="space-y-6">
          <TabsList variant="chip">
            <TabsTrigger value="url">URL ({urlSources.length})</TabsTrigger>
            <TabsTrigger value="file">파일 ({fileSources.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-6">
            <UrlInput />
            <SourceGrid sources={urlSources} emptyHint="등록된 URL 이 없습니다." />
          </TabsContent>

          <TabsContent value="file" className="space-y-6">
            <DropZone />
            <SourceGrid sources={fileSources} emptyHint="업로드된 파일이 없습니다." />
          </TabsContent>
        </Tabs>
      </KbFolderTabs>

      <KbAutoRefresh enabled={anyCrawling} />
    </main>
  );
}

function SourceGrid({
  sources,
  emptyHint,
}: {
  sources: SourceWithCount[];
  emptyHint: string;
}) {
  if (sources.length === 0) {
    return (
      <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        {emptyHint}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sources.map((s) => {
        const title =
          s.title ??
          (s.kind === "url"
            ? (s.url ?? "(URL)")
            : (s.fileKey?.split("/").pop() ?? "(파일)"));
        return (
          <div key={s.id} className="group relative">
            <Sheet>
              <SheetTrigger className="block w-full text-left">
                <SourceCard source={s} />
              </SheetTrigger>
              <SourceSheet source={s} chunkCount={s.chunkCount} />
            </Sheet>
            {/* 평소 숨김 → hover/포커스 시 카드 정중앙에 액션 표시 + 어두운 스크림. */}
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-ink-deep/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
              <div className="pointer-events-auto rounded-full bg-surface/95 p-1 shadow-elevation-2 ring-1 ring-hairline backdrop-blur-sm">
                <SourceActions sourceId={s.id} title={title} kind={s.kind} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
