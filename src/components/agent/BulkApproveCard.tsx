"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveAllPending } from "@/lib/approve-client";
import { PresenterLockTooltip } from "@/components/PresenterLockTooltip";

export type BulkPendingItem = { id: string; title: string; version: number | null };

export function BulkApproveCard({
  items,
  canAct = true,
}: {
  items: BulkPendingItem[];
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
    <div className="rounded-xl bg-link-blue p-5 text-on-primary shadow-elevation-1">
      <p className="text-body-sm font-medium leading-relaxed">{label}</p>
      <PresenterLockTooltip locked={!canAct} className="block">
        <Button
          size="sm"
          onClick={approveAll}
          disabled={pending || !canAct}
          className="mt-4 w-full bg-white text-link-blue hover:bg-white/90 disabled:opacity-70"
        >
          {pending ? "승인 중…" : "전체 발행 승인"}
        </Button>
      </PresenterLockTooltip>
    </div>
  );
}
