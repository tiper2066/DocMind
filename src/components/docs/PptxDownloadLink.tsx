"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { triggerPptxDownload } from "@/lib/download-pptx";

// 버전 타임라인용 .pptx 다운로드. 미리보기의 다운로드 버튼과 동일하게
// 동일 출처 API 에서 바이트를 받아 blob 으로 저장한다(한글 파일명 보존).
export function PptxDownloadLink({ versionId }: { versionId: string }) {
  const [pending, startTransition] = useTransition();

  const download = () => {
    startTransition(async () => {
      try {
        await triggerPptxDownload(versionId);
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
