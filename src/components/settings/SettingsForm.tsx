"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function SettingsForm({
  initial,
}: {
  initial: { autoRun: boolean; publish: "manual" | "auto"; notifyChannel: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [autoRun, setAutoRun] = useState(initial.autoRun);
  const [publish, setPublish] = useState<"manual" | "auto">(initial.publish);
  const [notifyChannel, setNotifyChannel] = useState(initial.notifyChannel);

  const save = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoRun, publish, notifyChannel }),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b?.error ?? `HTTP ${res.status}`);
        }
        toast.success("설정 저장됨");
        router.refresh();
      } catch (err) {
        toast.error(`저장 실패: ${(err as Error).message}`);
      }
    });
  };

  return (
    <div className="space-y-5 rounded-lg border p-4">
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="text-sm font-medium">자동 실행</span>
          <span className="block text-xs text-muted-foreground">
            소스 변경 감지 시 에이전트 루프를 자동으로 돌립니다.
          </span>
        </span>
        <input
          type="checkbox"
          checked={autoRun}
          onChange={(e) => setAutoRun(e.target.checked)}
          className="size-4"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">발행 정책</span>
        <span className="block text-xs text-muted-foreground">
          manual = 승인 큐만 생성 / auto = 자동 발행. Slack·메일은 정책과 무관하게 항상 승인 후 발송.
        </span>
        <select
          value={publish}
          onChange={(e) => setPublish(e.target.value as "manual" | "auto")}
          className={`${selectCls} mt-1`}
        >
          <option value="manual">manual (수동 승인)</option>
          <option value="auto">auto (자동 발행)</option>
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Slack 알림 채널</span>
        <span className="block text-xs text-muted-foreground">
          채널 ID(C0…) 또는 #채널명. 비우면 기본값(#docmind-demo / 환경변수)을 사용합니다.
        </span>
        <Input
          value={notifyChannel}
          onChange={(e) => setNotifyChannel(e.target.value)}
          placeholder="C0XXXXXXXXX 또는 #docmind-demo"
          className="mt-1"
        />
      </label>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}
