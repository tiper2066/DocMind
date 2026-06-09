"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-body-md transition-colors",
        isActive
          ? "bg-surface font-medium text-brand"
          : "text-ink hover:text-brand",
      )}
    >
      {children}
    </Link>
  );
}
