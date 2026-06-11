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

// PPT 레이아웃 개정 번호 — 레이아웃/토큰을 바꿔 출력이 달라지면 반드시 +1.
// .pptx 캐시 키에 포함되어, 옛 레이아웃으로 만든 캐시가 자동 무효화된다.
export const PPT_LAYOUT_REV = 3;

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
        x: 120, y: 624, w: 820, h: 104,
        style: { size: S.h3, weight: W.book, color: C.text.secondary, tracking: TR.body, lineHeight: t.lineHeight.normal, family: FAMILY },
        role: 'subtitle',
      },
      authorDate: {
        x: 120, y: 900, w: 800, h: 36,
        style: { size: S.body, weight: W.book, color: C.text.secondary, tracking: TR.body, family: FAMILY },
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
        style: { size: S.small, weight: W.bold, color: C.accent.penta, tracking: TR.eyebrow, valign: 'middle', family: FAMILY },
        role: 'index',
      },
      itemTitleProto: {
        x: 220, y: 320, w: 1580, h: 40,
        style: { size: S.h3, weight: W.medium, color: C.ink, tracking: TR.body, valign: 'middle', family: FAMILY },
        role: 'item',
      },
    },
    notes: [
      '항목 행 간격 80px, agendaRowY 가 항목 수 기준 수직 중앙 정렬',
      '인덱스는 작은 Penta 블루 eyebrow — 번호는 보조, 제목이 주인공',
    ],
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
        x: 152, y: 260, w: 1200, h: 36,
        style: { size: S.bodyLg, weight: W.bold, color: C.ink, tracking: TR.tight, lineHeight: t.lineHeight.normal, family: FAMILY },
        role: 'bullet.L0',
      },
      bulletL1Proto: {
        x: 184, y: 260, w: 1168, h: 28,
        style: { size: S.body, weight: W.book, color: C.ink2, tracking: TR.tight, lineHeight: t.lineHeight.normal, family: FAMILY },
        role: 'bullet.L1',
      },
    },
    notes: [
      'L0 marker: 12×12 Penta 블루 도형(bulletMarkerBox), x=120 — 텍스트 prefix 아님',
      'L1 marker: en-dash (—) 텍스트 prefix',
      '행 간격: tokens spacing.gap.bulletL0/L1 (행 위 여백), bulletRowYs 가 수직 중앙 정렬',
      '본문 폭 1200 — 줄길이(measure) 제한, 우측 여백은 의도',
      '권장 한도: L0 5~6개, L0 사이 L1 1~2개',
    ],
  },

  twoCol: {
    kind: 'twoCol',
    master: 'BODY',
    description: '2단 비교 — 좌/우 연한 배경 패널 + 상단 라벨 칩 (기하는 TWO_COL 상수).',
    shapes: [rule(120, 200)],
    text: {
      title: {
        x: 120, y: 120, w: 1680, h: 60,
        style: { size: S.h2, weight: W.bold, color: C.title, tracking: TR.heading, family: FAMILY },
        role: 'title',
      },
      leftLabel: {
        x: 156, y: 296, w: 240, h: 44,
        style: { size: S.small, weight: W.bold, color: C.accent.penta, tracking: TR.eyebrow, align: 'center', valign: 'middle', family: FAMILY },
        role: 'left.label',
      },
      leftBody: {
        x: 156, y: 376, w: 728, h: 488,
        style: { size: S.bodyLg, weight: W.book, color: C.ink, tracking: TR.tight, lineHeight: t.lineHeight.loose, family: FAMILY },
        role: 'left.body',
      },
      rightLabel: {
        x: 1036, y: 296, w: 240, h: 44,
        style: { size: S.small, weight: W.bold, color: C.accent.penta, tracking: TR.eyebrow, align: 'center', valign: 'middle', family: FAMILY },
        role: 'right.label',
      },
      rightBody: {
        x: 1036, y: 376, w: 728, h: 488,
        style: { size: S.bodyLg, weight: W.book, color: C.ink, tracking: TR.tight, lineHeight: t.lineHeight.loose, family: FAMILY },
        role: 'right.body',
      },
    },
    notes: [
      '패널·칩 기하는 TWO_COL 상수 — label/body 박스는 패널 내부 패딩 36 기준',
      'body 폰트는 fitTextSize 로 24→18 자동 축소 (패널 넘침 방지)',
    ],
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
        x: 120, y: 400, w: 520, h: 24,
        style: { size: S.small, weight: W.bold, color: C.text.secondary, tracking: TR.eyebrow, align: 'center', family: FAMILY },
        role: 'card.label',
      },
      cardValueProto: {
        x: 120, y: 440, w: 520, h: 120,
        style: { size: S['metric.value'], weight: W.bold, color: C.accent.penta, tracking: TR.heading, align: 'center', family: FAMILY },
        role: 'card.value',
      },
      cardDeltaProto: {
        x: 120, y: 600, w: 520, h: 28,
        style: { size: S.body, weight: W.medium, color: C.text.secondary, tracking: TR.tight, align: 'center', family: FAMILY },
        role: 'card.delta',
      },
    },
    notes: [
      '3-up: card x ∈ {120, 700, 1280}, w=520',
      '4-up: card x ∈ {120, 520, 920, 1320}, w=380',
      '카드 패널(METRIC_PANEL y360 h320)이 뒤에 깔린다 — 시각적 중앙(상향 bias)',
      'delta 양수 → semantic.positive(#16A34A), 음수 → semantic.negative(#DC2626)',
    ],
  },

  quote: {
    kind: 'quote',
    master: 'BODY',
    description: '인용 — 좌측 Penta 블루 바 + 인용문 + 속성. 기하는 quoteLayout 이 동적 계산.',
    text: {
      quote: {
        x: 400, y: 380, w: 1120, h: 320,
        style: { size: S.h2, weight: W.book, color: C.ink, tracking: TR.tight, lineHeight: t.lineHeight.normal, family: FAMILY },
        role: 'quote',
      },
      attribution: {
        x: 400, y: 760, w: 1120, h: 30,
        style: { size: S.body, weight: W.medium, color: C.text.secondary, tracking: TR.body, family: FAMILY },
        role: 'attribution',
      },
    },
    notes: ['좌표·폰트 크기는 quoteLayout(text) 결과 사용 — 프로토는 스타일 출처'],
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

const BULLET_ROW_H = { 0: 36, 1: 28 } as const;

// 간격은 "이 행 위에 두는 여백"으로, 행 자신의 레벨이 정한다 — L1(하위)은 부모에
// 가깝게(bulletL1), L0(새 그룹)은 그룹 분리 여백(bulletL0). 누적식이라 레벨 혼합도 안전.
// 블록 전체를 콘텐츠 영역 수직 중앙에 배치 — 내용이 적어도 하단이 비어 보이지 않는다.
export function bulletRowYs(levels: Array<0 | 1>): number[] {
  const rel: number[] = [];
  let y = 0;
  for (let i = 0; i < levels.length; i++) {
    if (i > 0) {
      y += levels[i] === 0 ? t.spacing.gap.bulletL0 : t.spacing.gap.bulletL1;
    }
    rel.push(y);
  }
  const last = levels.length - 1;
  const blockH = last >= 0 ? rel[last] + BULLET_ROW_H[levels[last]] : 0;
  const base = centeredTop(blockH);
  return rel.map((r) => base + r);
}

// L0 마커: 텍스트 prefix 대신 그리는 12×12 Penta 블루 사각형 (크기·정렬·색 독립 제어).
export function bulletMarkerBox(rowY: number): ShapeBox {
  return { x: 120, y: rowY + 12, w: 12, h: 12, fill: C.accent.penta };
}

// twoCol 패널/칩 기하 — 면(surface)으로 비교 구도를 만든다. 분할선 대체.
export const TWO_COL = {
  panels: [
    { x: 120, y: 260, w: 800, h: 640 },
    { x: 1000, y: 260, w: 800, h: 640 },
  ],
  panelFill: C.surface.panel,
  panelBorder: C.surface.panelBorder,
  panelRadius: 16,
  chipFill: C.surface.chip,
  chipH: 44,
  chipRadius: 22,
} as const;

// 칩 폭은 라벨 길이에 맞춰 결정적으로 (좌우 패딩 24×2, 최소 120 최대 560).
export function twoColChipW(label: string): number {
  return Math.min(560, Math.max(120, Math.round(estTextWidth(label, S.small)) + 48));
}

// metric 카드 패널 — 텍스트(label/value/delta)는 패널 안 고정 오프셋에 놓인다.
export const METRIC_PANEL = {
  y: 360,
  h: 320,
  fill: C.surface.panel,
  border: C.surface.panelBorder,
  radius: 16,
} as const;

// quote 동적 레이아웃 — 워터마크 따옴표 대신 좌측 Penta 블루 바. 인용문 길이에 따라
// 폰트를 fit 하고(44→32) 블록 전체(인용문+속성)를 수직 중앙 정렬한다.
export function quoteLayout(text: string): {
  bar: ShapeBox;
  quote: Box & { size: number };
  attribution: Box;
} {
  const boxW = 1120;
  const size = fitTextSize(text, boxW, 420, [S.h2, 40, 36, 32], t.lineHeight.normal);
  const textH = estLines(text, size, boxW) * size * t.lineHeight.normal;
  const attrH = 30;
  const gap = 48;
  const top = centeredTop(textH + gap + attrH);
  return {
    bar: { x: 352, y: top, w: 4, h: textH, fill: C.accent.penta },
    quote: { x: 400, y: top, w: boxW, h: textH, size },
    attribution: { x: 400, y: top + textH + gap, w: boxW, h: attrH },
  };
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
// 세로 위치는 콘텐츠 영역(rule 아래 220 ~ caption 위 960)의 중앙 590 기준.
export function diagramNodeColors(i: number): { bg: string; border: string } {
  const palette = t.color.diagram.node;
  return palette[i % palette.length];
}

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
    const areaY = 260;
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
  const cy = 590;
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
  awards: { x: 360, y: 866, w: 1200, h: 128 },
  footerBar: { x: 0, y: 1044, w: 1920, h: 36, fill: '#000000' } satisfies ShapeBox,
  copyright: {
    x: 0, y: 1050, w: 1920, h: 24,
    style: { size: S.micro, weight: W.book, color: '#FFFFFF', tracking: TR.body, align: 'center' as const, valign: 'middle' as const, family: FAMILY },
    role: 'copyright',
  } satisfies TextBox,
} as const;

export const BACK_COVER_COPYRIGHT = '© 2026 Penta Security Inc. All rights reserved.';

// 행 블록을 항목 수 기준으로 수직 중앙 정렬 (agenda rule 은 y220 이라 top 을 260 으로).
export function agendaRowY(rowIndex: number, count: number, rowGap = 80): number {
  const blockH = (count - 1) * rowGap + 40;
  return centeredTop(blockH, 260) + rowIndex * rowGap;
}

export function metricCardX(cardIndex: number, total: 3 | 4 = 3): number {
  if (total === 3) return [120, 700, 1280][cardIndex] ?? 120;
  return [120, 520, 920, 1320][cardIndex] ?? 120;
}

const WIDE_CHAR = /[\u1100-\u11FF\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFF60]/;

// 글자폭 추정: 전각(한글·CJK) 1em, 반각 0.6em. 실측 대신 추정인 이유: pptx 쪽엔
// 텍스트 측정 API 가 없어 미리보기·pptx 가 같은 값을 낼 계산식이어야 한다.
export function estTextWidth(text: string, size: number): number {
  let units = 0;
  for (const ch of text) units += WIDE_CHAR.test(ch) ? 1 : 0.6;
  return units * size;
}

// 예상 줄 수: \n 분할 후 각 세그먼트의 줄바꿈 횟수 합 (빈 줄도 1줄).
export function estLines(text: string, size: number, boxW: number): number {
  return text.split('\n').reduce((acc, seg) => {
    return acc + Math.max(1, Math.ceil(estTextWidth(seg, size) / (boxW * 0.94)));
  }, 0);
}

// 박스(boxW×maxH)에 들어가는 가장 큰 폰트 단계를 고른다 — 넘침/겹침의 구조적 방지.
export function fitTextSize(
  text: string,
  boxW: number,
  maxH: number,
  steps: number[],
  lineHeight: number,
): number {
  for (const size of steps) {
    if (estLines(text, size, boxW) * size * lineHeight <= maxH) return size;
  }
  return steps[steps.length - 1];
}

// metric value 가 카드 폭을 넘으면 2줄로 꺾여 아래 delta 와 겹친다(value 박스 h=120,
// 88px 한 줄 ≈106px). 한 줄에 들어가는 가장 큰 단계로 폰트를 줄인다.
export function metricValueSize(value: string, boxW: number): number {
  const steps = [S['metric.value'], 72, 64, 56, 48];
  for (const size of steps) {
    if (estTextWidth(value, size) <= boxW * 0.94) return size;
  }
  return steps[steps.length - 1];
}

// 본문 콘텐츠 영역(타이틀·rule 아래 ~ 푸터 위). 블록이 영역보다 크면 상단 고정
// (기존 동작 유지) — 넘침 자체는 fit 헬퍼가 막는다.
export const CONTENT_TOP = 240;
export const CONTENT_BOTTOM = 1000;

// bias 0.28 = 상향 배치 — 정중앙(0.5)보다 위가 제목과 묶여 안정적 (사용자 검수로 조정).
export function centeredTop(
  blockH: number,
  top = CONTENT_TOP,
  bottom = CONTENT_BOTTOM,
  bias = 0.28,
): number {
  return Math.max(top, top + (bottom - top - blockH) * bias);
}
