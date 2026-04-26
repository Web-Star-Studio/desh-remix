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
// reads env. Also seeds SUPABASE_JWT_SECRET so HS256 tokens crafted in tests
// pass the auth plugin's fallback path.
export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = container.getConnectionUri();

  process.env.DATABASE_URL = url;
  // Long enough to satisfy z.string().min(1); deterministic for token signing.
  process.env.SUPABASE_JWT_SECRET ??= "test-secret-min-16-chars-do-not-use-in-prod";

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
