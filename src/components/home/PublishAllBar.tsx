"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { approveAllPending } from "@/lib/approve-client";

export type PendingItem = { id: string; title: string; version: number | null };

export function PublishAllBar({
  items,
  canAct = true,
}: {
  items: PendingItem[];
  // false 면 버튼은 보이되 비활성(발표자 전용) — 서버(API 403)가 실제 방어선.
  canAct?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) return null;

  const first = items[0];
  const rest = items.length - 1;
  const label = `${first.title}${first.version ? ` v${first.version}` : ""} 드래프트${
    rest > 0 ? ` 외 ${rest}건` : ""
  }`;

  const approveAll = () => {
    startTransition(async () => {
      const { ok, total } = await approveAllPending(items.map((it) => it.id));
      if (ok > 0) toast.success(`${ok}건 발행 승인됨`);
      if (ok < total) toast.error(`${total - ok}건 승인 실패`);
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-6 z-40 px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-xl bg-link-blue px-5 py-3 text-on-primary shadow-elevation-2">
        <p className="min-w-0 truncate text-body-sm font-medium">
          <span className="opacity-80">발행 대기 · </span>
          {label}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/agent"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-on-primary hover:bg-white/15 hover:text-on-primary",
            )}
          >
            자세히 보기
          </Link>
          <Button
            size="sm"
            onClick={approveAll}
            disabled={pending || !canAct}
            title={canAct ? undefined : "데모 버전이므로 발표자만 사용 가능합니다."}
            className="bg-white text-link-blue hover:bg-white/90 disabled:opacity-70"
          >
            {pending ? "승인 중…" : canAct ? "전체 발행 승인" : "발표자 전용"}
          </Button>
        </div>
      </div>
    </div>
  );
}
