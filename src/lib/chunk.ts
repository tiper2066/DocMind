const CHARS_PER_TOKEN = 3.5;
const TARGET_TOKENS = 600;
const MAX_TOKENS = 800;
const MIN_TAIL_TOKENS = 120;

const TARGET_CHARS = Math.floor(TARGET_TOKENS * CHARS_PER_TOKEN);
const MAX_CHARS = Math.floor(MAX_TOKENS * CHARS_PER_TOKEN);
const MIN_TAIL_CHARS = Math.floor(MIN_TAIL_TOKENS * CHARS_PER_TOKEN);

export type Chunk = {
  ord: number;
  text: string;
  tokenCount: number;
};

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export function chunkText(input: string): Chunk[] {
  const cleaned = input.replace(/\r\n?/g, "\n").trim();
  if (cleaned.length === 0) return [];

  const paragraphs = cleaned.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const buckets: string[] = [];
  let current = "";

  const push = () => {
    const t = current.trim();
    if (t.length > 0) buckets.push(t);
    current = "";
  };

  for (const para of paragraphs) {
    const piece = para.trim();
    if (piece.length > MAX_CHARS) {
      if (current.length > 0) push();
      for (const part of splitLargeBlock(piece)) buckets.push(part);
      continue;
    }
    const next = current.length === 0 ? piece : `${current}\n\n${piece}`;
    if (next.length > MAX_CHARS) {
      push();
      current = piece;
    } else {
      current = next;
    }
  }
  push();

  if (
    buckets.length >= 2 &&
    buckets[buckets.length - 1].length < MIN_TAIL_CHARS
  ) {
    const tail = buckets.pop()!;
    const prev = buckets.pop()!;
    const merged = `${prev}\n\n${tail}`;
    if (merged.length <= MAX_CHARS) buckets.push(merged);
    else buckets.push(prev, tail);
  }

  return buckets.map((text, i) => ({
    ord: i,
    text,
    tokenCount: estimateTokens(text),
  }));
}

function splitLargeBlock(block: string): string[] {
  const sentences = splitSentences(block);
  const out: string[] = [];
  let current = "";

  for (const s of sentences) {
    if (s.length > MAX_CHARS) {
      if (current.trim().length > 0) {
        out.push(current.trim());
        current = "";
      }
      for (const part of hardWrap(s, TARGET_CHARS)) out.push(part);
      continue;
    }
    const next = current.length === 0 ? s : `${current} ${s}`;
    if (next.length > MAX_CHARS) {
      out.push(current.trim());
      current = s;
    } else {
      current = next;
    }
    if (current.length >= TARGET_CHARS) {
      out.push(current.trim());
      current = "";
    }
  }
  if (current.trim().length > 0) out.push(current.trim());
  return out;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|(?<=[다요죠음])\s+(?=[가-힣A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function hardWrap(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) {
    out.push(s.slice(i, i + size));
  }
  return out;
}
