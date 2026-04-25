import { jwtVerify } from "jose";
import { env } from "../config/env.js";

export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string;
}

export async function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload> {
  if (!env.SUPABASE_JWT_SECRET) {
    throw new Error("SUPABASE_JWT_SECRET is not configured");
  }
  const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  if (typeof payload.sub !== "string") {
    throw new Error("token missing sub");
  }
  return payload as SupabaseJwtPayload;
}
