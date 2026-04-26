import type { FastifyInstance } from "fastify";
import { and, eq, ne } from "drizzle-orm";
import { agentProfiles, workspaceMembers, workspaces } from "@desh/database/schema";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().min(1).max(64).optional(),
  isDefault: z.boolean().optional(),
});

const PatchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().min(1).max(64).optional(),
  isDefault: z.boolean().optional(),
});

const IdParams = z.object({ id: z.string().uuid() });

function toApiShape(row: typeof workspaces.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    color: row.color,
    isDefault: row.isDefault,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default async function workspacesRoutes(app: FastifyInstance) {
  app.get("/workspaces", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const rows = await db
      .select({ workspace: workspaces, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, dbId));

    return rows.map((r) => ({ ...toApiShape(r.workspace), role: r.role }));
  });

  app.post("/workspaces", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const created = await db.transaction(async (tx) => {
      if (body.isDefault) {
        await tx
          .update(workspaces)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(workspaces.createdBy, dbId));
      }
      const [workspace] = await tx
        .insert(workspaces)
        .values({
          name: body.name,
          icon: body.icon,
          color: body.color,
          isDefault: body.isDefault ?? false,
          createdBy: dbId,
        })
        .returning();
      if (!workspace) throw new Error("create: workspace insert returned no row");

      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: dbId,
        role: "owner",
      });

      await tx.insert(agentProfiles).values({
        workspaceId: workspace.id,
        displayName: "Default agent",
      });

      return workspace;
    });

    return reply.code(201).send(toApiShape(created));
  });

  app.get("/workspaces/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = IdParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const rows = await db
      .select({ workspace: workspaces, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(and(eq(workspaceMembers.userId, dbId), eq(workspaces.id, params.data.id)))
      .limit(1);

    const row = rows[0];
    if (!row) return reply.code(404).send({ error: "not_found" });
    return { ...toApiShape(row.workspace), role: row.role };
  });

  app.patch("/workspaces/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = IdParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({ error: "empty_patch" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const membership = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, dbId),
          eq(workspaceMembers.workspaceId, params.data.id),
        ),
      )
      .limit(1);
    if (!membership[0]) return reply.code(404).send({ error: "not_found" });
    if (membership[0].role === "member") {
      return reply.code(403).send({ error: "forbidden" });
    }

    const updated = await db.transaction(async (tx) => {
      if (patch.isDefault) {
        await tx
          .update(workspaces)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(eq(workspaces.createdBy, dbId), ne(workspaces.id, params.data.id)));
      }
      const [row] = await tx
        .update(workspaces)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(workspaces.id, params.data.id))
        .returning();
      return row;
    });

    if (!updated) return reply.code(404).send({ error: "not_found" });
    return toApiShape(updated);
  });

  app.delete("/workspaces/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = IdParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const membership = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.userId, dbId),
          eq(workspaceMembers.workspaceId, params.data.id),
        ),
      )
      .limit(1);
    if (!membership[0]) return reply.code(404).send({ error: "not_found" });
    if (membership[0].role !== "owner") {
      return reply.code(403).send({ error: "owner_only" });
    }

    await db.delete(workspaces).where(eq(workspaces.id, params.data.id));
    return reply.code(204).send();
  });
}
