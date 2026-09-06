// migrate.ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function main() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations completed");
  await pool.end();
}

main().catch(console.error);
