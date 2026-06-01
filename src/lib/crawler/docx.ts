import mammoth from "mammoth";
import type { ExtractResult } from "./types";

export async function extractDocx(buf: ArrayBuffer): Promise<ExtractResult> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
  const text = normalize(value);
  const title = firstLineAsTitle(text);
  return { title, text };
}

function firstLineAsTitle(text: string): string | undefined {
  const line = text.split("\n", 1)[0]?.trim();
  if (!line || line.length > 140) return undefined;
  return line;
}

function normalize(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
