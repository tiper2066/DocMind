"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DetectButton({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const trigger = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/agent/run/${agentId}/trigger`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        toast.success("감지 시작 — 잠시 후 새로고침하면 활동이 보입니다");
        setTimeout(() => router.refresh(), 4000);
      } catch (err) {
        toast.error(`트리거 실패: ${(err as Error).message}`);
      }
    });
  };

  return (
    <Button onClick={trigger} disabled={pending}>
      {pending ? "감지 중..." : "지금 감지"}
    </Button>
  );
}
