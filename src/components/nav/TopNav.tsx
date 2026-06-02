import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth-actions";
import { NavLink } from "./NavLink";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNav } from "./MobileNav";
import { NAV_ITEMS } from "./items";

export async function TopNav() {
  const session = await auth();

  return (
    <header className="border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-heading text-heading-5 text-brand">
            Mind5
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((it) => (
              <NavLink key={it.href} href={it.href}>
                {it.label}
              </NavLink>
            ))}
            {/* Phase 5: RunningBadge slot — agent_runs.status='running' 카운트 표시 */}
          </nav>
        </div>

        {/* 데스크탑 우측 */}
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-sm text-steel">{session?.user?.email}</span>
          <ThemeToggle />
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              로그아웃
            </Button>
          </form>
        </div>

        {/* 모바일 우측 — 테마 토글 + 햄버거(→ Sheet 드로어) */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <MobileNav email={session?.user?.email} />
        </div>
      </div>
    </header>
  );
}
