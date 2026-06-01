"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ApprovalActions({ approvalId }: { approvalId: string }) {
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
        if (decision === "approve") {
          const slack = body?.notify?.slack;
          if (slack === "failed") {
            toast.warning("발행 승인됨 — Slack 발송 실패, 수동 공유가 필요합니다");
          } else if (slack === "sent") {
            toast.success("발행 승인됨 · Slack 알림 발송 완료");
          } else {
            toast.success("발행 승인됨");
          }
        } else {
          toast.success("거부됨");
        }
        router.refresh();
      } catch (err) {
        toast.error(`처리 실패: ${(err as Error).message}`);
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => decide("approve")}>
        발행 승인
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => decide("reject")}
      >
        나중에
      </Button>
    </div>
  );
}
