import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { sources } from "@/db/schema";

type Source = typeof sources.$inferSelect;

export function SourceSheet({
  source,
  chunkCount,
}: {
  source: Source;
  chunkCount: number;
}) {
  const title = source.title ?? "(제목 없음)";
  const subtitle =
    source.kind === "url"
      ? (source.url ?? "")
      : (source.fileKey?.split("/").pop() ?? "");

  return (
    <SheetContent className="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader>
        <SheetTitle className="break-words">{title}</SheetTitle>
        {subtitle && (
          <SheetDescription className="break-all text-xs">
            {subtitle}
          </SheetDescription>
        )}
      </SheetHeader>

      <div className="space-y-5 px-4">
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-on-primary transition-opacity hover:opacity-90"
          >
            <ExternalLink className="size-4" aria-hidden />
            원문 페이지 열기
          </a>
        )}
        <Row label="상태" value={<StatusValue status={source.status} />} />
        <Row label="종류" value={source.kind === "url" ? "URL" : "파일"} />
        <Row label="청크 수" value={String(chunkCount)} />
        <Row
          label="마지막 학습"
          value={
            source.lastCrawledAt
              ? new Date(source.lastCrawledAt).toLocaleString("ko-KR")
              : "—"
          }
        />

        {source.summary && (
          <>
            <Separator />
            <section className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">요약</h4>
              <p className="text-sm leading-relaxed">{source.summary}</p>
            </section>
          </>
        )}

        {source.tags && source.tags.length > 0 && (
          <>
            <Separator />
            <section className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">태그</h4>
              <div className="flex flex-wrap gap-1">
                {source.tags.map((t) => (
                  <Badge key={t} variant="tag-purple">
                    {t}
                  </Badge>
                ))}
              </div>
            </section>
          </>
        )}

        {source.contentHash && (
          <>
            <Separator />
            <section className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                content_hash
              </h4>
              <code className="break-all text-xs text-muted-foreground">
                {source.contentHash}
              </code>
            </section>
          </>
        )}
      </div>
    </SheetContent>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function StatusValue({ status }: { status: string }) {
  if (status === "ready")
    return (
      <Badge className="border-transparent bg-success text-on-primary">
        ready
      </Badge>
    );
  if (status === "error") return <Badge variant="destructive">error</Badge>;
  return (
    <Badge className="border-transparent bg-warning/15 text-warning">
      crawling…
    </Badge>
  );
}
