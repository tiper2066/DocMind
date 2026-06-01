"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ScheduleActions({
  scheduleId,
  enabled,
}: {
  scheduleId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const call = (method: "PATCH" | "DELETE", body?: object, okMsg?: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/schedules/${scheduleId}`, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b?.error ?? `HTTP ${res.status}`);
        }
        if (okMsg) toast.success(okMsg);
        router.refresh();
      } catch (err) {
        toast.error(`실패: ${(err as Error).message}`);
      }
    });
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => call("PATCH", { enabled: !enabled }, enabled ? "비활성화됨" : "활성화됨")}
      >
        {enabled ? "비활성화" : "활성화"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => call("DELETE", undefined, "삭제됨")}
      >
        삭제
      </Button>
    </div>
  );
}
