import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { contactInteractions, contacts, workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";

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

async function isWorkspaceMember(workspaceId: string, userDbId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userDbId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

function toApiContact(
  row: typeof contacts.$inferSelect,
  interactions: (typeof contactInteractions.$inferSelect)[] = [],
) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdBy: row.createdBy,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    role: row.role,
    notes: row.notes,
    tags: row.tags,
    favorited: row.favorited,
    avatarUrl: row.avatarUrl,
    birthday: row.birthday,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    interactions: interactions.map(toApiInteraction),
  };
}

function toApiInteraction(row: typeof contactInteractions.$inferSelect) {
  return {
    id: row.id,
    contactId: row.contactId,
    createdBy: row.createdBy,
    type: row.type,
    title: row.title,
    description: row.description,
    interactionDate: row.interactionDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export default async function contactsRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/contacts", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const rows = await db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, params.data.workspaceId))
      .orderBy(desc(contacts.favorited), asc(contacts.name));

    const ids = rows.map((c) => c.id);
    const interactions = ids.length
      ? await db
          .select()
          .from(contactInteractions)
          .where(inArray(contactInteractions.contactId, ids))
          .orderBy(desc(contactInteractions.interactionDate))
      : [];

    const byContact = new Map<string, (typeof contactInteractions.$inferSelect)[]>();
    for (const i of interactions) {
      const list = byContact.get(i.contactId) ?? [];
      list.push(i);
      byContact.set(i.contactId, list);
    }

    return rows.map((c) => toApiContact(c, byContact.get(c.id) ?? []));
  });

  app.post("/workspaces/:workspaceId/contacts", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const [created] = await db
      .insert(contacts)
      .values({
        workspaceId: params.data.workspaceId,
        createdBy: dbId,
        name: parsed.data.name,
        email: parsed.data.email ?? "",
        phone: parsed.data.phone ?? "",
        company: parsed.data.company ?? "",
        role: parsed.data.role ?? "",
        notes: parsed.data.notes ?? "",
        tags: parsed.data.tags ?? [],
        favorited: parsed.data.favorited ?? false,
        avatarUrl: parsed.data.avatarUrl ?? null,
        birthday: parsed.data.birthday ?? null,
      })
      .returning();
    if (!created) return reply.code(500).send({ error: "insert_failed" });

    return reply.code(201).send(toApiContact(created));
  });

  app.patch("/workspaces/:workspaceId/contacts/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ContactParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.code(400).send({ error: "empty_patch" });
    }

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const [updated] = await db
      .update(contacts)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(contacts.id, params.data.id),
          eq(contacts.workspaceId, params.data.workspaceId),
        ),
      )
      .returning();
    if (!updated) return reply.code(404).send({ error: "contact_not_found" });

    const interactions = await db
      .select()
      .from(contactInteractions)
      .where(eq(contactInteractions.contactId, updated.id))
      .orderBy(desc(contactInteractions.interactionDate));

    return toApiContact(updated, interactions);
  });

  app.delete("/workspaces/:workspaceId/contacts/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ContactParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const result = await db
      .delete(contacts)
      .where(
        and(
          eq(contacts.id, params.data.id),
          eq(contacts.workspaceId, params.data.workspaceId),
        ),
      )
      .returning({ id: contacts.id });
    if (!result[0]) return reply.code(404).send({ error: "contact_not_found" });

    return reply.code(204).send();
  });

  app.post("/workspaces/:workspaceId/contacts/:id/interactions", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ContactParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = InteractionCreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const parent = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.id, params.data.id),
          eq(contacts.workspaceId, params.data.workspaceId),
        ),
      )
      .limit(1);
    if (!parent[0]) return reply.code(404).send({ error: "contact_not_found" });

    const [created] = await db
      .insert(contactInteractions)
      .values({
        contactId: params.data.id,
        createdBy: dbId,
        type: parsed.data.type ?? "note",
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        interactionDate: parsed.data.interactionDate
          ? new Date(parsed.data.interactionDate)
          : new Date(),
      })
      .returning();
    if (!created) return reply.code(500).send({ error: "insert_failed" });

    return reply.code(201).send(toApiInteraction(created));
  });

  app.patch("/workspaces/:workspaceId/contacts/:id/interactions/:interactionId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = InteractionParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = InteractionPatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.code(400).send({ error: "empty_patch" });
    }

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    // Defend against forged URLs across workspaces — verify the interaction
    // belongs to a contact in this workspace before updating.
    const guard = await db
      .select({ id: contactInteractions.id })
      .from(contactInteractions)
      .innerJoin(contacts, eq(contacts.id, contactInteractions.contactId))
      .where(
        and(
          eq(contactInteractions.id, params.data.interactionId),
          eq(contacts.id, params.data.id),
          eq(contacts.workspaceId, params.data.workspaceId),
        ),
      )
      .limit(1);
    if (!guard[0]) return reply.code(404).send({ error: "interaction_not_found" });

    const { interactionDate, ...rest } = parsed.data;
    const set: Partial<typeof contactInteractions.$inferInsert> = { ...rest };
    if (interactionDate !== undefined) {
      set.interactionDate = new Date(interactionDate);
    }

    const [updated] = await db
      .update(contactInteractions)
      .set(set)
      .where(eq(contactInteractions.id, params.data.interactionId))
      .returning();
    if (!updated) return reply.code(404).send({ error: "interaction_not_found" });

    return toApiInteraction(updated);
  });

  app.delete("/workspaces/:workspaceId/contacts/:id/interactions/:interactionId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = InteractionParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const result = await db
      .delete(contactInteractions)
      .where(eq(contactInteractions.id, params.data.interactionId))
      .returning({ id: contactInteractions.id });
    if (!result[0]) return reply.code(404).send({ error: "interaction_not_found" });

    return reply.code(204).send();
  });
}
