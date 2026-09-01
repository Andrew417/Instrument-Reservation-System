import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local first, fallback to .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: sqlHost
    ? {
        host: sqlHost,
        user: user || 'postgres',
        password: password || '',
        database: sqlDbName || 'postgres',
        ssl: false,
      }
    : process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
      }
    : {
        host: '127.0.0.1',
        user: 'postgres',
        password: '',
        database: 'postgres',
        ssl: false,
      },
  verbose: true,
});

