"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PresenterLockTooltip } from "@/components/PresenterLockTooltip";

export type ApproveResult = {
  notify?: { slack?: string; email?: string } | null;
  resumed?: boolean;
};

export function ApprovalActions({
  approvalId,
  onApproved,
  canAct = true,
}: {
  approvalId: string;
  // 지정 시 승인 성공 후 기본 토스트/refresh 를 생략하고 부모가 연출을 이어받는다.
  onApproved?: (body: ApproveResult) => void;
  // false 면 버튼은 보이되 비활성(발표자 전용) — 서버(API 403)가 실제 방어선.
  canAct?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const decide = (decision: "approve" | "reject") => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/agent/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalId, decision }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        if (decision === "approve" && onApproved) {
          onApproved(body as ApproveResult);
          return;
        }
        if (decision === "approve") {
          if (body?.resumed) {
            toast.success(
              "발행 승인됨 — 인식→판단→행동→학습 단계를 진행해 문서를 갱신합니다",
            );
          } else {
            const slack = body?.notify?.slack;
            if (slack === "failed") {
              toast.warning(
                "발행 승인됨 — Slack 발송 실패, 수동 공유가 필요합니다",
              );
            } else if (slack === "sent") {
              toast.success("발행 승인됨 · Slack 알림 발송 완료");
            } else {
              toast.success("발행 승인됨");
            }
          }
        } else {
          toast.success("승인 거부됨 — 문서를 갱신하지 않습니다");
        }
        router.refresh();
      } catch (err) {
        toast.error(`처리 실패: ${(err as Error).message}`);
      }
    });
  };

  return (
    <PresenterLockTooltip locked={!canAct} className="inline-flex">
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || !canAct}
          onClick={() => decide("approve")}
        >
          발행 승인
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !canAct}
          className="text-destructive hover:text-destructive"
          onClick={() => decide("reject")}
        >
          승인 거부
        </Button>
      </div>
    </PresenterLockTooltip>
  );
}
