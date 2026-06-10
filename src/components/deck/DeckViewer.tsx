"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { triggerPptxDownload } from "@/lib/download-pptx";
import { SlidePreview } from "./SlidePreview";
import type { Deck } from "@/lib/ppt/types";

export function DeckViewer({
  deck,
  versionId,
}: {
  deck: Deck;
  versionId: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pending, startTransition] = useTransition();

  // 미리보기를 가용 폭에 맞춰 반응형으로 — 16:9 비율 유지, 우측 잘림 방지.
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewW, setPreviewW] = useState(0);
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      // 16:9 슬라이드가 가로·세로 모두 컨테이너 안에 들어오는 최대 폭.
      const fitW = Math.min(width, (height * 1920) / 1080, 1920);
      setPreviewW(Math.max(0, fitW));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const active = deck.slides[activeIndex] ?? deck.slides[0];

  return (
    <div className="flex h-[calc(100vh-200px)] flex-col gap-3">
      <div className="flex justify-end">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                render={<Link href="/docs" />}
                variant="ghost"
                size="icon"
                aria-label="닫기"
              />
            }
          >
            <X className="size-5" />
          </TooltipTrigger>
          <TooltipContent>문서함으로</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <aside className="flex w-48 flex-col gap-2 overflow-y-auto rounded border bg-card p-3">
        {deck.slides.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`flex flex-col gap-1 rounded border p-2 text-left transition ${
              i === activeIndex
                ? "border-foreground bg-muted"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <span className="text-xs text-muted-foreground">
              {i + 1}. {s.kind}
            </span>
            <div className="flex w-full justify-center">
              <SlidePreview slide={s} meta={deck.meta} width={140} />
            </div>
          </button>
        ))}
      </aside>

      <section className="flex flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight">
              {deck.meta.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              slide {activeIndex + 1} / {deck.slides.length} ·{" "}
              {deck.slides[activeIndex]?.kind}
            </p>
          </div>
          <Button type="button" onClick={download} disabled={pending}>
            {pending ? "준비 중..." : ".pptx 다운로드"}
          </Button>
        </div>
        <div
          ref={previewRef}
          className="flex flex-1 items-center justify-center overflow-hidden rounded border bg-card p-4"
        >
          {previewW > 0 && (
            <SlidePreview slide={active} meta={deck.meta} width={previewW} />
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
