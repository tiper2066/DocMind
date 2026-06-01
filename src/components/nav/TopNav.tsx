import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { NavLink } from "./NavLink";

export async function TopNav() {
  const session = await auth();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            DocMind
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/">홈</NavLink>
            <NavLink href="/kb">지식 베이스</NavLink>
            <NavLink href="/agent">에이전트</NavLink>
            <NavLink href="/docs">문서함</NavLink>
            <NavLink href="/schedules">스케줄</NavLink>
            <NavLink href="/settings">설정</NavLink>
            {/* Phase 5: RunningBadge slot — agent_runs.status='running' 카운트 표시 */}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {session?.user?.email}
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
