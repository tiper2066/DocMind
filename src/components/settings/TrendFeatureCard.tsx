"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

// 관리자(하드코딩 단일 계정) 전용 — KB "최신 지식 및 동향" 기능 숨김(강제 OFF).
export function TrendFeatureCard({ initialHidden }: { initialHidden: boolean }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(initialHidden);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/kb/trend", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featureHidden: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(
          next
            ? "최신 지식 및 동향 기능을 숨겼습니다 (수집도 중지됨)."
            : "최신 지식 및 동향 기능을 다시 표시합니다.",
        );
        router.refresh();
      } catch (err) {
        setHidden(!next);
        toast.error(`설정 실패: ${(err as Error).message}`);
      }
    });
  };

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="block text-sm font-medium text-ink">
            최신 지식 및 동향 숨김
          </span>
          <span className="mt-0.5 block text-xs text-steel">
            지식 베이스의 검색 스위치·탭·수집 자료를 모든 사용자에게 숨기고
            자동 수집을 끕니다. (관리자 전용)
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={hidden}
          aria-label="최신 지식 및 동향 숨김"
          disabled={pending}
          onClick={toggle}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60",
            hidden
              ? "border-transparent bg-primary"
              : "border-hairline-strong bg-canvas",
          )}
        >
          <span
            className={cn(
              "inline-block size-4 rounded-full transition-transform",
              hidden ? "translate-x-6 bg-on-primary" : "translate-x-1 bg-steel",
            )}
          />
        </button>
      </div>
    </div>
  );
}
