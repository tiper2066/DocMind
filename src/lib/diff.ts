// slides_json(Deck) → 사람이 읽을 텍스트 라인으로 평탄화 후 LCS 라인 diff.
// 외부 의존성 없음.

export type DiffRow = { type: "same" | "add" | "del"; text: string };

type Slide = Record<string, unknown>;

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

// Deck(slidesJson) 를 슬라이드별 읽기 라인으로 변환.
export function deckToLines(deck: unknown): string[] {
  const slides = arr(obj(deck).slides) as Slide[];
  const lines: string[] = [];

  slides.forEach((s, i) => {
    const n = i + 1;
    const kind = str(s.kind);
    switch (kind) {
      case "cover":
        lines.push(`#${n} 표지 · ${str(s.title)}`);
        if (s.subtitle) lines.push(`  ${str(s.subtitle)}`);
        break;
      case "agenda":
        lines.push(`#${n} 목차`);
        for (const it of arr(s.items)) lines.push(`  - ${str(it)}`);
        break;
      case "section":
        lines.push(`#${n} 섹션 · ${str(s.title)}`);
        break;
      case "bullets": {
        lines.push(`#${n} ${str(s.title)}`);
        for (const b of arr(s.bullets)) {
          const bo = obj(b);
          const level = typeof bo.level === "number" ? bo.level : 0;
          lines.push(`  ${"  ".repeat(level)}• ${str(bo.text)}`);
        }
        break;
      }
      case "twoCol": {
        lines.push(`#${n} ${str(s.title)}`);
        const l = obj(s.left);
        const r = obj(s.right);
        lines.push(`  [${str(l.label)}] ${str(l.body)}`);
        lines.push(`  [${str(r.label)}] ${str(r.body)}`);
        break;
      }
      case "metric":
        lines.push(`#${n} ${str(s.title)}`);
        for (const m of arr(s.metrics)) {
          const mo = obj(m);
          const delta = mo.delta ? ` (${str(mo.delta)})` : "";
          lines.push(`  ${str(mo.label)}: ${str(mo.value)}${delta}`);
        }
        break;
      case "quote":
        lines.push(`#${n} 인용`);
        lines.push(`  "${str(s.text)}" — ${str(s.attribution)}`);
        break;
      case "image":
        lines.push(`#${n} 이미지 · ${str(s.title) || str(s.imageRef)}`);
        if (s.caption) lines.push(`  ${str(s.caption)}`);
        break;
      case "cta":
        lines.push(`#${n} CTA · ${str(s.headline)}`);
        if (s.action) lines.push(`  ${str(s.action)}`);
        break;
      default:
        lines.push(`#${n} ${kind || "?"}`);
    }
  });

  return lines;
}

// LCS 기반 라인 diff.
export function diffLines(a: string[], b: string[]): DiffRow[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}

export function diffDecks(base: unknown, target: unknown): DiffRow[] {
  return diffLines(deckToLines(base), deckToLines(target));
}

export function diffStats(rows: DiffRow[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const r of rows) {
    if (r.type === "add") added++;
    else if (r.type === "del") removed++;
  }
  return { added, removed };
}
