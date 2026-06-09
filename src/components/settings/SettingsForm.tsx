"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SettingsForm({
  initial,
}: {
  initial: {
    autoRun: boolean;
    publish: "manual" | "auto";
    notifyChannel: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [autoRun, setAutoRun] = useState(initial.autoRun);
  const [publish, setPublish] = useState<"manual" | "auto">(initial.publish);
  const [notifyChannel, setNotifyChannel] = useState(initial.notifyChannel);
  const [email, setEmail] = useState(""); // 데모 플레이스홀더 — 저장하지 않음

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
    <div className="flex h-full flex-col rounded-xl border border-hairline bg-canvas p-6">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="block text-sm font-medium text-ink">자동 실행</span>
            <span className="mt-0.5 block text-xs text-steel">
              지식 베이스의 소스 변경 감지 시 에이전트를 자동 실행합니다.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoRun}
            aria-label="자동 실행"
            onClick={() => setAutoRun((v) => !v)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
              autoRun
                ? "border-transparent bg-primary"
                : "border-hairline-strong bg-canvas",
            )}
          >
            <span
              className={cn(
                "inline-block size-4 rounded-full transition-transform",
                autoRun
                  ? "translate-x-6 bg-on-primary"
                  : "translate-x-1 bg-steel",
              )}
            />
          </button>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="block text-sm font-medium text-ink">문서 발행</span>
            <span className="mt-0.5 block text-xs text-steel">
              문서 발행 승인을 수동 또는 자동으로 발행합니다.
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              variant={publish === "manual" ? "default" : "outline"}
              onClick={() => setPublish("manual")}
            >
              수동
            </Button>
            <Button
              type="button"
              size="sm"
              variant={publish === "auto" ? "default" : "outline"}
              onClick={() => setPublish("auto")}
            >
              자동
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink">Slack 알림</span>
          <span className="block text-xs text-steel">
            문서 발행 후 Slack으로 알림이 갑니다. 비우면 기본값(#docmind-demo)을
            사용합니다.
          </span>
          <Input
            value={notifyChannel}
            onChange={(e) => setNotifyChannel(e.target.value)}
            placeholder="C0XXXXXXXXX 또는 #docmind-demo"
          />
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink">Email 알림</span>
          <span className="block text-xs text-steel">
            문서 발행 후 Email로 알림이 갑니다.
          </span>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@pentasecurity.com"
          />
        </div>
      </div>

      <div className="mt-auto flex justify-center pt-8">
        <Button onClick={save} disabled={pending} className="px-10">
          {pending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </div>
  );
}
