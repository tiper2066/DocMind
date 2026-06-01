if (!process.env.INNGEST_DEV) process.env.INNGEST_DEV = "1";

import { eq, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { sources, sourceChunks, workspaces } from "../src/db/schema";
import { inngest } from "../src/inngest/client";
import { embed } from "../src/lib/embeddings";

const WORKSPACE_NAME = "Penta Security";
const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 180000;

async function main() {
  const url = process.argv[2] ?? "https://pentasecurity.com/products/wapples";

  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.name, WORKSPACE_NAME))
    .limit(1);
  if (!ws) {
    console.error(
      `workspace "${WORKSPACE_NAME}" not found. Run pnpm db:seed first.`,
    );
    process.exit(1);
  }

  console.log(`workspace: ${ws.id}`);
  console.log(`url:       ${url}`);

  const [src] = await db
    .insert(sources)
    .values({
      workspaceId: ws.id,
      kind: "url",
      url,
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
      console.log(`  summary: ${row.summary}`);
      console.log(`  tags:    ${(row.tags ?? []).join(", ")}`);
      console.log(`  chunks:  ${chunkCount}`);
      console.log(`  hash:    ${row.contentHash}`);

      const query = "WAPPLES 보안 기능";
      const [q] = await embed([query], "query");
      const literal = `[${q.join(",")}]`;
      const hits = await db.execute<{
        ord: number;
        snippet: string;
        sim: number;
      }>(sql`
        SELECT ord, substring(text, 1, 80) AS snippet,
               1 - (embedding <=> ${literal}::vector) AS sim
        FROM source_chunks
        WHERE source_id = ${src.id}
        ORDER BY embedding <=> ${literal}::vector
        LIMIT 5
      `);
      console.log(`\nvector search (top 5 for "${query}"):`);
      for (const h of hits) {
        console.log(`  [${h.sim.toFixed(3)}] #${h.ord} ${h.snippet}…`);
      }

      const okChunks = chunkCount >= 20;
      const okTags = (row.tags?.length ?? 0) >= 2;
      const okHits = hits.length >= 1;
      console.log(`\nacceptance:`);
      console.log(
        `  chunk ≥ 20:  ${okChunks ? "✓" : "✗"} (${chunkCount})`,
      );
      console.log(
        `  tags ≥ 2:    ${okTags ? "✓" : "✗"} (${row.tags?.length ?? 0})`,
      );
      console.log(`  vector hit:  ${okHits ? "✓" : "✗"} (${hits.length})`);
      process.exit(okChunks && okTags && okHits ? 0 : 1);
    }

    if (row.status === "error") {
      console.error("✗ source crawl failed (status=error)");
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.error(
    `\n✗ timeout after ${TIMEOUT_MS / 1000}s (last status: ${lastStatus})`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
