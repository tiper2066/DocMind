import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOutAction } from "@/lib/auth-actions";
import { NavLink } from "./NavLink";
import { MobileNav } from "./MobileNav";
import { NAV_ITEMS } from "./items";

export async function TopNav() {
  const session = await auth();

  return (
    <header className="border-b border-hairline bg-page">
      <div className="mx-auto flex h-21.25 max-w-6xl items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center" aria-label="Mind5 홈">
            <Image
              src="/Mind5.svg"
              alt="Mind5"
              width={96}
              height={27}
              priority
              className="block dark:hidden"
            />
            <Image
              src="/Mind5-dark.svg"
              alt="Mind5"
              width={96}
              height={27}
              priority
              className="hidden dark:block"
            />
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
          <form action={signOutAction}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label="로그아웃"
                  />
                }
              >
                <LogOut className="size-4" />
              </TooltipTrigger>
              <TooltipContent>로그아웃</TooltipContent>
            </Tooltip>
          </form>
        </div>

        {/* 모바일 우측 — 햄버거(→ Sheet 드로어). 테마 전환은 설정 페이지 "모드" 카드로 이동 */}
        <div className="flex items-center gap-1 md:hidden">
          <MobileNav email={session?.user?.email} />
        </div>
      </div>
    </header>
  );
}
