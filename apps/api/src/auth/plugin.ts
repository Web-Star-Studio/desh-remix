import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { env } from "../config/env.js";
import { isCognitoConfigured, verifyCognitoJwt } from "./cognito-jwt.js";

export type AuthSource = "cognito";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; email?: string; source: AuthSource };
  }
}

const isDev = env.NODE_ENV !== "production";

function decodeJwtAlg(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  try {
    const json = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
    const header = JSON.parse(json);
    return typeof header?.alg === "string" ? header.alg : null;
  } catch {
    return null;
  }
}

async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("user", undefined);

  if (isDev) {
    app.log.info(
      {
        cognitoConfigured: isCognitoConfigured(),
        region: env.COGNITO_REGION,
      },
      "[auth] plugin loaded",
    );
  }

  app.addHook("onRequest", async (req: FastifyRequest) => {
    const header = req.headers["authorization"];
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      if (isDev) req.log.debug("[auth] no Authorization header");
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) return;

    const alg = decodeJwtAlg(token);

    if (alg !== "RS256") {
      if (isDev) req.log.warn({ alg }, "[auth] unsupported token alg (Cognito issues RS256)");
      return;
    }

    if (!isCognitoConfigured()) {
      req.log.warn("[auth] received RS256 token but Cognito not configured");
      return;
    }

    try {
      const payload = await verifyCognitoJwt(token);
      req.user = { id: payload.sub, email: payload.email, source: "cognito" };
      if (isDev) req.log.debug({ userId: payload.sub }, "[auth] verified");
    } catch (err) {
      if (isDev) req.log.warn({ err: (err as Error).message }, "[auth] Cognito verification failed");
    }
  });
}

export default fp(authPlugin, { name: "auth" });
