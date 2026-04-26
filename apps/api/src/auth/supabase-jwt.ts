import { jwtVerify } from "jose";
import { env } from "../config/env.js";

export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
}

const encoder = new TextEncoder();
let cachedSecret: Uint8Array | null = null;

function getSecret(): Uint8Array | null {
  if (!env.SUPABASE_JWT_SECRET) return null;
  cachedSecret ??= encoder.encode(env.SUPABASE_JWT_SECRET);
  return cachedSecret;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(env.SUPABASE_JWT_SECRET);
}

export async function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload> {
  const secret = getSecret();
  if (!secret) throw new Error("Supabase JWT verification not configured");
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  if (typeof payload.sub !== "string") {
    throw new Error("Supabase JWT missing sub claim");
  }
  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}
