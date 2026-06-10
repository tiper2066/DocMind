import tokens from '@/design/tokens.ppt.json';

export type SlideKind =
  | 'cover'
  | 'agenda'
  | 'section'
  | 'bullets'
  | 'twoCol'
  | 'metric'
  | 'quote'
  | 'image'
  | 'cta';

export type SecurityLevel = 1 | 2 | 3 | 4 | 5;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextStyle {
  size: number;
  weight: 400 | 500 | 700;
  color: string;
  tracking?: number;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  family?: string;
}

export interface ImageBox extends Box {
  src: string;
  fit?: 'contain' | 'cover';
}

export interface ShapeBox extends Box {
  fill: string;
}

export interface TextBox extends Box {
  style: TextStyle;
  role: string;
}

export interface LayoutDef {
  kind: SlideKind;
  master: 'COVER' | 'BODY';
  description: string;
  shapes?: ShapeBox[];
  images?: Omit<ImageBox, 'src'> & { srcToken: string }[] | Array<Omit<ImageBox, 'src'> & { srcToken: string }>;
  text: Record<string, TextBox>;
  notes?: string[];
}

const t = tokens;
const C = t.color;
const S = t.size;
const TR = t.tracking;
const FAMILY = t.font.family.heading;
const W = t.font.weight as { book: 400; medium: 500; bold: 700 };

function rule(x: number, y: number, w = t.rule.accent.width, h = t.rule.accent.height): ShapeBox {
  return { x, y, w, h, fill: C.accent.penta };
}

export const FOOTER_MASTER_BODY = {
  bar: { ...t.footerMaster.body.bar } satisfies ShapeBox,
  barFill: { ...t.footerMaster.body.barFill },
  securityChip: { ...t.footerMaster.body.securityChip },
  wordmark: { ...t.footerMaster.body.wordmark },
} as const;

// 본문 슬라이드 푸터 바 색은 kind 별로 다르다(agenda=밝은회색, section=회색, 나머지=검정).
// 검정 바일 때만 보안칩·로고를 어두운 배경용(흰 텍스트) 에셋으로 바꾼다.
export function footerBarFill(kind: SlideKind): string {
  if (kind === 'agenda') return t.footerMaster.body.barFill.agenda;
  if (kind === 'section') return t.footerMaster.body.barFill.section;
  return t.footerMaster.body.barFill.default;
}

export function footerIsDarkBar(kind: SlideKind): boolean {
  return footerBarFill(kind) === t.footerMaster.body.barFill.default;
}

export const COVER_MASTER = {
  wordmark: { ...t.coverMaster.wordmark },
  earth: { ...t.coverMaster.earth },
  awards: { ...t.coverMaster.awards },
  securityChip: { ...t.coverMaster.securityChip },
} as const;

export const PPT_LAYOUTS: Record<SlideKind, LayoutDef> = {
  cover: {
    kind: 'cover',
    master: 'COVER',
    description: '표지 — Penta wordmark, earth illustration, awards badge group.',
    text: {
      title: {
        x: 120, y: 360, w: 820, h: 240,
        style: { size: S['cta.headline'], weight: W.bold, color: C.title, tracking: TR.heading, lineHeight: t.lineHeight.tight, valign: 'bottom', family: FAMILY },
        role: 'title',
      },
      subtitle: {
        x: 120, y: 624, w: 820, h: 60,
        style: { size: S.h3, weight: W.book, color: C.text.secondary, tracking: TR.body, lineHeight: t.lineHeight.normal, family: FAMILY },
        role: 'subtitle',
      },
      authorDate: {
        x: 120, y: 920, w: 800, h: 30,
        style: { size: S.small, weight: W.book, color: C.text.secondary, tracking: TR.body, family: FAMILY },
        role: 'meta',
      },
    },
    notes: ['footer master 미사용', 'awards/earth/wordmark는 COVER_MASTER가 공급'],
  },

  agenda: {
    kind: 'agenda',
    master: 'BODY',
    description: '목차 — 좌측 정렬 인덱스 + 항목 (최대 7개 권장).',
    shapes: [rule(120, 220)],
    text: {
      title: {
        x: 120, y: 120, w: 1680, h: 80,
        style: { size: S.h1, weight: W.bold, color: C.title, tracking: TR.heading, family: FAMILY },
        role: 'title',
      },
      itemIndexProto: {
        x: 120, y: 320, w: 80, h: 40,
        style: { size: S.h3, weight: W.book, color: C.text.secondary, tracking: TR.body, family: FAMILY },
        role: 'index',
      },
      itemTitleProto: {
        x: 220, y: 320, w: 1580, h: 40,
        style: { size: S.h3, weight: W.medium, color: C.ink, tracking: TR.body, family: FAMILY },
        role: 'item',
      },
    },
    notes: ['항목 행 간격 80px', 'itemIndexProto/itemTitleProto는 i번째 항목 좌표 = y + i*80'],
  },

  section: {
    kind: 'section',
    master: 'BODY',
    description: '섹션 디바이더 — 큰 워터마크 인덱스 + eyebrow + 제목.',
    text: {
      bigIndex: {
        x: 120, y: 200, w: 600, h: 300,
        style: { size: S['watermark.section'], weight: W.bold, color: C.footer.body, tracking: TR.display, family: FAMILY },
        role: 'watermark',
      },
      eyebrow: {
        x: 120, y: 560, w: 600, h: 24,
        style: { size: S.small, weight: W.bold, color: C.text.secondary, tracking: TR.eyebrow, family: FAMILY },
        role: 'eyebrow',
      },
      title: {
        x: 120, y: 600, w: 1500, h: 120,
        style: { size: S.display, weight: W.bold, color: C.title, tracking: TR.display, lineHeight: t.lineHeight.tight, family: FAMILY },
        role: 'title',
      },
    },
    notes: ['bigIndex는 회색 워터마크 — title이 위에 겹쳐 그려짐'],
  },

  bullets: {
    kind: 'bullets',
    master: 'BODY',
    description: '불릿 본문 — L0(■) + L1(—). 가장 빈도 높은 레이아웃.',
    shapes: [rule(120, 200)],
    text: {
      title: {
        x: 120, y: 120, w: 1680, h: 60,
        style: { size: S.h2, weight: W.bold, color: C.title, tracking: TR.heading, family: FAMILY },
        role: 'title',
      },
      bulletL0Proto: {
        x: 152, y: 260, w: 1528, h: 32,
        style: { size: S.h4, weight: W.medium, color: C.ink, tracking: TR.tight, lineHeight: t.lineHeight.normal, family: FAMILY },
        role: 'bullet.L0',
      },
      bulletL1Proto: {
        x: 200, y: 260, w: 1480, h: 28,
        style: { size: S.body, weight: W.book, color: C.ink2, tracking: TR.tight, lineHeight: t.lineHeight.normal, family: FAMILY },
        role: 'bullet.L1',
      },
    },
    notes: [
      'L0 marker: 12×12 검정 사각형(■), x=120',
      'L1 marker: en-dash (—), color=text.secondary, x=168',
      'L0 행 간격 56, L1 행 간격 36',
      '권장 한도: L0 5~6개, L0 사이 L1 1~2개',
    ],
  },

  twoCol: {
    kind: 'twoCol',
    master: 'BODY',
    description: '2단 비교 — 좌/우 동일 폭 800, 가운데 가는 분할선.',
    shapes: [
      rule(120, 200),
      { x: 960, y: 280, w: t.rule.divider.width, h: 720, fill: t.rule.divider.color },
    ],
    text: {
      title: {
        x: 120, y: 120, w: 1680, h: 60,
        style: { size: S.h2, weight: W.bold, color: C.title, tracking: TR.heading, family: FAMILY },
        role: 'title',
      },
      leftLabel: {
        x: 120, y: 280, w: 800, h: 24,
        style: { size: S.small, weight: W.bold, color: C.text.secondary, tracking: TR.eyebrow, family: FAMILY },
        role: 'left.label',
      },
      leftBody: {
        x: 120, y: 320, w: 800, h: 680,
        style: { size: S.bodyLg, weight: W.book, color: C.ink, tracking: TR.tight, lineHeight: t.lineHeight.loose, family: FAMILY },
        role: 'left.body',
      },
      rightLabel: {
        x: 1000, y: 280, w: 800, h: 24,
        style: { size: S.small, weight: W.bold, color: C.text.secondary, tracking: TR.eyebrow, family: FAMILY },
        role: 'right.label',
      },
      rightBody: {
        x: 1000, y: 320, w: 800, h: 680,
        style: { size: S.bodyLg, weight: W.book, color: C.ink, tracking: TR.tight, lineHeight: t.lineHeight.loose, family: FAMILY },
        role: 'right.body',
      },
    },
  },

  metric: {
    kind: 'metric',
    master: 'BODY',
    description: '지표 카드 3-up (또는 4-up). 값은 Penta 블루 88pt.',
    shapes: [rule(120, 200)],
    text: {
      title: {
        x: 120, y: 120, w: 1680, h: 60,
        style: { size: S.h2, weight: W.bold, color: C.title, tracking: TR.heading, family: FAMILY },
        role: 'title',
      },
      cardLabelProto: {
        x: 120, y: 360, w: 520, h: 24,
        style: { size: S.small, weight: W.bold, color: C.text.secondary, tracking: TR.eyebrow, family: FAMILY },
        role: 'card.label',
      },
      cardValueProto: {
        x: 120, y: 400, w: 520, h: 120,
        style: { size: S['metric.value'], weight: W.bold, color: C.accent.penta, tracking: TR.heading, family: FAMILY },
        role: 'card.value',
      },
      cardDeltaProto: {
        x: 120, y: 560, w: 520, h: 28,
        style: { size: S.body, weight: W.medium, color: C.text.secondary, tracking: TR.tight, family: FAMILY },
        role: 'card.delta',
      },
    },
    notes: [
      '3-up: card x ∈ {120, 700, 1280}, w=520',
      '4-up: card x ∈ {120, 520, 920, 1320}, w=380',
      'delta 양수 → semantic.positive(#16A34A), 음수 → semantic.negative(#DC2626)',
    ],
  },

  quote: {
    kind: 'quote',
    master: 'BODY',
    description: '인용 — 회색 큰 따옴표 워터마크 + 인용문 + 속성.',
    text: {
      quoteMark: {
        x: 120, y: 200, w: 240, h: 280,
        style: { size: S['watermark.quote'], weight: W.bold, color: C.footer.body, family: FAMILY },
        role: 'watermark',
      },
      quote: {
        x: 220, y: 380, w: 1480, h: 320,
        style: { size: S.h2, weight: W.book, color: C.ink, tracking: TR.tight, lineHeight: t.lineHeight.normal, family: FAMILY },
        role: 'quote',
      },
      attribution: {
        x: 220, y: 760, w: 1480, h: 30,
        style: { size: S.body, weight: W.book, color: C.text.secondary, tracking: TR.body, family: FAMILY },
        role: 'attribution',
      },
    },
    notes: ['attribution.y는 인용문 길이에 따라 동적 조정 권장 (quote.bottom + 60)'],
  },

  image: {
    kind: 'image',
    master: 'BODY',
    description: '이미지 — 8a(제목 있음, 기본) 좌표. 8b(풀블리드)는 layouts.imageFullBleed 참조.',
    shapes: [rule(120, 200)],
    text: {
      title: {
        x: 120, y: 120, w: 1680, h: 60,
        style: { size: S.h2, weight: W.bold, color: C.title, tracking: TR.heading, family: FAMILY },
        role: 'title',
      },
      caption: {
        x: 220, y: 980, w: 1480, h: 30,
        style: { size: S.small, weight: W.book, color: C.text.secondary, tracking: TR.body, align: 'center', family: FAMILY },
        role: 'caption',
      },
    },
    notes: [
      'image box: x=220 y=280 w=1480 h=680 (object-fit: contain)',
      '8b 풀블리드 변형은 별도 layouts.imageFullBleed 호출',
    ],
  },

  cta: {
    kind: 'cta',
    master: 'BODY',
    description: '마무리 액션 — 가운데 정렬 헤드라인 + Penta 블루 라인 + 행동 + 컨택트.',
    shapes: [{ x: 920, y: 540, w: t.rule.ctaAccent.width, h: t.rule.ctaAccent.height, fill: C.accent.penta }],
    text: {
      headline: {
        x: 120, y: 380, w: 1680, h: 140,
        style: { size: S['cta.headline'], weight: W.bold, color: C.ink, tracking: TR.heading, lineHeight: t.lineHeight.tight, align: 'center', family: FAMILY },
        role: 'headline',
      },
      action: {
        x: 120, y: 580, w: 1680, h: 40,
        style: { size: S.h3, weight: W.book, color: C.text.secondary, tracking: TR.body, align: 'center', family: FAMILY },
        role: 'action',
      },
      contact: {
        x: 120, y: 660, w: 1680, h: 32,
        style: { size: S.h4, weight: W.medium, color: C.accent.penta, tracking: TR.body, align: 'center', family: FAMILY },
        role: 'contact',
      },
    },
  },
};

export const imageFullBleed = {
  image: { x: 0, y: 0, w: 1920, h: 1044, fit: 'cover' as const },
  caption: {
    x: 60, y: 990, w: 1800, h: 30,
    style: { size: S.small, weight: W.book, color: '#FFFFFF', tracking: TR.body, align: 'center' as const, family: FAMILY },
    role: 'caption',
  } satisfies TextBox,
};

export function assetPath(
  key: keyof typeof t.assets | string,
  level?: SecurityLevel,
  opts?: { dark?: boolean },
): string {
  const base = t.assets.basePath;
  if (key === 'securityLevel') {
    const lv = level ?? 1;
    const file = t.assets.securityLevel[String(lv) as '1' | '2' | '3' | '4' | '5'];
    // 어두운 배경용 변형은 같은 파일명 + `_dark` 접미사 (security_level_N_dark.png).
    const resolved = opts?.dark ? file.replace(/\.png$/, '_dark.png') : file;
    return `${base}/${resolved}`;
  }
  const file = (t.assets as Record<string, unknown>)[key as string];
  if (typeof file !== 'string') {
    throw new Error(`Unknown asset key: ${String(key)}`);
  }
  return `${base}/${file}`;
}

// 행마다 "그 행을 떠나는 높이"를 누적해 다음 행 top 을 정한다. 단일 gap×index 방식은
// L0/L1 이 섞이면 누적이 어긋나 행이 겹친다(이전 버그). 누적식이라 레벨 혼합도 안전.
export function bulletRowYs(levels: Array<0 | 1>, baseY = 260): number[] {
  const ys: number[] = [];
  let y = baseY;
  for (let i = 0; i < levels.length; i++) {
    ys.push(y);
    const advance =
      levels[i] === 0 ? t.spacing.gap.bulletL0 : t.spacing.gap.bulletL1;
    y += advance;
  }
  return ys;
}

export interface DiagramArrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface DiagramGeometry {
  boxes: Box[];
  arrows: DiagramArrow[];
  vertical: boolean;
  labelStyle: TextStyle;
}

// image 슬라이드용 선형 flow 다이어그램 기하. 노드 2~5개를 등간격 배치하고
// 인접 노드 사이에만 화살표를 둔다(끝점을 우리가 계산 → 겹침 없음, 결정적).
export function diagramGeometry(
  count: number,
  direction: 'horizontal' | 'vertical' = 'horizontal',
): DiagramGeometry {
  const n = Math.max(2, Math.min(5, count));
  const labelStyle: TextStyle = {
    size: S.h3,
    weight: W.medium,
    color: C.ink2,
    align: 'center',
    valign: 'middle',
    lineHeight: t.lineHeight.normal,
    family: FAMILY,
  };

  if (direction === 'vertical') {
    const areaY = 300;
    const areaH = 660;
    const gap = 56;
    const boxW = 760;
    const x = (1920 - boxW) / 2;
    const boxH = (areaH - (n - 1) * gap) / n;
    const boxes: Box[] = [];
    for (let i = 0; i < n; i++) {
      boxes.push({ x, y: areaY + i * (boxH + gap), w: boxW, h: boxH });
    }
    const arrows: DiagramArrow[] = [];
    for (let i = 0; i < n - 1; i++) {
      const cx = x + boxW / 2;
      arrows.push({ x1: cx, y1: boxes[i].y + boxH, x2: cx, y2: boxes[i + 1].y });
    }
    return { boxes, arrows, vertical: true, labelStyle };
  }

  const areaX = 220;
  const areaW = 1480;
  const gap = 72;
  const boxH = 180;
  const cy = 620;
  const boxW = (areaW - (n - 1) * gap) / n;
  const boxes: Box[] = [];
  for (let i = 0; i < n; i++) {
    boxes.push({ x: areaX + i * (boxW + gap), y: cy - boxH / 2, w: boxW, h: boxH });
  }
  const arrows: DiagramArrow[] = [];
  for (let i = 0; i < n - 1; i++) {
    arrows.push({ x1: boxes[i].x + boxW, y1: cy, x2: boxes[i + 1].x, y2: cy });
  }
  return { boxes, arrows, vertical: false, labelStyle };
}

// 뒷표지(Back Cover) — CTA 다음 마지막 슬라이드. footer 미사용(독립 마스터).
// 이미지 박스 w·h 는 에셋 실제 종횡비에 맞춘다(penta_color 8.86:1, awards 9.37:1).
// 종횡비를 맞춰야 미리보기(contain)와 PPT 렌더가 동일하게 보이고 왜곡이 없다.
export const BACK_COVER = {
  wordmark: { x: 770, y: 408, w: 380, h: 43 },
  urls: [
    { label: 'KOREA', url: 'www.pentasecurity.co.kr' },
    { label: 'GLOBAL', url: 'www.pentasecurity.com' },
    { label: 'JAPAN', url: 'www.pentasecurity.co.jp' },
  ],
  urlRowGap: 36,
  urlLabelProto: {
    x: 700, y: 504, w: 200, h: 28,
    style: { size: S.small, weight: W.bold, color: C.ink, tracking: TR.body, align: 'right' as const, valign: 'middle' as const, family: FAMILY },
    role: 'url.label',
  } satisfies TextBox,
  urlValueProto: {
    x: 920, y: 504, w: 320, h: 28,
    style: { size: S.small, weight: W.book, color: C.text.secondary, tracking: TR.body, align: 'left' as const, valign: 'middle' as const, family: FAMILY },
    role: 'url.value',
  } satisfies TextBox,
  awards: { x: 210, y: 850, w: 1500, h: 160 },
  footerBar: { x: 0, y: 1044, w: 1920, h: 36, fill: '#000000' } satisfies ShapeBox,
  copyright: {
    x: 0, y: 1050, w: 1920, h: 24,
    style: { size: S.micro, weight: W.book, color: '#FFFFFF', tracking: TR.body, align: 'center' as const, valign: 'middle' as const, family: FAMILY },
    role: 'copyright',
  } satisfies TextBox,
} as const;

export const BACK_COVER_COPYRIGHT = '© 2026 Penta Security Inc. All rights reserved.';

export function agendaRowY(rowIndex: number, baseY = 320, rowGap = 80): number {
  return baseY + rowIndex * rowGap;
}

export function metricCardX(cardIndex: number, total: 3 | 4 = 3): number {
  if (total === 3) return [120, 700, 1280][cardIndex] ?? 120;
  return [120, 520, 920, 1320][cardIndex] ?? 120;
}
