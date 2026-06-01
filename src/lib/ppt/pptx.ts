import path from "node:path";
import pptxgen from "pptxgenjs";

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
    valign: "top" as const,
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

function applyFooter(slide: pptxgen.Slide, securityLevel: 1 | 2 | 3 | 4 | 5) {
  shapeRect(slide, FOOTER_MASTER_BODY.bar);
  addImage(
    slide,
    assetPath("securityLevel", securityLevel),
    FOOTER_MASTER_BODY.securityChip,
  );
  addImage(slide, assetPath("pentaSmall"), FOOTER_MASTER_BODY.wordmark);
}

function applyCoverMaster(slide: pptxgen.Slide) {
  addImage(slide, assetPath("pentaLarge"), COVER_MASTER.wordmark);
  addImage(slide, assetPath("earth"), COVER_MASTER.earth);
  addImage(slide, assetPath("awardsCover"), COVER_MASTER.awards);
}

function fillCover(slide: pptxgen.Slide, s: Extract<Slide, { kind: "cover" }>) {
  applyCoverMaster(slide);
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
  s.bullets.forEach((b, i) => {
    const proto = b.level === 0 ? L.text.bulletL0Proto : L.text.bulletL1Proto;
    const box = { ...proto, y: bulletRowY(i, b.level) };
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
  const imageBox = { x: 220, y: 280, w: 1480, h: 680 };
  slide.addShape("rect", {
    x: pxToInchX(imageBox.x),
    y: pxToInchY(imageBox.y),
    w: pxToInchX(imageBox.w),
    h: pxToInchY(imageBox.h),
    fill: { color: "FAFAFA" },
    line: { color: "E5E5E5", width: 1 },
  });
  slide.addText(`🖼️ ${s.imageRef}`, {
    x: pxToInchX(imageBox.x),
    y: pxToInchY(imageBox.y + imageBox.h / 2 - 20),
    w: pxToInchX(imageBox.w),
    h: pxToInchY(40),
    fontFace: "Pretendard",
    fontSize: 12,
    color: "999B9E",
    align: "center",
    valign: "middle",
    isTextBox: true,
  });
  if (s.caption) slide.addText(s.caption, textOpts(L.text.caption, "center"));
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
        fillCover(sl, slide);
        break;
      case "agenda":
        fillAgenda(sl, slide);
        applyFooter(sl, deck.meta.securityLevel);
        break;
      case "section":
        fillSection(sl, slide);
        applyFooter(sl, deck.meta.securityLevel);
        break;
      case "bullets":
        fillBullets(sl, slide);
        applyFooter(sl, deck.meta.securityLevel);
        break;
      case "twoCol":
        fillTwoCol(sl, slide);
        applyFooter(sl, deck.meta.securityLevel);
        break;
      case "metric":
        fillMetric(sl, slide);
        applyFooter(sl, deck.meta.securityLevel);
        break;
      case "quote":
        fillQuote(sl, slide);
        applyFooter(sl, deck.meta.securityLevel);
        break;
      case "image":
        fillImage(sl, slide);
        applyFooter(sl, deck.meta.securityLevel);
        break;
      case "cta":
        fillCta(sl, slide);
        applyFooter(sl, deck.meta.securityLevel);
        break;
    }
  }

  const out = await pres.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
