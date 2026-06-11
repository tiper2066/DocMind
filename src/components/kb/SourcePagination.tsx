import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type KbTab = "url" | "file" | "trend";

// 탭별 독립 페이지 파라미터(p_url/p_file/p_trend) + tab 파라미터(이동 후 활성 탭 유지).
// 서버 컴포넌트 — 링크 네비게이션만 사용, 클라이언트 상태 없음.
export function SourcePagination({
  tab,
  page,
  totalPages,
  pages,
}: {
  tab: KbTab;
  page: number;
  totalPages: number;
  pages: Record<KbTab, number>;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams({ tab });
    const next = { ...pages, [tab]: p };
    for (const key of ["url", "file", "trend"] as const) {
      if (next[key] > 1) sp.set(`p_${key}`, String(next[key]));
    }
    return `/kb?${sp.toString()}`;
  };

  // 현재 페이지 주변 최대 5개 번호 노출.
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <nav
      aria-label="페이지 이동"
      className="flex items-center justify-center gap-1 pt-2"
    >
      <PageLink
        href={href(page - 1)}
        disabled={page <= 1}
        ariaLabel="이전 페이지"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </PageLink>
      {start > 1 && <span className="px-1 text-sm text-steel">…</span>}
      {numbers.map((n) => (
        <PageLink
          key={n}
          href={href(n)}
          active={n === page}
          ariaLabel={`${n} 페이지`}
        >
          {n}
        </PageLink>
      ))}
      {end < totalPages && <span className="px-1 text-sm text-steel">…</span>}
      <PageLink
        href={href(page + 1)}
        disabled={page >= totalPages}
        ariaLabel="다음 페이지"
      >
        <ChevronRight className="size-4" aria-hidden />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const cls = cn(
    "inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors",
    active
      ? "bg-primary font-medium text-on-primary"
      : "text-ink hover:bg-brand/10",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) {
    return (
      <span className={cls} aria-disabled aria-label={ariaLabel}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cls}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
