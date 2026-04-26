import type { FastifyInstance } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";
import { findConnectionByEmailAddress } from "../services/gmail-sync.js";
import { enqueue } from "../services/jobs.js";

// Gmail Pub/Sub push handler. Verification differs from the Composio webhook:
// Google signs the request with an OIDC token in `Authorization: Bearer ...`,
// audience = the URL we configure on the Pub/Sub subscription. We verify
// against Google's JWKS and reject anything else.
//
// Body shape (Pub/Sub): {
//   message: { data: <base64({emailAddress, historyId})>, messageId, ... },
//   subscription: "projects/.../subscriptions/..."
// }
//
// Resolution path: emailAddress → gmail_sync_state row → workspace/connection
//                → enqueue gmail.incremental-sync job → 200.
//
// We deliberately do not 4xx on resolution misses (no matching connection):
// Pub/Sub treats non-2xx as failures and retries forever, and a missed
// connection often means the user disconnected. Return 200 with a log entry.

const GOOGLE_OIDC_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set([
  "https://accounts.google.com",
  "accounts.google.com",
]);

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJWKS() {
  cachedJWKS ??= createRemoteJWKSet(new URL(GOOGLE_OIDC_JWKS_URL));
  return cachedJWKS;
}

interface PubSubEnvelope {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
    attributes?: Record<string, string>;
  };
  subscription?: string;
}

interface DecodedNotification {
  emailAddress?: string;
  historyId?: number | string;
}

export default async function gmailWebhookRoutes(app: FastifyInstance) {
  app.post("/internal/gmail/webhook", async (req, reply) => {
    if (!env.GMAIL_PUBSUB_AUDIENCE) {
      req.log.warn("[gmail-webhook] GMAIL_PUBSUB_AUDIENCE unset — refusing");
      return reply.code(503).send({ error: "audience_unset" });
    }

    const auth = req.headers["authorization"];
    if (typeof auth !== "string" || !auth.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "missing_authorization" });
    }
    const token = auth.slice("Bearer ".length).trim();

    try {
      const { payload } = await jwtVerify(token, getJWKS(), {
        audience: env.GMAIL_PUBSUB_AUDIENCE,
      });
      if (typeof payload.iss !== "string" || !GOOGLE_ISSUERS.has(payload.iss)) {
        return reply.code(401).send({ error: "bad_issuer" });
      }
    } catch (err) {
      req.log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "[gmail-webhook] OIDC verify failed",
      );
      return reply.code(401).send({ error: "bad_token" });
    }

    const envelope = req.body as PubSubEnvelope | undefined;
    const data = envelope?.message?.data;
    if (!data) {
      // Pub/Sub sometimes sends keepalives without data — ack to stop retries.
      return reply.code(204).send();
    }

    let decoded: DecodedNotification;
    try {
      const json = Buffer.from(data, "base64").toString("utf8");
      decoded = JSON.parse(json) as DecodedNotification;
    } catch (err) {
      req.log.warn({ err: err instanceof Error ? err.message : String(err) }, "[gmail-webhook] base64 decode failed");
      return reply.code(204).send();
    }

    if (!decoded.emailAddress || decoded.historyId == null) {
      req.log.warn({ decoded }, "[gmail-webhook] missing fields");
      return reply.code(204).send();
    }

    const match = await findConnectionByEmailAddress(decoded.emailAddress);
    if (!match) {
      req.log.info(
        { emailAddress: decoded.emailAddress },
        "[gmail-webhook] no matching connection — dropping",
      );
      return reply.code(204).send();
    }

    try {
      await enqueue("gmail.incremental-sync", {
        workspaceId: match.workspaceId,
        connectionId: match.connectionId,
      });
    } catch (err) {
      req.log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "[gmail-webhook] enqueue failed",
      );
      // Still 200 — we don't want Pub/Sub to retry on internal queue failures.
    }

    return reply.code(204).send();
  });
}
