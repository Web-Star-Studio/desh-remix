import type { FastifyInstance } from "fastify";

export default async function workspacesRoutes(app: FastifyInstance) {
  app.get("/workspaces", async (_req, reply) => reply.code(501).send({ error: "not_implemented" }));
  app.post("/workspaces", async (_req, reply) => reply.code(501).send({ error: "not_implemented" }));
  app.get("/workspaces/:id", async (_req, reply) => reply.code(501).send({ error: "not_implemented" }));
}
