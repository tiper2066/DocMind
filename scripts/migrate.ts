import "dotenv/config";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local" });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  throw new Error("SUPABASE_DB_URL must be set in .env.local");
}

async function main() {
  const client = postgres(url!, { prepare: false, max: 1 });
  const db = drizzle(client);
  console.log("[migrate] applying migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] done.");
  await client.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
