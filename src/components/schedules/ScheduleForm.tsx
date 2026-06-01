"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TYPES: Array<{ value: string; label: string }> = [
  { value: "sales", label: "영업 제안서" },
  { value: "plan", label: "기획안" },
  { value: "business", label: "사업 계획서" },
  { value: "tech", label: "기술 문서" },
  { value: "meeting", label: "회의 자료" },
  { value: "marketing", label: "마케팅 자료" },
];

const inputCls =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function ScheduleForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    cron: "* * * * *",
    type: "sales",
    title: "",
    reader: "",
    cta: "",
    objection: "",
    sources: "",
    length: "10장",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        const { cron, type, ...rest } = form;
        const res = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cron,
            template: { type, ...rest, securityLevel: 1 },
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        toast.success("스케줄 등록 완료");
        setForm((f) => ({ ...f, title: "", reader: "", cta: "", objection: "", sources: "" }));
        router.refresh();
      } catch (err) {
        toast.error(`등록 실패: ${(err as Error).message}`);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">Cron (분 시 일 월 요일)</span>
          <Input value={form.cron} onChange={set("cron")} placeholder="* * * * *" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">문서 유형</span>
          <select value={form.type} onChange={set("type")} className={inputCls}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">제목</span>
        <Input value={form.title} onChange={set("title")} placeholder="주간 영업 제안서" required />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">독자</span>
          <Input value={form.reader} onChange={set("reader")} placeholder="임원" required />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">CTA</span>
          <Input value={form.cta} onChange={set("cta")} placeholder="계약 체결" required />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">예상 반론</span>
          <Input value={form.objection} onChange={set("objection")} placeholder="가격" required />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">분량</span>
          <Input value={form.length} onChange={set("length")} placeholder="10장" required />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">소스 힌트 (KB 매칭)</span>
        <Input value={form.sources} onChange={set("sources")} placeholder="WAPPLES" required />
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "등록 중..." : "스케줄 등록"}
        </Button>
      </div>
    </form>
  );
}
