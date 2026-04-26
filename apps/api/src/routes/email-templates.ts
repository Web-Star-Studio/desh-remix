import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from "../services/email-templates.js";
import { requireAdmin } from "../services/admin.js";
import { isServiceError } from "../services/errors.js";

const TemplateTypeEnum = z.enum(["transactional", "report", "marketing", "lifecycle"]);

const ListQuery = z.object({
  type: TemplateTypeEnum.optional(),
  activeOnly: z.coerce.boolean().optional(),
});

const TemplateParams = z.object({ id: z.string().uuid() });

const CreateBody = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9_-]+$/, "slug must be kebab/snake-case"),
  name: z.string().min(1).max(200),
  type: TemplateTypeEnum.optional(),
  subjectTemplate: z.string().min(1).max(500),
  bodyHtml: z.string().min(1).max(50_000),
  bodyText: z.string().max(50_000).optional(),
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

export default async function emailTemplatesRoutes(app: FastifyInstance) {
  app.get("/admin/email-templates", async (req, reply) => {
    try {
      await requireAdmin(req);
      const query = ListQuery.safeParse(req.query);
      if (!query.success) {
        return reply.code(400).send({ error: "invalid_query", details: query.error.flatten() });
      }
      return await listTemplates(query.data);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/admin/email-templates/:id", async (req, reply) => {
    try {
      await requireAdmin(req);
      const params = TemplateParams.safeParse(req.params);
      if (!params.success) return reply.code(400).send({ error: "invalid_params" });
      return await getTemplate(params.data.id);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/admin/email-templates", async (req, reply) => {
    try {
      const actorId = await requireAdmin(req);
      const parsed = CreateBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      }
      const created = await createTemplate(actorId, parsed.data);
      return reply.code(201).send(created);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/admin/email-templates/:id", async (req, reply) => {
    try {
      await requireAdmin(req);
      const params = TemplateParams.safeParse(req.params);
      if (!params.success) return reply.code(400).send({ error: "invalid_params" });
      const parsed = PatchBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
      }
      return await updateTemplate(params.data.id, parsed.data);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.delete("/admin/email-templates/:id", async (req, reply) => {
    try {
      await requireAdmin(req);
      const params = TemplateParams.safeParse(req.params);
      if (!params.success) return reply.code(400).send({ error: "invalid_params" });
      await deleteTemplate(params.data.id);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
