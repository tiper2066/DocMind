"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// 버전 타임라인용 .pptx 다운로드. 생링크로 API 를 열면 JSON 이 노출되므로,
// fetch 로 서명 URL 을 받아 이동시킨다(미리보기의 다운로드 버튼과 동일 동작).
export function PptxDownloadLink({ versionId }: { versionId: string }) {
  const [pending, startTransition] = useTransition();

  const download = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/generate/${versionId}/pptx`);
        const body = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !body.url) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        window.location.href = body.url;
        toast.success("다운로드를 시작합니다");
      } catch (err) {
        toast.error(`다운로드 실패: ${(err as Error).message}`);
      }
    });
  };

  return (
    <Button
      type="button"
      variant="default"
      onClick={download}
      disabled={pending}
      className="px-3 py-1.5 text-xs"
    >
      {pending ? "준비 중…" : "다운로드"}
    </Button>
  );
}
