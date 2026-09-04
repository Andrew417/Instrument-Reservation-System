import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: process.env.SQL_HOST
    ? {
        host: process.env.SQL_HOST,
        user: process.env.SQL_ADMIN_USER || process.env.SQL_USER || "postgres",
        password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || "",
        database: process.env.SQL_DB_NAME || "postgres",
        ssl: false,
      }
    : process.env.DATABASE_URL
      ? { url: process.env.DATABASE_URL, ssl: false }
      : {
          host: "127.0.0.1",
          user: "postgres",
          password: "",
          database: "postgres",
          ssl: false,
        },
  verbose: true,
});
