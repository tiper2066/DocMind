"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="테마 전환"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* .dark 클래스 기반 CSS 토글 — next-themes 인라인 스크립트가 hydration 전에 설정해 미스매치 없음 */}
      <Moon className="block dark:hidden" />
      <Sun className="hidden dark:block" />
      <span className="sr-only">테마 전환</span>
    </Button>
  );
}
