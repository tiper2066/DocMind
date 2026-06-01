import { eq, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { createClient } from "@supabase/supabase-js";
import { db } from "../src/db/client";
import { sources, sourceChunks, workspaces } from "../src/db/schema";
import { inngest } from "../src/inngest/client";

const WORKSPACE_NAME = "Penta Security";
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 180000;

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error(
      "usage: pnpm verify:kb-file <public-file-url>\n" +
        "e.g.   pnpm verify:kb-file https://bitcoin.org/bitcoin.pdf",
    );
    process.exit(1);
  }

  console.log(`fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`fetch failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const filename = url.split("/").pop() ?? "file.pdf";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!["pdf", "docx", "xlsx", "pptx"].includes(ext)) {
    console.error(`unsupported extension: .${ext}`);
    process.exit(1);
  }
  console.log(`size:     ${buf.byteLength} bytes (.${ext})`);

  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.name, WORKSPACE_NAME))
    .limit(1);
  if (!ws) {
    console.error(`workspace "${WORKSPACE_NAME}" not found`);
    process.exit(1);
  }
  console.log(`workspace: ${ws.id}`);

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const bucket = process.env.SUPABASE_BUCKET_SOURCES!;
  const key = `${ws.id}/${ulid()}/${filename}`;
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(key, buf, { contentType: res.headers.get("content-type") ?? undefined });
  if (upErr) {
    console.error(`upload failed: ${upErr.message}`);
    process.exit(1);
  }
  console.log(`uploaded:  ${bucket}/${key}`);

  const [src] = await db
    .insert(sources)
    .values({
      workspaceId: ws.id,
      kind: "file",
      fileKey: key,
      title: filename,
      status: "crawling",
    })
    .returning({ id: sources.id });
  console.log(`source:    ${src.id}`);

  await inngest.send({
    name: "source/crawl.requested",
    data: { workspaceId: ws.id, sourceId: src.id },
  });
  console.log("event sent → source/crawl.requested\n");

  const start = Date.now();
  let lastStatus = "crawling";
  while (Date.now() - start < TIMEOUT_MS) {
    const [row] = await db
      .select()
      .from(sources)
      .where(eq(sources.id, src.id))
      .limit(1);
    if (!row) throw new Error("source row vanished");

    if (row.status !== lastStatus) {
      console.log(
        `[${((Date.now() - start) / 1000).toFixed(1)}s] status: ${row.status}`,
      );
      lastStatus = row.status;
    }

    if (row.status === "ready") {
      const [{ chunkCount }] = await db
        .select({ chunkCount: sql<number>`count(*)::int` })
        .from(sourceChunks)
        .where(eq(sourceChunks.sourceId, src.id));
      console.log(`\n✓ ready in ${((Date.now() - start) / 1000).toFixed(1)}s`);
      console.log(`  title:   ${row.title}`);
      console.log(`  summary: ${row.summary?.slice(0, 200)}…`);
      console.log(`  tags:    ${(row.tags ?? []).join(", ")}`);
      console.log(`  chunks:  ${chunkCount}`);
      process.exit(0);
    }
    if (row.status === "error") {
      console.error("✗ crawl failed (status=error)");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.error(`✗ timeout after ${TIMEOUT_MS / 1000}s (last status: ${lastStatus})`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
