"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

  const active = deck.slides[activeIndex] ?? deck.slides[0];

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
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
            <SlidePreview slide={s} meta={deck.meta} width={160} />
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
        <div className="flex flex-1 items-center justify-center overflow-auto rounded border bg-card p-4">
          <SlidePreview slide={active} meta={deck.meta} width={960} />
        </div>
      </section>
    </div>
  );
}
