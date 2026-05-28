import Link from "next/link";
import {
  Briefcase,
  Lightbulb,
  TrendingUp,
  Code,
  Users,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";

type DocType = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const DOC_TYPES: DocType[] = [
  {
    id: "sales",
    title: "영업 제안서",
    description: "고객 대상 제품·서비스 제안",
    icon: Briefcase,
  },
  {
    id: "plan",
    title: "기획안",
    description: "새 프로젝트·이니셔티브 기획",
    icon: Lightbulb,
  },
  {
    id: "business",
    title: "사업 계획서",
    description: "사업 방향성·로드맵",
    icon: TrendingUp,
  },
  {
    id: "tech",
    title: "기술 문서",
    description: "제품 설명·아키텍처",
    icon: Code,
  },
  {
    id: "meeting",
    title: "회의 자료",
    description: "내·외부 회의 발표용",
    icon: Users,
  },
  {
    id: "marketing",
    title: "마케팅 자료",
    description: "캠페인·홍보",
    icon: Megaphone,
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          어떤 문서를 만들까요?
        </h1>
        <p className="text-sm text-muted-foreground">
          유형을 선택하면 5질문 인터뷰가 시작됩니다.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOC_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.id} href={`/chat/new?type=${t.id}`}>
              <Card className="h-full cursor-pointer p-6 transition hover:border-foreground/20 hover:shadow-sm">
                <Icon
                  className="mb-4 h-6 w-6 text-muted-foreground"
                  aria-hidden
                />
                <h3 className="text-base font-medium">{t.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.description}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
