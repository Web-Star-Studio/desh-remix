import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  executeBatch,
  listHistory,
} from "../services/email-unsubscribe.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });

const RequestItem = z.object({
  url: z.string().min(1).max(4096),
  method: z.enum(["GET", "POST", "mailto"]).optional(),
  postBody: z.string().max(2048).optional(),
  senderName: z.string().max(256).optional(),
  senderEmail: z.string().max(256).optional(),
  category: z.string().max(80).optional(),
  safetyScore: z.number().int().min(0).max(100).optional(),
  emailsAffected: z.number().int().min(0).max(100_000).optional(),
});

const ExecuteBody = z.object({
  requests: z.array(RequestItem).min(1).max(80),
});

const HistoryQuery = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function emailUnsubscribeRoutes(app: FastifyInstance) {
  app.post("/workspaces/:workspaceId/email-unsubscribe", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = ExecuteBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      return await executeBatch({
        workspaceId: params.data.workspaceId,
        actorUserId: dbId,
        requests: parsed.data.requests,
      });
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/workspaces/:workspaceId/unsubscribe-history", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const query = HistoryQuery.safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_query", details: query.error.flatten() });
    }
    try {
      return await listHistory(params.data.workspaceId, dbId, query.data.limit);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
