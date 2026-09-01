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
        idleTimeoutMillis: isServerless ? 10000 : 30000,
        connectionTimeoutMillis: 5000,
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
        idleTimeoutMillis: isServerless ? 10000 : 30000,
        connectionTimeoutMillis: 5000,
        ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
      });
    } else {
      global._postgresPool = new Pool({
        host: "127.0.0.1",
        user: "postgres",
        password: "",
        database: "postgres",
        max: isServerless ? 1 : 10,
        idleTimeoutMillis: isServerless ? 10000 : 30000,
        connectionTimeoutMillis: 5000,
      });
    }
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });
