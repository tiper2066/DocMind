import { File, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { sources } from "@/db/schema";

type Source = typeof sources.$inferSelect;

export function SourceCard({ source }: { source: Source }) {
  const Icon = source.kind === "url" ? Globe : File;
  const subtitle =
    source.kind === "url"
      ? source.url ?? ""
      : source.fileKey?.split("/").pop() ?? "";
  const title = source.title ?? defaultTitle(source);

  return (
    <Card className="flex h-full w-full flex-col gap-3 p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-surface hover:shadow-elevation-2">
      <div className="flex items-start justify-between gap-3 pr-9">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <StatusChip status={source.status} />
      </div>
      {subtitle && (
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      )}
      {source.summary && (
        <p className="line-clamp-3 text-xs text-muted-foreground">
          {source.summary}
        </p>
      )}
      {source.tags && source.tags.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          {source.tags.slice(0, 5).map((tag) => (
            <Badge key={tag} variant="tag-purple" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <Badge className="shrink-0 border-transparent bg-success text-on-primary">
        ready
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="shrink-0">
        error
      </Badge>
    );
  }
  return (
    <Badge className="shrink-0 border-transparent bg-warning/15 text-warning">
      crawling…
    </Badge>
  );
}

function defaultTitle(s: Source): string {
  if (s.kind === "url" && s.url) {
    try {
      return new URL(s.url).hostname;
    } catch {
      return s.url;
    }
  }
  if (s.fileKey) return s.fileKey.split("/").pop() ?? "(파일)";
  return "(제목 없음)";
}
