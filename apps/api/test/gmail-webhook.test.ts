import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";

// Webhook is the public entry point for Gmail Pub/Sub pushes. The full
// happy path (a valid Google-signed OIDC token, a base64-encoded payload
// that resolves to a connection, an enqueued job) requires impersonating
// Google — out of scope for unit tests; covered by manual deploy smoke.
//
// What we DO cover here is the fail-closed behavior: the route MUST refuse
// when GMAIL_PUBSUB_AUDIENCE is unset (the default in test env). The check
// runs before any token verification, so it's a stable assertion regardless
// of what state the env is in.

describe("gmail-webhook", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 503 when GMAIL_PUBSUB_AUDIENCE is unset (fail-closed)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/internal/gmail/webhook",
      payload: {},
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("audience_unset");
  });
});
