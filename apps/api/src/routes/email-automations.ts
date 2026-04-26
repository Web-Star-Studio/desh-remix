import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createAutomation,
  deleteAutomation,
  getAutomation,
  listAutomations,
  runAutomation,
  updateAutomation,
} from "../services/email-automations.js";
import { requireAdmin } from "../services/admin.js";
import { isServiceError } from "../services/errors.js";

const TriggerEnum = z.enum(["cron", "threshold", "manual"]);
const AudienceEnum = z.enum(["all", "active", "inactive", "admins"]);

const Params = z.object({ id: z.string().uuid() });

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  triggerType: TriggerEnum,
  triggerConfig: z.record(z.unknown()).optional(),
  templateSlug: z.string().min(1).max(120),
  targetAudience: AudienceEnum.optional(),
  active: z.boolean().optional(),
});

const PatchBody = CreateBody.partial();

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function emailAutomationsRoutes(app: FastifyInstance) {
  app.get("/admin/email-automations", async (req, reply) => {
    try {
      await requireAdmin(req);
      return await listAutomations();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/admin/email-automations/:id", async (req, reply) => {
    try {
      await requireAdmin(req);
      const params = Params.safeParse(req.params);
      if (!params.success) return reply.code(400).send({ error: "invalid_params" });
      return await getAutomation(params.data.id);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/admin/email-automations", async (req, reply) => {
    try {
      const actorId = await requireAdmin(req);
      const parsed = CreateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      }
      const created = await createAutomation(actorId, parsed.data);
      return reply.code(201).send(created);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/admin/email-automations/:id", async (req, reply) => {
    try {
      await requireAdmin(req);
      const params = Params.safeParse(req.params);
      if (!params.success) return reply.code(400).send({ error: "invalid_params" });
      const parsed = PatchBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      }
      return await updateAutomation(params.data.id, parsed.data);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.delete("/admin/email-automations/:id", async (req, reply) => {
    try {
      await requireAdmin(req);
      const params = Params.safeParse(req.params);
      if (!params.success) return reply.code(400).send({ error: "invalid_params" });
      await deleteAutomation(params.data.id);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  // Manual run — bypasses the cron evaluation. Useful for the admin UI to
  // test a freshly-edited automation, or to fire `manual` triggers on demand.
  app.post("/admin/email-automations/:id/run", async (req, reply) => {
    try {
      await requireAdmin(req);
      const params = Params.safeParse(req.params);
      if (!params.success) return reply.code(400).send({ error: "invalid_params" });
      return await runAutomation(params.data.id);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
