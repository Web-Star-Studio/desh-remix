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
  // Zernio integration tests gate on these — the value is only checked for
  // presence (length ≥ 1 / ≥ 16). The HTTP client is mocked at the module
  // boundary by the per-test `vi.mock("../src/services/zernio.js", …)`.
  process.env.ZERNIO_API_KEY = process.env.ZERNIO_API_KEY || "sk-zernio-test-token";
  process.env.ZERNIO_WEBHOOK_SECRET = process.env.ZERNIO_WEBHOOK_SECRET || "test-zernio-secret-1234567890";
  // Storage + KMS tests need these visible at env-parse time. Real AWS calls
  // are mocked at the SDK boundary (aws-sdk-client-mock) so values are stubs.
  process.env.AWS_REGION = process.env.AWS_REGION || "us-east-1";
  process.env.AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || "desh-test-bucket";
  process.env.AWS_S3_ACCESS_KEY_ID = process.env.AWS_S3_ACCESS_KEY_ID || "AKIATEST";
  process.env.AWS_S3_SECRET_ACCESS_KEY = process.env.AWS_S3_SECRET_ACCESS_KEY || "secret-test";
  process.env.KMS_KEY_ID = process.env.KMS_KEY_ID || "alias/desh-test";
  // profile-config tests need this; the renderProfileConfig function
  // throws early if it's missing because Hermes can't answer prompts
  // without an OpenRouter key in the per-profile .env.
  process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "sk-or-test-token";
  process.env.HERMES_CALLBACK_BASE_URL =
    process.env.HERMES_CALLBACK_BASE_URL || "http://127.0.0.1:3001";

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
