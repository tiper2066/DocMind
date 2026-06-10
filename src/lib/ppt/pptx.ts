import path from "node:path";
import pptxgen from "pptxgenjs";

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
  assetPath,
  footerBarFill,
  footerIsDarkBar,
  type TextBox,
  type ShapeBox,
  type SlideKind,
} from "./layouts";
import type { Deck, Slide } from "./types";

const CANVAS_W = tokens.canvas.width;
const CANVAS_H = tokens.canvas.height;
const SLIDE_W_IN = 13.333;
const SLIDE_H_IN = 7.5;

function pxToInchX(px: number): number {
  return (px / CANVAS_W) * SLIDE_W_IN;
}
function pxToInchY(px: number): number {
  return (px / CANVAS_H) * SLIDE_H_IN;
}
function pxToPt(px: number): number {
  return px / 2;
}

function publicFsPath(webPath: string): string {
  const stripped = webPath.startsWith("/") ? webPath.slice(1) : webPath;
  return path.join(process.cwd(), "public", stripped);
}

function fontFace(family: string): string {
  return family.split(",")[0].trim().replace(/['"]/g, "");
}

function textOpts(box: TextBox, align?: "left" | "center" | "right") {
  const s = box.style;
  return {
    x: pxToInchX(box.x),
    y: pxToInchY(box.y),
    w: pxToInchX(box.w),
    h: pxToInchY(box.h),
    fontFace: s.family ? fontFace(s.family) : "Pretendard",
    fontSize: pxToPt(s.size),
    bold: s.weight === 700,
    color: s.color.replace("#", ""),
    align: align ?? s.align ?? "left",
    valign: s.valign ?? "top",
    margin: 0,
    paraSpaceBefore: 0,
    paraSpaceAfter: 0,
    isTextBox: true,
    autoFit: true,
  };
}

function shapeRect(slide: pptxgen.Slide, shape: ShapeBox) {
  slide.addShape("rect", {
    x: pxToInchX(shape.x),
    y: pxToInchY(shape.y),
    w: pxToInchX(shape.w),
    h: pxToInchY(shape.h),
    fill: { color: shape.fill.replace("#", "") },
    line: { type: "none" },
  });
}

function addImage(
  slide: pptxgen.Slide,
  webPath: string,
  pos: { x: number; y: number; w: number; h: number },
  sizing: "contain" | "cover" = "contain",
) {
  slide.addImage({
    path: publicFsPath(webPath),
    x: pxToInchX(pos.x),
    y: pxToInchY(pos.y),
    w: pxToInchX(pos.w),
    h: pxToInchY(pos.h),
    sizing: sizing === "cover"
      ? { type: "cover", w: pxToInchX(pos.w), h: pxToInchY(pos.h) }
      : { type: "contain", w: pxToInchX(pos.w), h: pxToInchY(pos.h) },
  });
}

function applyFooter(
  slide: pptxgen.Slide,
  securityLevel: 1 | 2 | 3 | 4 | 5,
  kind: SlideKind,
) {
  const dark = footerIsDarkBar(kind);
  shapeRect(slide, { ...FOOTER_MASTER_BODY.bar, fill: footerBarFill(kind) });
  addImage(
    slide,
    assetPath("securityLevel", securityLevel, { dark }),
    FOOTER_MASTER_BODY.securityChip,
  );
  addImage(
    slide,
    assetPath(dark ? "pentaWhiteSmall" : "pentaSmall"),
    FOOTER_MASTER_BODY.wordmark,
  );
}

function applyCoverMaster(
  slide: pptxgen.Slide,
  securityLevel: 1 | 2 | 3 | 4 | 5,
) {
  addImage(slide, assetPath("pentaLarge"), COVER_MASTER.wordmark);
  addImage(slide, assetPath("earth"), COVER_MASTER.earth);
  addImage(slide, assetPath("awardsCover"), COVER_MASTER.awards);
  addImage(
    slide,
    assetPath("securityLevel", securityLevel),
    COVER_MASTER.securityChip,
  );
}

function fillCover(
  slide: pptxgen.Slide,
  s: Extract<Slide, { kind: "cover" }>,
  securityLevel: 1 | 2 | 3 | 4 | 5,
) {
  applyCoverMaster(slide, securityLevel);
  const L = PPT_LAYOUTS.cover.text;
  slide.addText(s.title, textOpts(L.title));
  if (s.subtitle) slide.addText(s.subtitle, textOpts(L.subtitle));
  const meta = [s.author, s.date].filter(Boolean).join(" · ");
  if (meta.length > 0) slide.addText(meta, textOpts(L.authorDate));
}

function fillAgenda(
  slide: pptxgen.Slide,
  s: Extract<Slide, { kind: "agenda" }>,
) {
  const L = PPT_LAYOUTS.agenda;
  L.shapes?.forEach((sh) => shapeRect(slide, sh));
  slide.addText("목차", textOpts(L.text.title));
  s.items.forEach((item, i) => {
    const idxBox = { ...L.text.itemIndexProto, y: agendaRowY(i) };
    const ttlBox = { ...L.text.itemTitleProto, y: agendaRowY(i) };
    slide.addText(String(i + 1).padStart(2, "0"), textOpts(idxBox));
    slide.addText(item, textOpts(ttlBox));
  });
}

function fillSection(
  slide: pptxgen.Slide,
  s: Extract<Slide, { kind: "section" }>,
) {
  const L = PPT_LAYOUTS.section.text;
  slide.addText(String(s.index).padStart(2, "0"), textOpts(L.bigIndex));
  slide.addText(
    s.eyebrow ?? `SECTION ${String(s.index).padStart(2, "0")}`,
    textOpts(L.eyebrow),
  );
  slide.addText(s.title, textOpts(L.title));
}

function fillBullets(
  slide: pptxgen.Slide,
  s: Extract<Slide, { kind: "bullets" }>,
) {
  const L = PPT_LAYOUTS.bullets;
  L.shapes?.forEach((sh) => shapeRect(slide, sh));
  slide.addText(s.title, textOpts(L.text.title));
  const ys = bulletRowYs(s.bullets.map((b) => b.level));
  s.bullets.forEach((b, i) => {
    const proto = b.level === 0 ? L.text.bulletL0Proto : L.text.bulletL1Proto;
    const box = { ...proto, y: ys[i] };
    const marker = b.level === 0 ? "■ " : "— ";
    slide.addText(marker + b.text, textOpts(box));
  });
}

function fillTwoCol(
  slide: pptxgen.Slide,
  s: Extract<Slide, { kind: "twoCol" }>,
) {
  const L = PPT_LAYOUTS.twoCol;
  L.shapes?.forEach((sh) => shapeRect(slide, sh));
  slide.addText(s.title, textOpts(L.text.title));
  slide.addText(s.left.label, textOpts(L.text.leftLabel));
  slide.addText(s.left.body, textOpts(L.text.leftBody));
  slide.addText(s.right.label, textOpts(L.text.rightLabel));
  slide.addText(s.right.body, textOpts(L.text.rightBody));
}

function fillMetric(
  slide: pptxgen.Slide,
  s: Extract<Slide, { kind: "metric" }>,
) {
  const L = PPT_LAYOUTS.metric;
  L.shapes?.forEach((sh) => shapeRect(slide, sh));
  slide.addText(s.title, textOpts(L.text.title));
  const total = (s.metrics.length === 4 ? 4 : 3) as 3 | 4;
  const cardW = total === 3 ? 520 : 380;
  s.metrics.forEach((m, i) => {
    const x = metricCardX(i, total);
    slide.addText(m.label, textOpts({ ...L.text.cardLabelProto, x, w: cardW }));
    slide.addText(m.value, textOpts({ ...L.text.cardValueProto, x, w: cardW }));
    if (m.delta) {
      const isPos = m.delta.startsWith("+") || m.delta.includes("▲");
      const isNeg = m.delta.startsWith("-") || m.delta.includes("▼");
      const color = isPos
        ? tokens.color.semantic.positive
        : isNeg
          ? tokens.color.semantic.negative
          : L.text.cardDeltaProto.style.color;
      const opts = textOpts({ ...L.text.cardDeltaProto, x, w: cardW });
      slide.addText(m.delta, { ...opts, color: color.replace("#", "") });
    }
  });
}

function fillQuote(slide: pptxgen.Slide, s: Extract<Slide, { kind: "quote" }>) {
  const L = PPT_LAYOUTS.quote.text;
  slide.addText("“", textOpts(L.quoteMark));
  slide.addText(s.text, textOpts(L.quote));
  slide.addText(`— ${s.attribution}`, textOpts(L.attribution));
}

function fillImage(slide: pptxgen.Slide, s: Extract<Slide, { kind: "image" }>) {
  const L = PPT_LAYOUTS.image;
  L.shapes?.forEach((sh) => shapeRect(slide, sh));
  if (s.title) slide.addText(s.title, textOpts(L.text.title));

  const nodes = s.nodes ?? ["입력", "처리", "출력"];
  const geo = diagramGeometry(nodes.length, s.direction ?? "horizontal");
  const accent = tokens.color.accent.penta.replace("#", "");
  const ls = geo.labelStyle;

  // 인접 노드 사이 직선 화살표(끝점은 우리가 계산 → 항상 forward, flip 불필요).
  geo.arrows.forEach((a) => {
    slide.addShape("line", {
      x: pxToInchX(a.x1),
      y: pxToInchY(a.y1),
      w: pxToInchX(a.x2 - a.x1),
      h: pxToInchY(a.y2 - a.y1),
      line: { color: accent, width: 2.5, endArrowType: "triangle" },
    });
  });

  nodes.forEach((label, i) => {
    const b = geo.boxes[i];
    slide.addText(label, {
      x: pxToInchX(b.x),
      y: pxToInchY(b.y),
      w: pxToInchX(b.w),
      h: pxToInchY(b.h),
      shape: "roundRect",
      rectRadius: 0.08,
      fill: { color: tokens.color.bg.replace("#", "") },
      line: { color: accent, width: 2 },
      fontFace: "Pretendard",
      fontSize: pxToPt(ls.size),
      color: ls.color.replace("#", ""),
      align: "center",
      valign: "middle",
      isTextBox: true,
    });
  });

  if (s.caption) slide.addText(s.caption, textOpts(L.text.caption, "center"));
}

function fillBackCover(slide: pptxgen.Slide) {
  const B = BACK_COVER;
  addImage(slide, assetPath("pentaColor"), B.wordmark);
  B.urls.forEach((u, i) => {
    slide.addText(
      u.label,
      textOpts({ ...B.urlLabelProto, y: B.urlLabelProto.y + i * B.urlRowGap }),
    );
    slide.addText(
      u.url,
      textOpts({ ...B.urlValueProto, y: B.urlValueProto.y + i * B.urlRowGap }),
    );
  });
  addImage(slide, assetPath("awardsBack"), B.awards);
  shapeRect(slide, B.footerBar);
  slide.addText(BACK_COVER_COPYRIGHT, textOpts(B.copyright, "center"));
}

function fillCta(slide: pptxgen.Slide, s: Extract<Slide, { kind: "cta" }>) {
  const L = PPT_LAYOUTS.cta;
  L.shapes?.forEach((sh) => shapeRect(slide, sh));
  slide.addText(s.headline, textOpts(L.text.headline, "center"));
  slide.addText(s.action, textOpts(L.text.action, "center"));
  if (s.contact) slide.addText(s.contact, textOpts(L.text.contact, "center"));
}

export async function renderPptx(deck: Deck): Promise<Buffer> {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = deck.meta.title;
  if (deck.meta.author) pres.author = deck.meta.author;
  pres.company = "Penta Security";

  for (const slide of deck.slides) {
    const sl = pres.addSlide();
    sl.background = { color: tokens.color.bg.replace("#", "") };

    switch (slide.kind) {
      case "cover":
        fillCover(sl, slide, deck.meta.securityLevel);
        break;
      case "agenda":
        fillAgenda(sl, slide);
        applyFooter(sl, deck.meta.securityLevel, slide.kind);
        break;
      case "section":
        fillSection(sl, slide);
        applyFooter(sl, deck.meta.securityLevel, slide.kind);
        break;
      case "bullets":
        fillBullets(sl, slide);
        applyFooter(sl, deck.meta.securityLevel, slide.kind);
        break;
      case "twoCol":
        fillTwoCol(sl, slide);
        applyFooter(sl, deck.meta.securityLevel, slide.kind);
        break;
      case "metric":
        fillMetric(sl, slide);
        applyFooter(sl, deck.meta.securityLevel, slide.kind);
        break;
      case "quote":
        fillQuote(sl, slide);
        applyFooter(sl, deck.meta.securityLevel, slide.kind);
        break;
      case "image":
        fillImage(sl, slide);
        applyFooter(sl, deck.meta.securityLevel, slide.kind);
        break;
      case "cta":
        fillCta(sl, slide);
        applyFooter(sl, deck.meta.securityLevel, slide.kind);
        break;
      case "backCover":
        fillBackCover(sl);
        break;
    }
  }

  const out = await pres.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
