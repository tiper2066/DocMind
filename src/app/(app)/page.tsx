import Link from "next/link";
import {
  Briefcase,
  Lightbulb,
  TrendingUp,
  Code,
  Users,
  Megaphone,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";

type DocType = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tile: string;
  iconColor: string;
};

const DOC_TYPES: DocType[] = [
  {
    id: "sales",
    title: "영업 제안서",
    description: "고객 대상 제품·서비스 제안",
    icon: Briefcase,
    tile: "bg-tint-peach",
    iconColor: "text-brand-orange-deep",
  },
  {
    id: "plan",
    title: "기획안",
    description: "새 프로젝트·이니셔티브 기획",
    icon: Lightbulb,
    tile: "bg-tint-lavender",
    iconColor: "text-brand-purple-800",
  },
  {
    id: "business",
    title: "사업 계획서",
    description: "사업 방향성·로드맵",
    icon: TrendingUp,
    tile: "bg-tint-mint",
    iconColor: "text-brand-green",
  },
  {
    id: "tech",
    title: "기술 문서",
    description: "제품 설명·아키텍처",
    icon: Code,
    tile: "bg-tint-sky",
    iconColor: "text-link-blue",
  },
  {
    id: "meeting",
    title: "회의 자료",
    description: "내·외부 회의 발표용",
    icon: Users,
    tile: "bg-tint-rose",
    iconColor: "text-brand-pink-deep",
  },
  {
    id: "marketing",
    title: "마케팅 자료",
    description: "캠페인·홍보",
    icon: Megaphone,
    tile: "bg-tint-yellow-bold",
    iconColor: "text-brand-brown",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-12 flex flex-col gap-3">
        <h1 className="font-heading text-heading-2 text-ink">
          어떤 문서를 만들까요?
        </h1>
        <p className="text-subtitle text-steel">
          유형을 선택하면 5질문 인터뷰가 시작됩니다.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DOC_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.id} href={`/chat/new?type=${t.id}`}>
              <Card
                className={`h-full cursor-pointer border-transparent p-8 ring-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-elevation-2 ${t.tile}`}
              >
                <span className="mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-white/70 shadow-elevation-1">
                  <Icon className={`h-5 w-5 ${t.iconColor}`} aria-hidden />
                </span>
                <h3 className="font-heading text-heading-5 text-brand-navy">
                  {t.title}
                </h3>
                <p className="mt-1.5 text-body-sm text-brand-navy/70">
                  {t.description}
                </p>
              </Card>
            </Link>
          );
        })}

        <Card
          title="프로덕션 버전에서 제공될 예정입니다"
          className="flex h-full cursor-pointer flex-col bg-muted p-8 ring-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-elevation-2"
        >
          <span className="mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-canvas shadow-elevation-1">
            <Plus className="h-5 w-5 text-steel" aria-hidden />
          </span>
          <h3 className="font-heading text-heading-5 text-steel">
            사용자 유형 추가
          </h3>
          <p className="mt-1.5 text-body-sm text-stone">
            원하는 문서 유형을 직접 만들어 추가합니다.
          </p>
        </Card>
      </div>
    </main>
  );
}
