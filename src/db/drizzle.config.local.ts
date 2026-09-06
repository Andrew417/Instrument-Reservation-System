import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";

// Load from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL missing in .env.local");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  // Add this for better Windows compatibility
  strict: true,
});
