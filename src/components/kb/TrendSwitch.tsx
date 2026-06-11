"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { PresenterLockTooltip } from "@/components/PresenterLockTooltip";

// ON 직후 수집 결과가 카드로 나타나도록 잠시 주기 새로고침 (SSE 없는 화면의 데모 보조).
const REFRESH_MS = 8000;
const REFRESH_TOTAL_MS = 2 * 60 * 1000;

export function TrendSwitch({
  initialEnabled,
  canToggle = true,
}: {
  initialEnabled: boolean;
  // false 면 스위치는 보이되 비활성(관리자 전용) — 서버(API 403)가 실제 방어선.
  canToggle?: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const timers = useRef<{ interval?: number; timeout?: number }>({});

  useEffect(() => {
    const t = timers.current;
    return () => {
      if (t.interval) window.clearInterval(t.interval);
      if (t.timeout) window.clearTimeout(t.timeout);
    };
  }, []);

  const startRefreshing = () => {
    const t = timers.current;
    if (t.interval) window.clearInterval(t.interval);
    if (t.timeout) window.clearTimeout(t.timeout);
    t.interval = window.setInterval(() => router.refresh(), REFRESH_MS);
    t.timeout = window.setTimeout(() => {
      if (t.interval) window.clearInterval(t.interval);
    }, REFRESH_TOTAL_MS);
  };

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setPending(true);
    try {
      const res = await fetch("/api/kb/trend", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (next) {
        toast.success(
          "최신 동향 수집을 시작했습니다. 완료된 자료부터 카드로 표시됩니다.",
        );
        startRefreshing();
      } else {
        toast.success("최신 동향 자동 검색을 껐습니다.");
      }
      router.refresh();
    } catch (err) {
      setEnabled(!next);
      toast.error(`설정 실패: ${(err as Error).message}`);
    } finally {
      setPending(false);
    }
  };

  const disabled = pending || !canToggle;

  return (
    <div className="flex min-w-0 flex-col items-end gap-1.5">
      {/* 모바일: 스위치 위·문구 아래 세로 스택(타이틀 줄바꿈 방지), sm 이상: 한 줄. */}
      <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span
        className={`order-2 whitespace-nowrap text-sm font-medium sm:order-1 ${
          canToggle ? "text-ink" : "text-steel"
        }`}
      >
        최신 지식 및 동향 검색
      </span>
      <PresenterLockTooltip
        locked={!canToggle}
        className="order-1 inline-flex shrink-0 sm:order-2"
      >
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="최신 지식 및 동향 검색"
        aria-disabled={!canToggle || undefined}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          "relative order-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60 sm:order-2",
          !canToggle && "pointer-events-none",
          enabled
            ? "border-transparent bg-primary"
            : "border-hairline-strong bg-canvas",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full transition-transform",
            enabled ? "translate-x-6 bg-on-primary" : "translate-x-1 bg-steel",
          )}
        />
        </button>
      </PresenterLockTooltip>
      </div>
      <p className="max-w-55 text-right text-xs leading-snug break-keep text-destructive sm:max-w-none">
        최신 동향을 반영하지만, 일부 부정확한 정보가 포함될 수 있습니다.
      </p>
    </div>
  );
}
