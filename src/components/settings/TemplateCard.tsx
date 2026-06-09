"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// 데모 플레이스홀더 — 실제 업로드/등록 API·스토리지는 프로덕션 예정.
export function TemplateCard() {
  const notify = () =>
    toast.info("문서 템플릿 등록은 프로덕션에서 제공됩니다.");

  return (
    <div className="flex flex-col rounded-xl border border-hairline bg-canvas p-6">
      <h2 className="font-heading text-heading-5 text-ink">문서 템플릿</h2>
      <p className="mt-1 text-body-sm text-steel">
        등록된 템플릿으로 문서가 발행됩니다.
        <br />
        file.json만 적용 가능합니다.
      </p>
      <button
        type="button"
        onClick={notify}
        aria-label="템플릿 업로드"
        className="mt-4 min-h-40 flex-1 rounded-lg border border-dashed border-hairline-strong bg-muted transition-colors hover:bg-accent"
      />
      <div className="mt-4 flex justify-center">
        <Button onClick={notify} className="px-8">
          등록
        </Button>
      </div>
    </div>
  );
}
