import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { env } from "../config/env.js";
import { verifySupabaseJwt } from "./supabase-jwt.js";
import { isCognitoConfigured, verifyCognitoJwt } from "./cognito-jwt.js";

export type AuthSource = "cognito" | "supabase";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; email?: string; source: AuthSource };
  }
}

// Bridge auth: try Cognito first (target), fall back to Supabase (legacy).
// Token shapes differ — Cognito uses RS256 with JWKS, Supabase uses HS256
// with a shared secret — so a token only ever verifies under one path.
async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("user", undefined);

  app.addHook("onRequest", async (req: FastifyRequest) => {
    const header = req.headers["authorization"];
    if (typeof header !== "string" || !header.startsWith("Bearer ")) return;
    const token = header.slice("Bearer ".length).trim();
    if (!token) return;

    if (isCognitoConfigured()) {
      try {
        const payload = await verifyCognitoJwt(token);
        req.user = { id: payload.sub, email: payload.email, source: "cognito" };
        return;
      } catch {
        // Fall through to Supabase bridge.
      }
    }

    if (env.SUPABASE_JWT_SECRET) {
      try {
        const payload = await verifySupabaseJwt(token);
        req.user = { id: payload.sub, email: payload.email, source: "supabase" };
      } catch {
        // Verification failed; routes that require auth must check req.user themselves.
      }
    }
  });
}

export default fp(authPlugin, { name: "auth" });
