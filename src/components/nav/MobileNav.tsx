"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOutAction } from "@/lib/auth-actions";
import { NAV_ITEMS } from "./items";

export function MobileNav({ email }: { email?: string | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="메뉴 열기" />}
      >
        <Menu />
      </SheetTrigger>

      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center"
              aria-label="Mind5 홈"
            >
              <Image
                src="/Mind5.svg"
                alt="Mind5"
                width={71}
                height={20}
                className="block dark:hidden"
              />
              <Image
                src="/Mind5-dark.svg"
                alt="Mind5"
                width={71}
                height={20}
                className="hidden dark:block"
              />
            </Link>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((it) => {
            const Icon = it.icon;
            const active = isActive(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-base transition-colors",
                  active
                    ? "bg-surface font-medium text-brand"
                    : "text-ink hover:bg-surface hover:text-brand",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline p-4">
          <span className="min-w-0 flex-1 truncate text-sm text-steel">
            {email}
          </span>
          <form action={signOutAction} className="shrink-0">
            <Button type="submit" variant="outline" size="sm">
              로그아웃
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
