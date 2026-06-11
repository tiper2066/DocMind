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

// 슬라이드 1장 → 읽기 라인 (첫 줄=헤더). 슬라이드 번호는 붙이지 않는다 —
// 위치 이동(번호 변화)과 내용 변경을 분리해 슬라이드 단위 비교에 쓰기 위함.
export function slideLines(s: Slide): string[] {
  const lines: string[] = [];
  const kind = str(s.kind);
  switch (kind) {
    case "cover":
      lines.push(`표지 · ${str(s.title)}`);
      if (s.subtitle) lines.push(`  ${str(s.subtitle)}`);
      break;
    case "agenda":
      lines.push(`목차`);
      for (const it of arr(s.items)) lines.push(`  - ${str(it)}`);
      break;
    case "section":
      lines.push(`섹션 · ${str(s.title)}`);
      break;
    case "bullets": {
      lines.push(`${str(s.title)}`);
      for (const b of arr(s.bullets)) {
        const bo = obj(b);
        const level = typeof bo.level === "number" ? bo.level : 0;
        lines.push(`  ${"  ".repeat(level)}• ${str(bo.text)}`);
      }
      break;
    }
    case "twoCol": {
      lines.push(`${str(s.title)}`);
      const l = obj(s.left);
      const r = obj(s.right);
      lines.push(`  [${str(l.label)}] ${str(l.body)}`);
      lines.push(`  [${str(r.label)}] ${str(r.body)}`);
      break;
    }
    case "metric":
      lines.push(`${str(s.title)}`);
      for (const m of arr(s.metrics)) {
        const mo = obj(m);
        const delta = mo.delta ? ` (${str(mo.delta)})` : "";
        lines.push(`  ${str(mo.label)}: ${str(mo.value)}${delta}`);
      }
      break;
    case "quote":
      lines.push(`인용`);
      lines.push(`  "${str(s.text)}" — ${str(s.attribution)}`);
      break;
    case "image":
      lines.push(`이미지 · ${str(s.title) || str(s.imageRef)}`);
      if (s.caption) lines.push(`  ${str(s.caption)}`);
      break;
    case "cta":
      lines.push(`CTA · ${str(s.headline)}`);
      if (s.action) lines.push(`  ${str(s.action)}`);
      break;
    default:
      lines.push(`${kind || "?"}`);
  }
  return lines;
}

// Deck(slidesJson) 를 슬라이드별 읽기 라인으로 변환.
export function deckToLines(deck: unknown): string[] {
  const slides = arr(obj(deck).slides) as Slide[];
  return slides.flatMap((s, i) => {
    const ls = slideLines(s);
    return [`#${i + 1} ${ls[0] ?? ""}`, ...ls.slice(1)];
  });
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

export type SlidePairType = "same" | "changed" | "added" | "removed";

export type SlidePair = {
  type: SlidePairType;
  baseIndex: number | null;
  targetIndex: number | null;
  // changed 쌍에만 해당 슬라이드의 라인 diff 를 채운다.
  rows: DiffRow[];
};

// 슬라이드 단위 정렬: 내용이 완전히 같은 슬라이드를 LCS 앵커(same)로 잡고,
// 앵커 사이 구간은 등장 순서대로 짝지어 changed, 남는 쪽을 removed/added 로 처리.
export function diffSlidePairs(base: unknown, target: unknown): SlidePair[] {
  const aLines = (arr(obj(base).slides) as Slide[]).map(slideLines);
  const bLines = (arr(obj(target).slides) as Slide[]).map(slideLines);
  const aKeys = aLines.map((ls) => ls.join("\n"));
  const bKeys = bLines.map((ls) => ls.join("\n"));

  const n = aKeys.length;
  const m = bKeys.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        aKeys[i] === bKeys[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: SlidePair[] = [];
  const pendA: number[] = [];
  const pendB: number[] = [];
  const flush = () => {
    const k = Math.min(pendA.length, pendB.length);
    for (let t = 0; t < k; t++) {
      out.push({
        type: "changed",
        baseIndex: pendA[t],
        targetIndex: pendB[t],
        rows: diffLines(aLines[pendA[t]], bLines[pendB[t]]),
      });
    }
    for (let t = k; t < pendA.length; t++)
      out.push({ type: "removed", baseIndex: pendA[t], targetIndex: null, rows: [] });
    for (let t = k; t < pendB.length; t++)
      out.push({ type: "added", baseIndex: null, targetIndex: pendB[t], rows: [] });
    pendA.length = 0;
    pendB.length = 0;
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aKeys[i] === bKeys[j]) {
      flush();
      out.push({ type: "same", baseIndex: i, targetIndex: j, rows: [] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pendA.push(i++);
    } else {
      pendB.push(j++);
    }
  }
  while (i < n) pendA.push(i++);
  while (j < m) pendB.push(j++);
  flush();

  return out;
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
