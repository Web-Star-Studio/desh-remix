import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createLabel,
  deleteLabel,
  listLabels,
  refreshLabels,
} from "../services/gmail-labels.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const LabelParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
});

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  colorBg: z.string().max(20).optional(),
  colorText: z.string().max(20).optional(),
});

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function gmailLabelsRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/gmail-labels", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await listLabels(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  // POST refresh — pulls fresh labels from Composio and upserts the cache.
  app.post("/workspaces/:workspaceId/gmail-labels/refresh", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await refreshLabels(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/gmail-labels", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      const created = await createLabel(params.data.workspaceId, dbId, parsed.data);
      return reply.code(201).send(created);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.delete("/workspaces/:workspaceId/gmail-labels/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = LabelParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await deleteLabel(params.data.workspaceId, dbId, params.data.id);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
