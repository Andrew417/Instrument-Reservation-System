import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";
declare global {
  var _postgresPool: Pool | undefined;
}

function handleIdleClientError(err: any) {
  const msg = err?.message || String(err);
  // Normal idle socket closures by Cloud SQL proxy / PostgreSQL are auto-recycled by pg pool
  const isExpectedIdleClose =
    msg.includes("Connection terminated") ||
    msg.includes("ECONNRESET") ||
    msg.includes("57P01") ||
    msg.includes("socket closed") ||
    err?.code === "ECONNRESET";

  if (!isExpectedIdleClose && process.env.NODE_ENV !== "production") {
    console.log("[DB Pool Notice] Client recycled:", msg);
  }
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionTarget = process.env.SQL_HOST
      ? `SQL_HOST=${process.env.SQL_HOST}`
      : process.env.DATABASE_URL
        ? `DATABASE_URL host=${new URL(process.env.DATABASE_URL).host}`
        : "127.0.0.1 fallback";
    console.log("[DB] connecting via:", connectionTarget);
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
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 45000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });

      // Prevent unhandled pool-level errors from crashing the application
      global._postgresPool.on("error", handleIdleClientError);
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
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 45000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
        ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
      });

      global._postgresPool.on("error", handleIdleClientError);
    } else {
      global._postgresPool = new Pool({
        host: "127.0.0.1",
        user: "postgres",
        password: "",
        database: "postgres",
        max: isServerless ? 1 : 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 45000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });

      global._postgresPool.on("error", handleIdleClientError);
    }
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });

/**
 * Generic retry helper for database operations to gracefully handle
 * Cloud SQL scale-to-zero wake-up latency and transient connection resets.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number;
    delayMs?: number;
    label?: string;
  } = {},
): Promise<T> {
  const { retries = 5, delayMs = 2000, label = "Database operation" } = options;
  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const msg = [
        err?.message,
        err?.cause?.message,
        err?.cause?.cause?.message,
      ]
        .filter(Boolean)
        .join(" ");
      const isTransient =
        msg.includes("Connection terminated") ||
        msg.includes("timeout") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("ENOENT") ||
        msg.includes("57P01") || // admin_shutdown
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "ECONNREFUSED" ||
        err?.code === "ENOENT" ||
        err?.code === "57P01";

      if (!isTransient || attempt === retries) {
        throw err;
      }
      const waitTime = delayMs * Math.pow(1.5, attempt - 1);
      console.warn(
        `[${label}] Attempt ${attempt} encountered transient error (${msg}). Retrying in ${Math.round(waitTime)}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  throw lastError;
}

/**
 * Idempotently verifies the new columns for Band Pack and Handover Condition Check exist.
 * Note: DDL / schema alterations are handled via Drizzle & Cloud SQL migrations.
 */
export async function ensureEnhancedColumns(): Promise<void> {
  try {
    await withRetry(
      async () => {
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
      },
      { retries: 5, delayMs: 2500, label: "Enhanced Columns Check" },
    );
  } catch (err: any) {
    console.warn("[DB Warning] Column check notice:", err?.message || err);
  }
}

/**
 * Idempotently verifies push notification tables exist.
 * Note: DDL / schema alterations are handled via Drizzle migrations.
 */
export async function ensurePushTables(): Promise<void> {
  try {
    await withRetry(
      async () => {
        const res = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name IN ('push_subscriptions', 'admin_push_preferences');
        `);
        const found = res.rows.map((r: any) => r.table_name);
        console.log(
          `[DB] Push notification tables verified (${found.length}/2 present).`,
        );
      },
      { retries: 5, delayMs: 2000, label: "Push Notification Tables Check" },
    );
  } catch (err: any) {
    console.warn("[DB Warning] Push tables check notice:", err?.message || err);
  }
}

/**
 * Idempotently ensures service-specific instrument visibility schema, tables and constraints exist.
 */
export async function ensureServiceVisibilitySchema(): Promise<void> {
  try {
    await withRetry(
      async () => {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS "services" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "name" text NOT NULL,
            "is_archived" boolean DEFAULT false NOT NULL,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT "services_name_unique" UNIQUE("name")
          );

          CREATE TABLE IF NOT EXISTS "user_services" (
            "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
            "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE cascade,
            CONSTRAINT "user_services_user_id_service_id_pk" PRIMARY KEY("user_id","service_id")
          );

          CREATE TABLE IF NOT EXISTS "service_assignment_audit_log" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "target_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
            "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE cascade,
            "granted_by_admin_id" uuid NOT NULL REFERENCES "admins"("id") ON DELETE cascade,
            "action" text NOT NULL,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT "service_assignment_action_check" CHECK ("action" IN ('granted', 'revoked'))
          );

          DO $$ BEGIN 
            ALTER TABLE "instruments" ADD COLUMN IF NOT EXISTS "service_id" uuid REFERENCES "services"("id") ON DELETE set null;
          EXCEPTION WHEN duplicate_column THEN NULL; END $$;
        `);

        console.log("[DB] Service visibility tables and columns verified.");
      },
      { retries: 5, delayMs: 2000, label: "Service Visibility Tables Setup" },
    );
  } catch (err: any) {
    console.warn(
      "[DB Warning] Service visibility tables check notice:",
      err?.message || err,
    );
  }
}
