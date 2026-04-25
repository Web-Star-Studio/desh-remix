import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";

export default async function hermesRoutes(app: FastifyInstance) {
  // Inbound callback receiver for the saas_web Hermes adapter.
  // Stub today; will persist agent_events and fan out to SSE listeners.
  app.post("/internal/hermes/events", async (req, reply) => {
    const auth = req.headers["authorization"];
    if (
      env.INTERNAL_CALLBACK_TOKEN &&
      auth !== `Bearer ${env.INTERNAL_CALLBACK_TOKEN}`
    ) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    return reply.code(501).send({ error: "not_implemented" });
  });
}
