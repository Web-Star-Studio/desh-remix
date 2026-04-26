import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().optional(),

  // AWS Cognito — primary auth provider. JWKS verification, no shared secret.
  COGNITO_REGION: z.string().min(1).optional(),
  COGNITO_USER_POOL_ID: z.string().min(1).optional(),
  COGNITO_CLIENT_ID: z.string().min(1).optional(),

  // AWS KMS — envelope encryption for workspace_credentials.
  KMS_KEY_ID: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).optional(),

  // AWS S3 — file storage. Bucket lives in AWS_REGION; the IAM principal is
  // either the default credential chain (~/.aws/credentials, EC2 role, etc.)
  // or the explicit access-key pair below.
  AWS_S3_BUCKET: z.string().min(1).optional(),
  AWS_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  // Default upload-URL TTL (seconds) — short by design; SPA can re-request.
  AWS_S3_PRESIGN_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  // Composio — replaces the composio-proxy + integrations-connect edge fns.
  COMPOSIO_API_KEY: z.string().min(1).optional(),
  COMPOSIO_REDIRECT_URL: z.string().url().optional(),
  // Shared secret for verifying Composio webhook signatures (HMAC-SHA256).
  // When unset, /composio/webhook returns 503 (fail closed).
  COMPOSIO_WEBHOOK_SECRET: z.string().min(16).optional(),
  // Server ID of the global custom MCP server bundling our supported toolkits.
  // Created on first boot if absent; persisted via env after first run.
  COMPOSIO_MCP_SERVER_ID: z.string().min(1).optional(),
  // Comma-separated toolkit slugs to include in the MCP server.
  // Default keeps a sensible Google-first set; expand as agent capabilities grow.
  COMPOSIO_MCP_TOOLKITS: z
    .string()
    .default("gmail,googlecalendar,googledrive,googletasks,googlecontacts"),

  // Hermes integration — per-workspace gateway lifecycle.
  // Lazy: gateways start on first traffic, stop after idle timeout.
  HERMES_BIN: z.string().default("hermes"),
  HERMES_HOME_BASE: z.string().default(path.join(repoRoot, ".hermes-profiles")),
  HERMES_PORT_RANGE_START: z.coerce.number().int().positive().default(8650),
  HERMES_PORT_RANGE_END: z.coerce.number().int().positive().default(8800),
  HERMES_CALLBACK_BASE_URL: z.string().url().default("http://127.0.0.1:3001"),
  HERMES_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  HERMES_IDLE_SWEEP_MS: z.coerce.number().int().positive().default(60 * 1000),
  HERMES_HEALTH_TIMEOUT_MS: z.coerce.number().int().positive().default(15 * 1000),

  OPENROUTER_API_KEY: z.string().min(1).optional(),
  INTERNAL_CALLBACK_TOKEN: z.string().min(16).optional(),

  // Resend — transactional email provider for notification sends. Without
  // RESEND_API_KEY, the notification service marks every send as `skipped`
  // with reason `provider_unconfigured` (logged, not thrown).
  RESEND_API_KEY: z.string().min(1).optional(),
  NOTIFICATION_FROM_EMAIL: z.string().email().default("notifications@desh.app"),

  // Gmail Pub/Sub OIDC audience — the URL Google authenticates against when
  // pushing webhook payloads. Set to the public webhook URL (e.g.
  // https://api.desh.app/internal/gmail/webhook). Without it, the route
  // returns 503 (fail closed).
  GMAIL_PUBSUB_AUDIENCE: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
