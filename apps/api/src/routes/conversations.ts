import type { FastifyInstance } from "fastify";

export default async function conversationsRoutes(app: FastifyInstance) {
  app.get("/conversations", async (_req, reply) => reply.code(501).send({ error: "not_implemented" }));
  app.post("/conversations", async (_req, reply) => reply.code(501).send({ error: "not_implemented" }));
  app.get("/conversations/:id/events", async (_req, reply) =>
    reply.code(501).send({ error: "not_implemented" }),
  );
  app.post("/conversations/:id/messages", async (_req, reply) =>
    reply.code(501).send({ error: "not_implemented" }),
  );
}
