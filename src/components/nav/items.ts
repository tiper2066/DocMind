import {
  BookOpen,
  Bot,
  FolderOpen,
  CalendarClock,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/kb", label: "지식 베이스", icon: BookOpen },
  { href: "/agent", label: "에이전트", icon: Bot },
  { href: "/docs", label: "문서함", icon: FolderOpen },
  { href: "/schedules", label: "스케줄", icon: CalendarClock },
  { href: "/settings", label: "설정", icon: Settings },
];
