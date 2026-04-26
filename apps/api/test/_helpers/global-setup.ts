import path from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../../../packages/database/migrations");

let container: StartedPostgreSqlContainer | null = null;

// Boots one Postgres container for the whole vitest process. Tests reach the
// connection via process.env.DATABASE_URL — set BEFORE any apps/api module
// reads env. Auth is handled via the cognito-jwt mock in `_helpers/setup.ts`,
// so no shared secret is needed here.
export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = container.getConnectionUri();

  process.env.DATABASE_URL = url;
  // Webhook tests rely on this being set before env.ts parses process.env.
  process.env.COMPOSIO_WEBHOOK_SECRET = process.env.COMPOSIO_WEBHOOK_SECRET || "test-webhook-secret-1234567890";

  const sql = postgres(url, { max: 1 });
  try {
    await sql`create extension if not exists citext`;
    await sql`create extension if not exists pgcrypto`;
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function teardown() {
  await container?.stop();
  container = null;
}
