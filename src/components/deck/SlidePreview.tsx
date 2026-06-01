import { SlideCanvas, CANVAS_W, CANVAS_H } from "@/lib/ppt/render";
import type { DeckMeta, Slide } from "@/lib/ppt/types";

export function SlidePreview({
  slide,
  meta,
  width,
}: {
  slide: Slide;
  meta: DeckMeta;
  width: number;
}) {
  const scale = width / CANVAS_W;
  const height = CANVAS_H * scale;
  return (
    <div
      className="overflow-hidden rounded border bg-white shadow-sm"
      style={{ width, height }}
    >
      <SlideCanvas slide={slide} meta={meta} scale={scale} />
    </div>
  );
}
