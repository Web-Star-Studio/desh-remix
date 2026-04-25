import type { FastifyInstance } from "fastify";

export default async function agentsRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/agent-profiles", async (_req, reply) =>
    reply.code(501).send({ error: "not_implemented" }),
  );
  app.patch("/workspaces/:workspaceId/agent/settings/model", async (_req, reply) =>
    reply.code(501).send({ error: "not_implemented" }),
  );
}
