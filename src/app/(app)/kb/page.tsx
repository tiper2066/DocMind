import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { agents, sources, sourceChunks } from "@/db/schema";
import { getWorkspaceContext } from "@/lib/rbac";
import { canToggleTrend, trendFeatureHidden } from "@/lib/trend-admin";
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
import { TrendSwitch } from "@/components/kb/TrendSwitch";
import {
  SourcePagination,
  type KbTab,
} from "@/components/kb/SourcePagination";

type Source = typeof sources.$inferSelect;
type SourceWithCount = Source & { chunkCount: number };

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function paginate<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  return {
    items: items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    page: current,
    totalPages,
  };
}

export default async function KbPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    p_url?: string;
    p_file?: string;
    p_trend?: string;
  }>;
}) {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  const sp = await searchParams;
  const activeTab: KbTab = ["url", "file", "trend"].includes(sp.tab ?? "")
    ? (sp.tab as KbTab)
    : "url";
  const pages: Record<KbTab, number> = {
    url: parsePage(sp.p_url),
    file: parsePage(sp.p_file),
    trend: parsePage(sp.p_trend),
  };

  const rows = await db
    .select({
      id: sources.id,
      workspaceId: sources.workspaceId,
      kind: sources.kind,
      origin: sources.origin,
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

  const urlAll = rows.filter((s) => s.kind === "url" && s.origin !== "trend");
  const fileAll = rows.filter((s) => s.kind === "file");
  // trend 소스는 성공분만 insert 되므로 항상 ready — 실패 카드가 존재하지 않는다.
  const trendAll = rows.filter((s) => s.origin === "trend");
  const anyCrawling = rows.some((s) => s.status === "crawling");

  const urlPg = paginate(urlAll, pages.url);
  const filePg = paginate(fileAll, pages.file);
  const trendPg = paginate(trendAll, pages.trend);
  const clampedPages: Record<KbTab, number> = {
    url: urlPg.page,
    file: filePg.page,
    trend: trendPg.page,
  };

  const [trendAgent] = await db
    .select({ autoRun: agents.autoRun, configJson: agents.configJson })
    .from(agents)
    .where(
      and(eq(agents.workspaceId, ctx.workspaceId), eq(agents.kind, "trend")),
    )
    .limit(1);
  const trendEnabled = trendAgent?.autoRun ?? false;
  const trendToggleAllowed = await canToggleTrend(ctx.userId);
  // 설정에서 기능 숨김 시 스위치·trend 탭·수집 카드 전부 비노출 (수집도 강제 OFF 상태).
  const trendHidden = trendFeatureHidden(trendAgent?.configJson);
  const effectiveTab: KbTab =
    trendHidden && activeTab === "trend" ? "url" : activeTab;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-heading-3 text-ink">지식 베이스</h1>
          <p className="text-body-sm text-steel">
            사내 URL · 파일을 등록하면 AI 가 학습합니다.
          </p>
        </div>
        {!trendHidden && (
          <TrendSwitch
            initialEnabled={trendEnabled}
            canToggle={trendToggleAllowed}
          />
        )}
      </div>

      <KbFolderTabs>
        <Tabs defaultValue={effectiveTab} className="space-y-6">
          <TabsList variant="chip">
            <TabsTrigger value="url">URL ({urlAll.length})</TabsTrigger>
            <TabsTrigger value="file">파일 ({fileAll.length})</TabsTrigger>
            {!trendHidden && (
              <TabsTrigger value="trend">
                최신 지식 및 동향 ({trendAll.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="url" className="space-y-6">
            <UrlInput />
            <SourceGrid sources={urlPg.items} emptyHint="등록된 URL 이 없습니다." />
            <SourcePagination
              tab="url"
              page={urlPg.page}
              totalPages={urlPg.totalPages}
              pages={clampedPages}
            />
          </TabsContent>

          <TabsContent value="file" className="space-y-6">
            <DropZone />
            <SourceGrid sources={filePg.items} emptyHint="업로드된 파일이 없습니다." />
            <SourcePagination
              tab="file"
              page={filePg.page}
              totalPages={filePg.totalPages}
              pages={clampedPages}
            />
          </TabsContent>

          {!trendHidden && (
            <TabsContent value="trend" className="space-y-6">
              <p className="text-body-sm text-steel">
                스위치가 켜져 있는 동안 AI 가 지식 베이스의 주제를 기반으로 매일
                12시·24시(워크스페이스 기준시간)에 관련 최신 자료를 자동
                수집합니다. 켜는 즉시 1회 수집합니다.
              </p>
              <SourceGrid
                sources={trendPg.items}
                emptyHint={
                  trendEnabled
                    ? "수집된 자료가 아직 없습니다. 수집에는 수 분이 걸릴 수 있습니다."
                    : "우측 상단의 '최신 지식 및 동향 검색' 스위치를 켜면 AI 가 관련 최신 자료를 수집합니다."
                }
              />
              <SourcePagination
                tab="trend"
                page={trendPg.page}
                totalPages={trendPg.totalPages}
                pages={clampedPages}
              />
            </TabsContent>
          )}
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
              <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface/95 p-1 shadow-elevation-2 ring-1 ring-hairline backdrop-blur-sm">
                {s.url && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="원문 페이지 열기"
                    className="inline-flex size-8 items-center justify-center rounded-md bg-canvas text-stone transition-colors hover:bg-brand/10 hover:text-brand"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                )}
                <SourceActions sourceId={s.id} title={title} kind={s.kind} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
