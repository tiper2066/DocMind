import { fetch } from "undici";
import * as cheerio from "cheerio";
import { parseHTML } from "linkedom";
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

export function extractHtml(html: string): ExtractResult {
  // jsdom 대신 linkedom: jsdom 의 의존성(html-encoding-sniffer@6)이 ESM-only 라
  // Vercel 런타임의 require() 외부 모듈 로드에서 ERR_REQUIRE_ESM 으로 죽었다(CLAUDE.md §8).
  // linkedom 은 Readability 가 요구하는 DOM document 를 제공하면서 번들/serverless 친화적.
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();

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
