// 콜드스타트 워밍. 발표 ~10분 전 1회 실행해 LLM·임베딩·DB·Inngest 첫 호출 지연을
// 미리 흡수한다. 각 핑은 독립 — 하나 실패해도 나머지는 계속(결과만 표로 보고).
if (!process.env.INNGEST_DEV) process.env.INNGEST_DEV = "1";

import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { anthropic, MODELS } from "../src/lib/anthropic";
import { embed } from "../src/lib/embeddings";
import { inngest } from "../src/inngest/client";

type Ping = { name: string; run: () => Promise<string> };

const PINGS: Ping[] = [
  {
    name: "DB (Supabase)",
    run: async () => {
      const [{ ok }] = await db.execute<{ ok: number }>(sql`select 1 as ok`);
      return `select 1 → ${ok}`;
    },
  },
  {
    name: "Anthropic (Sonnet)",
    run: async () => {
      const res = await anthropic.messages.create({
        model: MODELS.sonnet,
        max_tokens: 4,
        messages: [{ role: "user", content: "ping" }],
      });
      return `${res.usage.input_tokens}→${res.usage.output_tokens} tok`;
    },
  },
  {
    name: "Voyage (embed)",
    run: async () => {
      const [vec] = await embed(["warmup"], "query");
      return `dim=${vec.length}`;
    },
  },
  {
    name: "Inngest (send)",
    run: async () => {
      await inngest.send({ name: "demo/warmup.ping", data: { at: "warmup" } });
      return "event sent";
    },
  },
];

async function main() {
  console.log("[warmup] 시작\n");
  const results: Array<{ name: string; ms: number; ok: boolean; detail: string }> = [];
  for (const p of PINGS) {
    const t0 = Date.now();
    try {
      const detail = await p.run();
      results.push({ name: p.name, ms: Date.now() - t0, ok: true, detail });
      console.log(`  ✓ ${p.name} (${Date.now() - t0}ms) — ${detail}`);
    } catch (err) {
      results.push({
        name: p.name,
        ms: Date.now() - t0,
        ok: false,
        detail: (err as Error).message,
      });
      console.log(`  ✗ ${p.name} (${Date.now() - t0}ms) — ${(err as Error).message}`);
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n[warmup] 완료 — ${results.length - failed}/${results.length} 정상`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
