/* eslint-disable @next/next/no-img-element */
import { Fragment } from "react";
import tokens from "@/design/tokens.ppt.json";
import {
  PPT_LAYOUTS,
  FOOTER_MASTER_BODY,
  COVER_MASTER,
  BACK_COVER,
  BACK_COVER_COPYRIGHT,
  bulletRowYs,
  agendaRowY,
  metricCardX,
  diagramGeometry,
  diagramNodeColors,
  metricValueSize,
  bulletMarkerBox,
  fitTextSize,
  quoteLayout,
  twoColChipW,
  TWO_COL,
  METRIC_PANEL,
  assetPath,
  footerBarFill,
  footerIsDarkBar,
  type TextBox,
  type TextStyle,
  type ShapeBox,
  type SlideKind,
} from "./layouts";
import type { Slide, DeckMeta } from "./types";

export const CANVAS_W = tokens.canvas.width;
export const CANVAS_H = tokens.canvas.height;

const VALIGN_JUSTIFY: Record<NonNullable<TextStyle["valign"]>, string> = {
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};

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
    // PowerPoint 텍스트 박스는 내용을 클리핑하지 않음 — 미리보기도 동일하게 (슬라이드 경계 클리핑은 SlideCanvas 가 담당)
    overflow: "visible",
    whiteSpace: "pre-wrap",
    ...(s.valign
      ? { display: "flex", flexDirection: "column", justifyContent: VALIGN_JUSTIFY[s.valign] }
      : {}),
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

function FooterMaster({
  securityLevel,
  kind,
}: {
  securityLevel: 1 | 2 | 3 | 4 | 5;
  kind: SlideKind;
}) {
  const dark = footerIsDarkBar(kind);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: FOOTER_MASTER_BODY.bar.x,
          top: FOOTER_MASTER_BODY.bar.y,
          width: FOOTER_MASTER_BODY.bar.w,
          height: FOOTER_MASTER_BODY.bar.h,
          backgroundColor: footerBarFill(kind),
        }}
        aria-hidden
      />
      <img
        src={assetPath("securityLevel", securityLevel, { dark })}
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
        src={assetPath(dark ? "pentaWhiteSmall" : "pentaSmall")}
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

function CoverMaster({
  securityLevel,
}: {
  securityLevel: 1 | 2 | 3 | 4 | 5;
}) {
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
      <img
        src={assetPath("securityLevel", securityLevel)}
        alt=""
        style={{
          position: "absolute",
          left: COVER_MASTER.securityChip.x,
          top: COVER_MASTER.securityChip.y,
          width: COVER_MASTER.securityChip.w,
          height: COVER_MASTER.securityChip.h,
          objectFit: "contain",
          objectPosition: "right",
        }}
      />
    </>
  );
}

function CoverContent({
  slide,
  securityLevel,
}: {
  slide: Extract<Slide, { kind: "cover" }>;
  securityLevel: 1 | 2 | 3 | 4 | 5;
}) {
  const L = PPT_LAYOUTS.cover.text;
  return (
    <>
      <CoverMaster securityLevel={securityLevel} />
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
              top: agendaRowY(i, slide.items.length),
            }}
          >
            {String(i + 1).padStart(2, "0")}
          </div>
          <div
            style={{
              ...boxStyle(L.text.itemTitleProto),
              top: agendaRowY(i, slide.items.length),
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
  const ys = bulletRowYs(slide.bullets.map((b) => b.level));
  return (
    <>
      <Shapes shapes={L.shapes} />
      <div style={boxStyle(L.text.title)}>{slide.title}</div>
      {slide.bullets.map((b, i) => {
        const proto = b.level === 0 ? L.text.bulletL0Proto : L.text.bulletL1Proto;
        return (
          <Fragment key={i}>
            {b.level === 0 && <Shapes shapes={[bulletMarkerBox(ys[i])]} />}
            <div
              style={{
                ...boxStyle(proto),
                top: ys[i],
              }}
            >
              {b.level === 1 && (
                <span aria-hidden style={{ marginRight: 16 }}>
                  —
                </span>
              )}
              {b.text}
            </div>
          </Fragment>
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
  const cols = [
    { label: L.text.leftLabel, body: L.text.leftBody, data: slide.left },
    { label: L.text.rightLabel, body: L.text.rightBody, data: slide.right },
  ];
  return (
    <>
      <Shapes shapes={L.shapes} />
      <div style={boxStyle(L.text.title)}>{slide.title}</div>
      {cols.map((col, i) => {
        const panel = TWO_COL.panels[i];
        const chipW = twoColChipW(col.data.label);
        const bodySize = fitTextSize(
          col.data.body,
          col.body.w,
          col.body.h,
          [col.body.style.size, 22, 20, 18],
          col.body.style.lineHeight ?? 1.55,
        );
        return (
          <Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: panel.x,
                top: panel.y,
                width: panel.w,
                height: panel.h,
                backgroundColor: TWO_COL.panelFill,
                border: `1px solid ${TWO_COL.panelBorder}`,
                borderRadius: TWO_COL.panelRadius,
              }}
            />
            <div
              style={{
                ...boxStyle({ ...col.label, w: chipW }),
                backgroundColor: TWO_COL.chipFill,
                borderRadius: TWO_COL.chipRadius,
              }}
            >
              {col.data.label}
            </div>
            <div
              style={{
                ...boxStyle(col.body),
                fontSize: `${bodySize}px`,
              }}
            >
              {col.data.body}
            </div>
          </Fragment>
        );
      })}
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
        const value = {
          ...L.text.cardValueProto,
          x,
          w,
          style: {
            ...L.text.cardValueProto.style,
            size: metricValueSize(m.value, w),
          },
        };
        const delta = { ...L.text.cardDeltaProto, x, w };
        const isPositive = m.delta?.startsWith("+") || m.delta?.includes("▲");
        const isNegative = m.delta?.startsWith("-") || m.delta?.includes("▼");
        return (
          <Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: METRIC_PANEL.y,
                width: w,
                height: METRIC_PANEL.h,
                backgroundColor: METRIC_PANEL.fill,
                border: `1px solid ${METRIC_PANEL.border}`,
                borderRadius: METRIC_PANEL.radius,
              }}
            />
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
  const geo = quoteLayout(slide.text);
  return (
    <>
      <Shapes shapes={[geo.bar]} />
      <div
        style={{
          ...boxStyle({ ...L.quote, ...geo.quote }),
          fontSize: `${geo.quote.size}px`,
        }}
      >
        {slide.text}
      </div>
      <div style={boxStyle({ ...L.attribution, ...geo.attribution })}>
        — {slide.attribution}
      </div>
    </>
  );
}

function ImageContent({
  slide,
}: {
  slide: Extract<Slide, { kind: "image" }>;
}) {
  const L = PPT_LAYOUTS.image;
  const nodes = slide.nodes ?? ["입력", "처리", "출력"];
  const geo = diagramGeometry(nodes.length, slide.direction ?? "horizontal");
  const accent = tokens.color.accent.penta;
  const ls = geo.labelStyle;
  return (
    <>
      <Shapes shapes={L.shapes} />
      {slide.title && <div style={boxStyle(L.text.title)}>{slide.title}</div>}
      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
        aria-hidden
      >
        <defs>
          <marker
            id="diagram-arrow"
            markerUnits="userSpaceOnUse"
            markerWidth="22"
            markerHeight="22"
            refX="17"
            refY="11"
            orient="auto"
          >
            <path d="M2,2 L20,11 L2,20 Z" fill={accent} />
          </marker>
        </defs>
        {geo.arrows.map((a, i) => (
          <line
            key={i}
            x1={a.x1}
            y1={a.y1}
            x2={a.x2}
            y2={a.y2}
            stroke={accent}
            strokeWidth={3}
            markerEnd="url(#diagram-arrow)"
          />
        ))}
      </svg>
      {geo.boxes.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: b.x,
            top: b.y,
            width: b.w,
            height: b.h,
            border: `2px solid ${diagramNodeColors(i).border}`,
            borderRadius: 16,
            backgroundColor: diagramNodeColors(i).bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 16,
            fontSize: `${ls.size}px`,
            fontWeight: ls.weight,
            color: ls.color,
            lineHeight: ls.lineHeight ?? 1.3,
            fontFamily: ls.family,
          }}
        >
          {nodes[i]}
        </div>
      ))}
      {slide.caption && <div style={boxStyle(L.text.caption)}>{slide.caption}</div>}
    </>
  );
}

function BackCoverContent() {
  const B = BACK_COVER;
  return (
    <>
      <img
        src={assetPath("pentaColor")}
        alt=""
        style={{
          position: "absolute",
          left: B.wordmark.x,
          top: B.wordmark.y,
          width: B.wordmark.w,
          height: B.wordmark.h,
          objectFit: "contain",
        }}
      />
      {B.urls.map((u, i) => (
        <Fragment key={i}>
          <div style={boxStyle({ ...B.urlLabelProto, y: B.urlLabelProto.y + i * B.urlRowGap })}>
            {u.label}
          </div>
          <div style={boxStyle({ ...B.urlValueProto, y: B.urlValueProto.y + i * B.urlRowGap })}>
            {u.url}
          </div>
        </Fragment>
      ))}
      <img
        src={assetPath("awardsBack")}
        alt=""
        style={{
          position: "absolute",
          left: B.awards.x,
          top: B.awards.y,
          width: B.awards.w,
          height: B.awards.h,
          objectFit: "contain",
        }}
      />
      <div style={shapeStyle(B.footerBar)} aria-hidden />
      <div style={boxStyle(B.copyright)}>{BACK_COVER_COPYRIGHT}</div>
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

function SlideContent({
  slide,
  securityLevel,
}: {
  slide: Slide;
  securityLevel: 1 | 2 | 3 | 4 | 5;
}) {
  switch (slide.kind) {
    case "cover":
      return <CoverContent slide={slide} securityLevel={securityLevel} />;
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
    case "backCover":
      return <BackCoverContent />;
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
  const noFooter = slide.kind === "cover" || slide.kind === "backCover";
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
          overflow: "hidden",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <SlideContent slide={slide} securityLevel={meta.securityLevel} />
        {!noFooter && (
          <FooterMaster
            securityLevel={meta.securityLevel}
            kind={slide.kind as SlideKind}
          />
        )}
      </div>
    </div>
  );
}
