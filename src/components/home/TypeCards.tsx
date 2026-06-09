"use client";

import { useState } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { FolderPickerDialog } from "./FolderPickerDialog";

type DocType = {
  id: string;
  title: string;
  description: string;
  img: string;
};

const DOC_TYPES: DocType[] = [
  {
    id: "sales",
    title: "영업 제안서",
    description: "고객 대상 제품·서비스 제안",
    img: "/card-img/1_sales_proposal.svg",
  },
  {
    id: "plan",
    title: "기획안",
    description: "새 프로젝트·이니셔티브 기획",
    img: "/card-img/2_draft_plan.svg",
  },
  {
    id: "business",
    title: "사업 계획서",
    description: "사업 방향성·로드맵",
    img: "/card-img/3_business_plan.svg",
  },
  {
    id: "tech",
    title: "기술 문서",
    description: "제품 설명·아키텍처",
    img: "/card-img/4_tech_doc.svg",
  },
  {
    id: "meeting",
    title: "회의 자료",
    description: "내·외부 발표용",
    img: "/card-img/5_meeting_materials.svg",
  },
  {
    id: "marketing",
    title: "마케팅 자료",
    description: "캠페인·홍보",
    img: "/card-img/6_marketing_materials.svg",
  },
];

export function TypeCards() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string | null>(null);

  const pick = (id: string) => {
    setType(id);
    setOpen(true);
  };

  return (
    <>
      {DOC_TYPES.map((t) => (
        <button key={t.id} type="button" onClick={() => pick(t.id)} className="text-left">
          <Card className="relative aspect-[355/212] cursor-pointer overflow-hidden border-hairline bg-white p-6 ring-0 transition duration-200 hover:-translate-y-0.5 hover:shadow-elevation-2">
            {/* 우하단 배경 일러스트 — 355×212 풀카드 캔버스(좌상단 여백) */}
            <Image
              src={t.img}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
              className="pointer-events-none object-cover"
            />
            <div className="relative pt-6">
              <h3 className="font-heading text-heading-5 text-brand-navy">
                {t.title}
              </h3>
              <p className="mt-1.5 text-body-sm text-brand-navy/70">
                {t.description}
              </p>
            </div>
          </Card>
        </button>
      ))}

      <FolderPickerDialog type={type} open={open} onOpenChange={setOpen} />
    </>
  );
}
