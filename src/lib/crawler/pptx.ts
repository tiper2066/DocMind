import JSZip from "jszip";
import * as cheerio from "cheerio";
import type { ExtractResult } from "./types";

export async function extractPptx(buf: ArrayBuffer): Promise<ExtractResult> {
  const zip = await JSZip.loadAsync(buf);

  const slideEntries = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort(byTrailingNumber);

  const slides: string[] = [];
  for (const path of slideEntries) {
    const xml = await zip.files[path].async("string");
    const $ = cheerio.load(xml, { xmlMode: true });
    const runs: string[] = [];
    $("a\\:t, t").each((_, el) => {
      const txt = $(el).text();
      if (txt && txt.trim().length > 0) runs.push(txt);
    });
    if (runs.length > 0) slides.push(runs.join("\n"));
  }

  const title = await extractCoreTitle(zip);

  return {
    title,
    text: slides.join("\n\n"),
    meta: { slides: slides.length },
  };
}

async function extractCoreTitle(zip: JSZip): Promise<string | undefined> {
  const core = zip.file("docProps/core.xml");
  if (!core) return undefined;
  const xml = await core.async("string");
  const $ = cheerio.load(xml, { xmlMode: true });
  const t = $("dc\\:title, title").first().text().trim();
  return t.length > 0 ? t : undefined;
}

function byTrailingNumber(a: string, b: string): number {
  const na = Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const nb = Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);
  return na - nb;
}
