"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES: Array<{ value: string; label: string }> = [
  { value: "sales", label: "영업 제안서" },
  { value: "plan", label: "기획안" },
  { value: "business", label: "사업 계획서" },
  { value: "tech", label: "기술 문서" },
  { value: "meeting", label: "회의 자료" },
  { value: "marketing", label: "마케팅 자료" },
];

const TYPE_ITEMS: Record<string, string> = Object.fromEntries(
  TYPES.map((t) => [t.value, t.label]),
);

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
    keyMessage: "",
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
        setForm((f) => ({ ...f, title: "", reader: "", cta: "", objection: "", keyMessage: "" }));
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
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">문서 유형</span>
          <Select
            items={TYPE_ITEMS}
            value={form.type}
            onValueChange={(v: string | null) =>
              setForm((f) => ({ ...f, type: v ?? "sales" }))
            }
          >
            <SelectTrigger aria-label="문서 유형">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        <span className="text-xs text-muted-foreground">핵심 메시지</span>
        <Input
          value={form.keyMessage}
          onChange={set("keyMessage")}
          placeholder="WAPPLES 도입으로 웹 보안 위협 90% 차단"
          required
        />
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "등록 중..." : "스케줄 등록"}
        </Button>
      </div>
    </form>
  );
}
