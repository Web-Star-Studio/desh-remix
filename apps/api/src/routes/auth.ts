import type { FastifyInstance } from "fastify";

export default async function authRoutes(app: FastifyInstance) {
  // Returns the authenticated user as resolved by the auth plugin.
  // Useful for the SPA to confirm the bridge accepted its token.
  app.get("/auth/me", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "unauthorized" });
    return req.user;
  });
}
