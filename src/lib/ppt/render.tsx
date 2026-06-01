/* eslint-disable @next/next/no-img-element */
import { Fragment } from "react";
import tokens from "@/design/tokens.ppt.json";
import {
  PPT_LAYOUTS,
  FOOTER_MASTER_BODY,
  COVER_MASTER,
  bulletRowY,
  agendaRowY,
  metricCardX,
  assetPath,
  type TextBox,
  type ShapeBox,
} from "./layouts";
import type { Slide, DeckMeta } from "./types";

export const CANVAS_W = tokens.canvas.width;
export const CANVAS_H = tokens.canvas.height;

function boxStyle(box: TextBox): React.CSSProperties {
  const s = box.style;
  return {
    position: "absolute",
    left: `${box.x}px`,
    top: `${box.y}px`,
    width: `${box.w}px`,
    height: `${box.h}px`,
    fontSize: `${s.size}px`,
    fontWeight: s.weight,
    color: s.color,
    letterSpacing: s.tracking ? `${s.tracking}px` : undefined,
    lineHeight: s.lineHeight ?? 1.2,
    textAlign: s.align,
    fontFamily: s.family,
    overflow: "hidden",
    whiteSpace: "pre-wrap",
  };
}

function shapeStyle(shape: ShapeBox): React.CSSProperties {
  return {
    position: "absolute",
    left: `${shape.x}px`,
    top: `${shape.y}px`,
    width: `${shape.w}px`,
    height: `${shape.h}px`,
    backgroundColor: shape.fill,
  };
}

function Shapes({ shapes }: { shapes?: ShapeBox[] }) {
  if (!shapes) return null;
  return (
    <>
      {shapes.map((s, i) => (
        <div key={i} style={shapeStyle(s)} aria-hidden />
      ))}
    </>
  );
}

function FooterMaster({ securityLevel }: { securityLevel: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: FOOTER_MASTER_BODY.bar.x,
          top: FOOTER_MASTER_BODY.bar.y,
          width: FOOTER_MASTER_BODY.bar.w,
          height: FOOTER_MASTER_BODY.bar.h,
          backgroundColor: FOOTER_MASTER_BODY.bar.fill,
        }}
        aria-hidden
      />
      <img
        src={assetPath("securityLevel", securityLevel)}
        alt=""
        style={{
          position: "absolute",
          left: FOOTER_MASTER_BODY.securityChip.x,
          top: FOOTER_MASTER_BODY.securityChip.y,
          width: FOOTER_MASTER_BODY.securityChip.w,
          height: FOOTER_MASTER_BODY.securityChip.h,
          objectFit: "contain",
        }}
      />
      <img
        src={assetPath("pentaSmall")}
        alt=""
        style={{
          position: "absolute",
          left: FOOTER_MASTER_BODY.wordmark.x,
          top: FOOTER_MASTER_BODY.wordmark.y,
          width: FOOTER_MASTER_BODY.wordmark.w,
          height: FOOTER_MASTER_BODY.wordmark.h,
          objectFit: "contain",
        }}
      />
    </>
  );
}

function CoverMaster() {
  return (
    <>
      <img
        src={assetPath("pentaLarge")}
        alt=""
        style={{
          position: "absolute",
          left: COVER_MASTER.wordmark.x,
          top: COVER_MASTER.wordmark.y,
          width: COVER_MASTER.wordmark.w,
          height: COVER_MASTER.wordmark.h,
          objectFit: "contain",
        }}
      />
      <img
        src={assetPath("earth")}
        alt=""
        style={{
          position: "absolute",
          left: COVER_MASTER.earth.x,
          top: COVER_MASTER.earth.y,
          width: COVER_MASTER.earth.w,
          height: COVER_MASTER.earth.h,
          objectFit: "contain",
        }}
      />
      <img
        src={assetPath("awardsCover")}
        alt=""
        style={{
          position: "absolute",
          left: COVER_MASTER.awards.x,
          top: COVER_MASTER.awards.y,
          width: COVER_MASTER.awards.w,
          height: COVER_MASTER.awards.h,
          objectFit: "contain",
        }}
      />
    </>
  );
}

function CoverContent({
  slide,
}: {
  slide: Extract<Slide, { kind: "cover" }>;
}) {
  const L = PPT_LAYOUTS.cover.text;
  return (
    <>
      <CoverMaster />
      <div style={boxStyle(L.title)}>{slide.title}</div>
      {slide.subtitle && <div style={boxStyle(L.subtitle)}>{slide.subtitle}</div>}
      <div style={boxStyle(L.authorDate)}>
        {[slide.author, slide.date].filter(Boolean).join(" · ")}
      </div>
    </>
  );
}

function AgendaContent({
  slide,
}: {
  slide: Extract<Slide, { kind: "agenda" }>;
}) {
  const L = PPT_LAYOUTS.agenda;
  return (
    <>
      <Shapes shapes={L.shapes} />
      <div style={boxStyle(L.text.title)}>목차</div>
      {slide.items.map((item, i) => (
        <Fragment key={i}>
          <div
            style={{
              ...boxStyle(L.text.itemIndexProto),
              top: agendaRowY(i),
            }}
          >
            {String(i + 1).padStart(2, "0")}
          </div>
          <div
            style={{
              ...boxStyle(L.text.itemTitleProto),
              top: agendaRowY(i),
            }}
          >
            {item}
          </div>
        </Fragment>
      ))}
    </>
  );
}

function SectionContent({
  slide,
}: {
  slide: Extract<Slide, { kind: "section" }>;
}) {
  const L = PPT_LAYOUTS.section.text;
  return (
    <>
      <div style={boxStyle(L.bigIndex)}>
        {String(slide.index).padStart(2, "0")}
      </div>
      <div style={boxStyle(L.eyebrow)}>
        {slide.eyebrow ?? `SECTION ${String(slide.index).padStart(2, "0")}`}
      </div>
      <div style={boxStyle(L.title)}>{slide.title}</div>
    </>
  );
}

function BulletsContent({
  slide,
}: {
  slide: Extract<Slide, { kind: "bullets" }>;
}) {
  const L = PPT_LAYOUTS.bullets;
  return (
    <>
      <Shapes shapes={L.shapes} />
      <div style={boxStyle(L.text.title)}>{slide.title}</div>
      {slide.bullets.map((b, i) => {
        const proto = b.level === 0 ? L.text.bulletL0Proto : L.text.bulletL1Proto;
        return (
          <div
            key={i}
            style={{
              ...boxStyle(proto),
              top: bulletRowY(i, b.level),
            }}
          >
            <span aria-hidden style={{ marginRight: 16 }}>
              {b.level === 0 ? "■" : "—"}
            </span>
            {b.text}
          </div>
        );
      })}
    </>
  );
}

function TwoColContent({
  slide,
}: {
  slide: Extract<Slide, { kind: "twoCol" }>;
}) {
  const L = PPT_LAYOUTS.twoCol;
  return (
    <>
      <Shapes shapes={L.shapes} />
      <div style={boxStyle(L.text.title)}>{slide.title}</div>
      <div style={boxStyle(L.text.leftLabel)}>{slide.left.label}</div>
      <div style={boxStyle(L.text.leftBody)}>{slide.left.body}</div>
      <div style={boxStyle(L.text.rightLabel)}>{slide.right.label}</div>
      <div style={boxStyle(L.text.rightBody)}>{slide.right.body}</div>
    </>
  );
}

function MetricContent({
  slide,
}: {
  slide: Extract<Slide, { kind: "metric" }>;
}) {
  const L = PPT_LAYOUTS.metric;
  const total = (slide.metrics.length === 4 ? 4 : 3) as 3 | 4;
  return (
    <>
      <Shapes shapes={L.shapes} />
      <div style={boxStyle(L.text.title)}>{slide.title}</div>
      {slide.metrics.map((m, i) => {
        const x = metricCardX(i, total);
        const w = total === 3 ? 520 : 380;
        const label = { ...L.text.cardLabelProto, x, w };
        const value = { ...L.text.cardValueProto, x, w };
        const delta = { ...L.text.cardDeltaProto, x, w };
        const isPositive = m.delta?.startsWith("+") || m.delta?.includes("▲");
        const isNegative = m.delta?.startsWith("-") || m.delta?.includes("▼");
        return (
          <Fragment key={i}>
            <div style={boxStyle(label)}>{m.label}</div>
            <div style={boxStyle(value)}>{m.value}</div>
            {m.delta && (
              <div
                style={{
                  ...boxStyle(delta),
                  color: isPositive
                    ? tokens.color.semantic.positive
                    : isNegative
                      ? tokens.color.semantic.negative
                      : delta.style.color,
                }}
              >
                {m.delta}
              </div>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function QuoteContent({
  slide,
}: {
  slide: Extract<Slide, { kind: "quote" }>;
}) {
  const L = PPT_LAYOUTS.quote.text;
  return (
    <>
      <div style={boxStyle(L.quoteMark)}>&ldquo;</div>
      <div style={boxStyle(L.quote)}>{slide.text}</div>
      <div style={boxStyle(L.attribution)}>— {slide.attribution}</div>
    </>
  );
}

function ImageContent({
  slide,
}: {
  slide: Extract<Slide, { kind: "image" }>;
}) {
  const L = PPT_LAYOUTS.image;
  const imageBox = { x: 220, y: 280, w: 1480, h: 680 };
  return (
    <>
      <Shapes shapes={L.shapes} />
      {slide.title && <div style={boxStyle(L.text.title)}>{slide.title}</div>}
      <div
        style={{
          position: "absolute",
          left: imageBox.x,
          top: imageBox.y,
          width: imageBox.w,
          height: imageBox.h,
          border: "1px solid #E5E5E5",
          backgroundColor: "#FAFAFA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#999B9E",
          fontSize: 18,
        }}
        aria-label={`Image: ${slide.imageRef}`}
      >
        🖼️ {slide.imageRef}
      </div>
      {slide.caption && <div style={boxStyle(L.text.caption)}>{slide.caption}</div>}
    </>
  );
}

function CtaContent({ slide }: { slide: Extract<Slide, { kind: "cta" }> }) {
  const L = PPT_LAYOUTS.cta;
  return (
    <>
      <Shapes shapes={L.shapes} />
      <div style={boxStyle(L.text.headline)}>{slide.headline}</div>
      <div style={boxStyle(L.text.action)}>{slide.action}</div>
      {slide.contact && <div style={boxStyle(L.text.contact)}>{slide.contact}</div>}
    </>
  );
}

function SlideContent({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case "cover":
      return <CoverContent slide={slide} />;
    case "agenda":
      return <AgendaContent slide={slide} />;
    case "section":
      return <SectionContent slide={slide} />;
    case "bullets":
      return <BulletsContent slide={slide} />;
    case "twoCol":
      return <TwoColContent slide={slide} />;
    case "metric":
      return <MetricContent slide={slide} />;
    case "quote":
      return <QuoteContent slide={slide} />;
    case "image":
      return <ImageContent slide={slide} />;
    case "cta":
      return <CtaContent slide={slide} />;
  }
}

export function SlideCanvas({
  slide,
  meta,
  scale = 1,
}: {
  slide: Slide;
  meta: DeckMeta;
  scale?: number;
}) {
  const isCover = slide.kind === "cover";
  return (
    <div
      style={{
        width: CANVAS_W * scale,
        height: CANVAS_H * scale,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "relative",
          width: CANVAS_W,
          height: CANVAS_H,
          backgroundColor: tokens.color.bg,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <SlideContent slide={slide} />
        {!isCover && <FooterMaster securityLevel={meta.securityLevel} />}
      </div>
    </div>
  );
}
