import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().optional(),

  // Supabase JWT bridge — kept during the auth migration so the SPA keeps working.
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),

  // AWS Cognito — target auth provider. JWKS verification, no shared secret.
  COGNITO_REGION: z.string().min(1).optional(),
  COGNITO_USER_POOL_ID: z.string().min(1).optional(),
  COGNITO_CLIENT_ID: z.string().min(1).optional(),

  OPENROUTER_API_KEY: z.string().min(1).optional(),
  INTERNAL_CALLBACK_TOKEN: z.string().min(16).optional(),
  HERMES_BASE_URL_TEMPLATE: z.string().default("http://127.0.0.1:{port}"),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
