import { PDFParse } from "pdf-parse";
import type { ExtractResult } from "./types";

export async function extractPdf(buf: ArrayBuffer): Promise<ExtractResult> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const info = await parser.getInfo().catch(() => null);
    const result = await parser.getText();
    const title = pickTitle(info);
    return {
      title,
      text: normalize(result.text),
      meta: { pages: result.total },
    };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function pickTitle(info: unknown): string | undefined {
  if (!info || typeof info !== "object") return undefined;
  const i = info as { info?: { Title?: unknown }; metadata?: { Title?: unknown } };
  const t = i.info?.Title ?? i.metadata?.Title;
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
