import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireUserDbId } from "../services/users.js";
import {
  createContact,
  createInteraction,
  deleteContact,
  deleteInteraction,
  listContacts,
  updateContact,
  updateInteraction,
  type InteractionType,
} from "../services/contacts.js";
import { isServiceError } from "../services/errors.js";

const InteractionTypeEnum = z.enum(["note", "call", "email", "meeting", "message", "other"]);

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const ContactParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
});
const InteractionParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
  interactionId: z.string().uuid(),
});

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().max(80).optional(),
  company: z.string().max(200).optional(),
  role: z.string().max(120).optional(),
  notes: z.string().max(8000).optional(),
  tags: z.array(z.string().max(64)).max(50).optional(),
  favorited: z.boolean().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  // Rich fields. Phones/emails/addresses/socialLinks are stored as opaque
  // jsonb and validated by the SPA — server-side strict shape would force
  // schema lockstep on every UI tweak.
  contactType: z.string().max(40).optional(),
  phones: z.array(z.record(z.unknown())).max(20).optional(),
  emails: z.array(z.record(z.unknown())).max(20).optional(),
  addresses: z.array(z.record(z.unknown())).max(20).optional(),
  socialLinks: z.record(z.unknown()).optional(),
  website: z.string().max(500).optional(),
  companyLogoUrl: z.string().url().nullable().optional(),
  companyDescription: z.string().max(8000).optional(),
  companyIndustry: z.string().max(200).optional(),
  companySize: z.string().max(80).optional(),
  customFields: z.record(z.unknown()).optional(),
  googleResourceName: z.string().max(200).nullable().optional(),
  googleEtag: z.string().max(200).nullable().optional(),
});

const PatchBody = CreateBody.partial();

const InteractionCreateBody = z.object({
  type: InteractionTypeEnum.optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(8000).optional(),
  interactionDate: z.string().datetime().optional(),
});

const InteractionPatchBody = z.object({
  type: InteractionTypeEnum.optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(8000).optional(),
  interactionDate: z.string().datetime().optional(),
});

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function contactsRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/contacts", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await listContacts(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/contacts", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      const created = await createContact(params.data.workspaceId, dbId, parsed.data);
      return reply.code(201).send(created);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/workspaces/:workspaceId/contacts/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ContactParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      return await updateContact(params.data.workspaceId, dbId, params.data.id, parsed.data);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.delete("/workspaces/:workspaceId/contacts/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ContactParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await deleteContact(params.data.workspaceId, dbId, params.data.id);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/contacts/:id/interactions", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ContactParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = InteractionCreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      const created = await createInteraction(params.data.workspaceId, dbId, params.data.id, {
        ...parsed.data,
        type: parsed.data.type as InteractionType | undefined,
      });
      return reply.code(201).send(created);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/workspaces/:workspaceId/contacts/:id/interactions/:interactionId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = InteractionParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = InteractionPatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      return await updateInteraction(
        params.data.workspaceId,
        dbId,
        params.data.id,
        params.data.interactionId,
        { ...parsed.data, type: parsed.data.type as InteractionType | undefined },
      );
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.delete("/workspaces/:workspaceId/contacts/:id/interactions/:interactionId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = InteractionParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await deleteInteraction(params.data.workspaceId, dbId, params.data.interactionId);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
