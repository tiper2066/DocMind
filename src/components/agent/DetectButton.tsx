"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DetectButton({
  agentId,
  canAct = true,
}: {
  agentId: string;
  canAct?: boolean;
}) {
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
        toast.success("감지 시작 — 변경이 발견되면 자동으로 표시됩니다");
        // 기본 갱신은 SSE 이벤트 기반(AgentDocs) — 아래는 SSE 누락 대비 폴백.
        setTimeout(() => router.refresh(), 6000);
        setTimeout(() => router.refresh(), 15000);
      } catch (err) {
        toast.error(`트리거 실패: ${(err as Error).message}`);
      }
    });
  };

  return (
    // disabled 요소는 hover 이벤트가 안 떠서 툴팁은 래퍼 span 에 단다.
    <span title={canAct ? undefined : "데모 버전이므로 발표자만 사용 가능합니다."}>
      <Button onClick={trigger} disabled={pending || !canAct}>
        {pending ? "감지 중..." : "지금 감지"}
      </Button>
    </span>
  );
}
