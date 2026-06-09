import {
  BookOpen,
  Bot,
  FolderOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/kb", label: "지식 베이스", icon: BookOpen },
  { href: "/docs", label: "문서함", icon: FolderOpen },
  { href: "/agent", label: "에이전트", icon: Bot },
  // 스케줄: 데모 범위 제외로 숨김 (라우트는 유지)
  { href: "/settings", label: "설정", icon: Settings },
];
