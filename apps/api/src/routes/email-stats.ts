import type { FastifyInstance, FastifyReply } from "fastify";
import { requireAdmin } from "../services/admin.js";
import { isServiceError } from "../services/errors.js";
import { getEmailStats } from "../services/email-stats.js";

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function emailStatsRoutes(app: FastifyInstance) {
  app.get("/admin/email-stats", async (req, reply) => {
    try {
      await requireAdmin(req);
      return await getEmailStats();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
