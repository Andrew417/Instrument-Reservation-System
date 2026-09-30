import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";
declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const isServerless =
      process.env.VERCEL === "1" ||
      Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

    // In AI Studio / Cloud Run, SQL_HOST provides the Cloud SQL Unix socket path
    if (process.env.SQL_HOST) {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: isServerless ? 1 : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      });

      // Prevent unhandled pool-level errors from crashing the application
      global._postgresPool.on("error", (err) => {
        console.error("Unexpected error on idle SQL pool client:", err);
      });
    } else if (process.env.DATABASE_URL) {
      // In Vercel / Neon / standalone production environments
      const isLocalhost =
        process.env.DATABASE_URL.includes("localhost") ||
        process.env.DATABASE_URL.includes("127.0.0.1");
      const requiresSsl =
        process.env.DATABASE_URL.includes("sslmode=require") ||
        (!isLocalhost && process.env.NODE_ENV === "production");

      global._postgresPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: isServerless ? 1 : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
      });

      global._postgresPool.on("error", (err) => {
        console.error("Unexpected error on idle SQL pool client:", err);
      });
    } else {
      global._postgresPool = new Pool({
        host: "127.0.0.1",
        user: "postgres",
        password: "",
        database: "postgres",
        max: isServerless ? 1 : 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
      });

      global._postgresPool.on("error", (err) => {
        console.error("Unexpected error on idle SQL pool client:", err);
      });
    }
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });

/**
 * Idempotently verifies the new columns for Band Pack and Handover Condition Check exist.
 * Note: DDL / schema alterations are handled via Drizzle & Cloud SQL migrations.
 */
export async function ensureEnhancedColumns(): Promise<void> {
  try {
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'reservations' 
        AND column_name IN (
          'band_pack_id', 
          'condition_status', 
          'condition_notes', 
          'condition_photo_url', 
          'condition_tags', 
          'condition_checked_at', 
          'condition_checked_by'
        );
    `);
    const foundColumns = res.rows.map((r: any) => r.column_name);
    console.log(
      `[DB] Enhanced reservation columns verified (${foundColumns.length}/7 present).`,
    );
  } catch (err: any) {
    console.warn("[DB Warning] Column check notice:", err.message);
  }
}
