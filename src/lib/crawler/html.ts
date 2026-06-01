import { fetch } from "undici";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { ExtractResult } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (compatible; DocMindBot/1.0; +https://docmind.pentasecurity.com)";
const MAX_HTML_BYTES = 8 * 1024 * 1024;

export async function fetchHtml(url: string): Promise<{
  status: number;
  contentType: string;
  body: ArrayBuffer;
  finalUrl: string;
}> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" },
  });
  if (!res.ok) {
    throw new Error(`fetch ${url} → HTTP ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_HTML_BYTES) {
    throw new Error(`response exceeds ${MAX_HTML_BYTES} bytes`);
  }
  return { status: res.status, contentType, body, finalUrl: res.url };
}

export function extractHtml(html: string, url: string): ExtractResult {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();

  if (article?.textContent && article.textContent.trim().length > 0) {
    return {
      title: article.title?.trim() || undefined,
      text: normalizeWhitespace(article.textContent),
      meta: {
        byline: article.byline ?? undefined,
        excerpt: article.excerpt ?? undefined,
        length: article.length,
      },
    };
  }

  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();
  const title = $("title").first().text().trim() || $("h1").first().text().trim();
  const text = normalizeWhitespace($("body").text());
  return { title: title || undefined, text };
}

function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
