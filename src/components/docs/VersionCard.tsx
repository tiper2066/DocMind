"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PptxDownloadLink } from "./PptxDownloadLink";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

// 버전 타임라인 카드. compareHref 가 있으면(=최신이 아니면) 카드 표면 전체가
// "최신과 비교" 오버레이 링크가 되고, 안쪽 미리보기/다운로드 버튼만 z-10 으로 올려
// 중첩 인터랙티브 없이 클릭을 분리한다. 최신 카드는 비교 대상이 없어 비활성.
export function VersionCard({
  versionId,
  versionLabel,
  statusVariant,
  statusLabel,
  changeNote,
  createdAtLabel,
  previewHref,
  compareHref,
  selected,
  isLatest,
}: {
  versionId: string;
  versionLabel: string;
  statusVariant: BadgeVariant;
  statusLabel: string;
  changeNote: string | null;
  createdAtLabel: string;
  previewHref: string;
  compareHref: string | null;
  selected: boolean;
  isLatest: boolean;
}) {
  return (
    <li
      className={cn(
        "relative rounded-lg border p-3 transition-colors",
        // 최신 버전 카드는 검정 테두리(기본 선택 표시보다 우선).
        isLatest
          ? "border-2 border-ink-deep"
          : selected && "border-2 border-primary",
        compareHref && "cursor-pointer hover:bg-muted/50",
      )}
    >
      {compareHref && (
        <Link
          href={compareHref}
          aria-label={`${versionLabel}을(를) 최신 버전과 비교`}
          className="absolute inset-0 z-0 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        />
      )}

      <div className="pointer-events-none flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{versionLabel}</span>
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </div>
      {changeNote && (
        <p className="pointer-events-none mt-1 line-clamp-2 text-xs text-muted-foreground">
          {changeNote}
        </p>
      )}
      <div className="pointer-events-none mt-1 text-xs text-muted-foreground">
        {createdAtLabel}
      </div>

      <div className="relative z-10 mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Link
          href={previewHref}
          className={cn(buttonVariants({ variant: "dark" }), "px-3 py-1.5 text-xs")}
        >
          미리보기
        </Link>
        <PptxDownloadLink versionId={versionId} />
      </div>
    </li>
  );
}
