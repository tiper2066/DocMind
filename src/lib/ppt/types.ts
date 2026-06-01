import { z } from "zod";

export const SLIDE_KINDS = [
  "cover",
  "agenda",
  "section",
  "bullets",
  "twoCol",
  "metric",
  "quote",
  "image",
  "cta",
] as const;

export type SlideKind = (typeof SLIDE_KINDS)[number];

const SourceRef = z.object({
  sourceId: z.string().uuid(),
  chunkOrds: z.array(z.number().int().nonnegative()).min(1).max(10),
});
export type SourceRef = z.infer<typeof SourceRef>;

const CoverSlide = z.object({
  kind: z.literal("cover"),
  title: z.string().min(1).max(80),
  subtitle: z.string().max(140).optional(),
  author: z.string().max(60).optional(),
  date: z.string().max(40).optional(),
});

const AgendaSlide = z.object({
  kind: z.literal("agenda"),
  items: z.array(z.string().min(1).max(80)).min(2).max(7),
});

const SectionSlide = z.object({
  kind: z.literal("section"),
  index: z.number().int().min(1).max(20),
  eyebrow: z.string().max(40).optional(),
  title: z.string().min(1).max(60),
});

const Bullet = z.object({
  text: z.string().min(1).max(160),
  level: z.union([z.literal(0), z.literal(1)]),
});

const BulletsSlide = z.object({
  kind: z.literal("bullets"),
  title: z.string().min(1).max(60),
  bullets: z.array(Bullet).min(2).max(10),
});

const TwoColSlide = z.object({
  kind: z.literal("twoCol"),
  title: z.string().min(1).max(60),
  left: z.object({
    label: z.string().min(1).max(40),
    body: z.string().min(1).max(800),
  }),
  right: z.object({
    label: z.string().min(1).max(40),
    body: z.string().min(1).max(800),
  }),
});

const Metric = z.object({
  label: z.string().min(1).max(40),
  value: z.string().min(1).max(20),
  delta: z.string().max(20).optional(),
});

const MetricSlide = z.object({
  kind: z.literal("metric"),
  title: z.string().min(1).max(60),
  metrics: z.array(Metric).min(2).max(4),
});

const QuoteSlide = z.object({
  kind: z.literal("quote"),
  text: z.string().min(1).max(400),
  attribution: z.string().min(1).max(80),
});

const ImageSlide = z.object({
  kind: z.literal("image"),
  title: z.string().max(60).optional(),
  imageRef: z.string().min(1).max(200),
  caption: z.string().max(140).optional(),
});

const CtaSlide = z.object({
  kind: z.literal("cta"),
  headline: z.string().min(1).max(80),
  action: z.string().min(1).max(60),
  contact: z.string().max(80).optional(),
});

const SlideBody = z.discriminatedUnion("kind", [
  CoverSlide,
  AgendaSlide,
  SectionSlide,
  BulletsSlide,
  TwoColSlide,
  MetricSlide,
  QuoteSlide,
  ImageSlide,
  CtaSlide,
]);

export const SlideSchema = z.intersection(
  SlideBody,
  z.object({
    sourceRefs: z.array(SourceRef).max(8).optional(),
  }),
);

export type Slide = z.infer<typeof SlideSchema>;

export const DeckMetaSchema = z.object({
  title: z.string().min(1).max(120),
  reader: z.string().min(1).max(60),
  cta: z.string().min(1).max(60),
  objection: z.string().min(1).max(60),
  lengthPages: z.number().int().min(4).max(30),
  securityLevel: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  author: z.string().max(60).optional(),
  date: z.string().max(40).optional(),
});

export type DeckMeta = z.infer<typeof DeckMetaSchema>;

export const DeckSchema = z.object({
  meta: DeckMetaSchema,
  slides: z.array(SlideSchema).min(4).max(30),
  sourceRefs: z.array(SourceRef).max(40).optional(),
});

export type Deck = z.infer<typeof DeckSchema>;

export function slideKindFor(slide: Slide): SlideKind {
  return slide.kind;
}
