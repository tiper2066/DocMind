import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { inngest, SourceCrawlRequested } from "./client";
import { db } from "@/db/client";
import { sources, sourceChunks } from "@/db/schema";
import { anthropic, MODELS, systemWithCache } from "@/lib/anthropic";
import { embed } from "@/lib/embeddings";
import { chunkText } from "@/lib/chunk";
import { downloadSource } from "@/lib/storage";
import { fetchHtml, extractHtml } from "@/lib/crawler/html";
import { extractPdf } from "@/lib/crawler/pdf";
import { extractDocx } from "@/lib/crawler/docx";
import { extractXlsx } from "@/lib/crawler/xlsx";
import { extractPptx } from "@/lib/crawler/pptx";
import type { ExtractResult } from "@/lib/crawler/types";

type SourceRow = typeof sources.$inferSelect;

export const crawlSource = inngest.createFunction(
  {
    id: "crawl-source",
    name: "Crawl source",
    retries: 2,
    triggers: [{ event: "source/crawl.requested" }],
    onFailure: async ({ event }) => {
      const orig = event.data.event.data as {
        workspaceId?: string;
        sourceId?: string;
      };
      if (!orig.sourceId || !orig.workspaceId) return;
      await db
        .update(sources)
        .set({ status: "error", updatedAt: new Date() })
        .where(
          and(
            eq(sources.id, orig.sourceId),
            eq(sources.workspaceId, orig.workspaceId),
          ),
        );
    },
  },
  async ({ event, step }) => {
    const data = SourceCrawlRequested.parse(event.data);

    const extracted = await step.run("fetch-and-parse", async () => {
      const row = await loadSource(data.workspaceId, data.sourceId);
      const result = await dispatchParse(row);
      const text = result.text.trim();
      if (text.length === 0) {
        throw new Error(`empty extraction for source ${data.sourceId}`);
      }
      return {
        text,
        title: result.title ?? null,
        contentHash: sha256(text),
      };
    });

    const chunkCount = await step.run("chunk-and-embed", async () => {
      const chunks = chunkText(extracted.text);
      if (chunks.length === 0) {
        throw new Error("chunkText returned 0 chunks");
      }
      const vectors = await embed(
        chunks.map((c) => c.text),
        "document",
      );
      await db
        .delete(sourceChunks)
        .where(eq(sourceChunks.sourceId, data.sourceId));
      await db.insert(sourceChunks).values(
        chunks.map((c, i) => ({
          sourceId: data.sourceId,
          ord: c.ord,
          text: c.text,
          tokenCount: c.tokenCount,
          embedding: vectors[i],
        })),
      );
      return chunks.length;
    });

    const meta = await step.run("generate-metadata", async () => {
      return await generateSourceMetadata(extracted.text, extracted.title);
    });

    await step.run("finalize-ready", async () => {
      await db
        .update(sources)
        .set({
          status: "ready",
          title: meta.title,
          summary: meta.summary,
          tags: meta.tags,
          contentHash: extracted.contentHash,
          lastCrawledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sources.id, data.sourceId),
            eq(sources.workspaceId, data.workspaceId),
          ),
        );
    });

    return {
      ok: true,
      chunkCount,
      contentHash: extracted.contentHash,
    };
  },
);

export async function loadSource(
  workspaceId: string,
  sourceId: string,
): Promise<SourceRow> {
  const rows = await db
    .select()
    .from(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error(`source ${sourceId} not found in workspace ${workspaceId}`);
  }
  return row;
}

export async function dispatchParse(row: SourceRow): Promise<ExtractResult> {
  if (row.kind === "url") {
    if (!row.url) throw new Error(`source ${row.id} missing url`);
    const fetched = await fetchHtml(row.url);
    const ct = fetched.contentType.toLowerCase();
    if (ct.includes("application/pdf")) {
      return extractPdf(fetched.body);
    }
    if (ct.startsWith("text/") || ct.includes("xml")) {
      const html = decodeHtml(fetched.body, fetched.contentType);
      return extractHtml(html, fetched.finalUrl);
    }
    throw new Error(`unsupported content-type for URL source: ${ct}`);
  }

  if (row.kind === "file") {
    if (!row.fileKey) throw new Error(`source ${row.id} missing fileKey`);
    const buf = await downloadSource(row.fileKey);
    const ext = pathExt(row.fileKey);
    switch (ext) {
      case "pdf":
        return extractPdf(buf);
      case "docx":
        return extractDocx(buf);
      case "xlsx":
        return extractXlsx(buf);
      case "pptx":
        return extractPptx(buf);
      default:
        throw new Error(`unsupported file extension: .${ext}`);
    }
  }

  throw new Error(`unknown source kind: ${row.kind}`);
}

const METADATA_SYSTEM = `너는 사내 지식 문서의 메타데이터 추출기다. 주어진 문서를 읽고 set_metadata 도구를 호출해 결과를 저장한다.

규칙:
- title: 한국어 또는 영문, 최대 80자. 본문에 명시된 제목이 있으면 그것을 우선.
- summary: 한국어 2~3 문장. 손실 없이 핵심만, 마케팅 수식어 금지.
- tags: 3~5 개. 짧은 명사구. 제품명/표준/부서 등 도메인 용어 우선. 소문자, 공백 대신 하이픈.

본문에 없는 사실을 추측·생성하지 말 것.`;

const MetadataSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(1200),
  tags: z.array(z.string().min(1).max(60)).min(2).max(8),
});

type MetadataResult = z.infer<typeof MetadataSchema>;

async function generateSourceMetadata(
  text: string,
  hintTitle: string | null,
): Promise<MetadataResult> {
  const sample = text.slice(0, 6000);
  const hint = hintTitle ? `\n원본 추정 제목: ${hintTitle}` : "";

  const res = await anthropic.messages.create({
    model: MODELS.sonnet,
    max_tokens: 600,
    system: systemWithCache([METADATA_SYSTEM]),
    tools: [
      {
        name: "set_metadata",
        description: "Save the document title, summary, and tags.",
        input_schema: {
          type: "object",
          required: ["title", "summary", "tags"],
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            tags: {
              type: "array",
              items: { type: "string" },
              minItems: 2,
              maxItems: 8,
            },
          },
        },
      },
    ],
    tool_choice: { type: "tool", name: "set_metadata" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `<document>\n${sample}\n</document>` },
          {
            type: "text",
            text: `위 문서의 메타데이터를 set_metadata 도구로 저장하라.${hint}`,
          },
        ],
      },
    ],
  });

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block");
  }
  return MetadataSchema.parse(toolUse.input);
}

function decodeHtml(body: ArrayBuffer, contentType: string): string {
  const m = /charset=([^;\s]+)/i.exec(contentType);
  const charset = (m?.[1] ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(charset, { fatal: false }).decode(body);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(body);
  }
}

function pathExt(key: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(key);
  return (m?.[1] ?? "").toLowerCase();
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
