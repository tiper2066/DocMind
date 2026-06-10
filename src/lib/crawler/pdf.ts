import { extractText, getDocumentProxy, getMeta } from "unpdf";
import type { ExtractResult } from "./types";

// pdf-parse(→pdfjs-dist v5) 는 브라우저 전역 DOMMatrix 를 참조해 Vercel 서버리스에서
// ReferenceError 로 죽었다(CLAUDE.md §8). unpdf 는 Node/serverless 호환 pdfjs 빌드를
// 내장해 DOM 전역 없이 동작한다.
export async function extractPdf(buf: ArrayBuffer): Promise<ExtractResult> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  // mergePages: true → text 는 단일 string.
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const meta = await getMeta(pdf).catch(() => null);
  return {
    title: pickTitle(meta),
    text: normalize(text),
    meta: { pages: totalPages },
  };
}

function pickTitle(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as { info?: { Title?: unknown } };
  const t = m.info?.Title;
  if (typeof t === "string" && t.trim().length > 0) return t.trim();
  return undefined;
}

function normalize(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/-\n(?=[a-z])/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
