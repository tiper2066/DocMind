import "dotenv/config";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { workspaces } from "../src/db/schema";

config({ path: ".env.local" });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  throw new Error("SUPABASE_DB_URL must be set in .env.local");
}

const SEED_NAME = "Penta Security";

async function main() {
  const client = postgres(url!, { prepare: false, max: 1 });
  const db = drizzle(client);

  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.name, SEED_NAME));

  if (existing.length > 0) {
    console.log(`[seed] workspace already exists: id=${existing[0].id}`);
  } else {
    const [row] = await db
      .insert(workspaces)
      .values({ name: SEED_NAME })
      .returning();
    console.log(`[seed] created workspace: id=${row.id}`);
  }

  await client.end();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
