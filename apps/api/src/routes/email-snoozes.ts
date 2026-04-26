import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  listSnoozes,
  restoreSnooze,
  snoozeEmail,
} from "../services/email-snoozes.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const SnoozeParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
});

const CreateBody = z.object({
  gmailId: z.string().min(1).max(200),
  subject: z.string().max(500).optional(),
  fromName: z.string().max(200).optional(),
  snoozeUntil: z.string().datetime(),
  originalLabels: z.array(z.string().max(120)).max(50).optional(),
});

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function emailSnoozesRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/email-snoozes", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await listSnoozes(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/email-snoozes", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      const created = await snoozeEmail(params.data.workspaceId, dbId, parsed.data);
      return reply.code(201).send(created);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  // DELETE = manual restore (runs the same path the cron uses).
  app.delete("/workspaces/:workspaceId/email-snoozes/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = SnoozeParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await restoreSnooze(params.data.workspaceId, params.data.id, dbId);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
