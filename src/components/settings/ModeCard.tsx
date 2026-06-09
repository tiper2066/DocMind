"use client";

import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

// 헤더에서 옮겨온 테마 전환 UI. 기능(next-themes)은 그대로, 표기만 Light/Dark 세그먼트.
// resolvedTheme 은 SSR·하이드레이션 초기엔 undefined(서버와 일치) → 마운트 후 확정되며 재렌더.
export function ModeCard() {
  const { resolvedTheme, setTheme } = useTheme();
  const active = resolvedTheme;

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-6">
      <h2 className="font-heading text-heading-5 text-ink">모드</h2>
      <p className="mt-1 text-body-sm text-steel">
        인터페이스 색상을 변경합니다.
      </p>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant={active === "light" ? "default" : "outline"}
          onClick={() => setTheme("light")}
        >
          Light
        </Button>
        <Button
          size="sm"
          variant={active === "dark" ? "default" : "outline"}
          onClick={() => setTheme("dark")}
        >
          Dark
        </Button>
      </div>
    </div>
  );
}
