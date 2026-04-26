import type { FastifyInstance } from "fastify";
import { and, eq, ne } from "drizzle-orm";
import { agentProfiles, workspaceMembers, workspaces } from "@desh/database/schema";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { provisionAgentProfileResources, requireUserDbId } from "../services/users.js";
import { stop as stopGateway } from "../services/hermes/process-supervisor.js";
import { isMcpConfigured, mintInstanceUrlForEntity } from "../services/composio-mcp.js";
import { ensureHermesProfileExists } from "../services/hermes/mcp-registration.js";
import { entityIdFor } from "../services/composio.js";

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

    // Pre-allocate Hermes port + secrets outside the tx (port-allocator binds
    // sockets). The gateway is NOT started here — supervisor.ensureRunning()
    // does that on first message.
    const resources = await provisionAgentProfileResources();

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

      // system_prompt stays null on creation — Pandora identity is composed
      // into SOUL.md at gateway-spawn time. The column reserves space for
      // optional workspace-specific extensions the user can add later.
      const [profile] = await tx
        .insert(agentProfiles)
        .values({
          workspaceId: workspace.id,
          displayName: "Pandora",
          hermesPort: resources.hermesPort,
          adapterSecret: resources.adapterSecret,
          callbackSecret: resources.callbackSecret,
        })
        .returning();
      if (!profile) throw new Error("create: agent_profile insert returned no row");

      return { workspace, profile };
    });

    // Eager Composio MCP registration — fire-and-forget. Mints a per-entity
    // MCP URL via Composio API and stores it on agent_profiles.config so
    // the supervisor's renderProfileConfig can emit it into config.yaml on
    // gateway start. The Hermes CLI's `mcp add` is interactive (TUI-only),
    // so we bypass it and write the YAML ourselves — Hermes loads
    // mcp_servers from config.yaml at boot.
    if (isMcpConfigured()) {
      const entityId = entityIdFor(created.workspace.id, dbId);
      void (async () => {
        try {
          const url = await mintInstanceUrlForEntity(entityId);
          if (!url) return;
          // Make sure the profile dir + state.db exist before any later
          // gateway start writes config.yaml into it.
          await ensureHermesProfileExists(created.profile.hermesProfileName);
          await db
            .update(agentProfiles)
            .set({
              config: { composio_mcp_url: url },
              updatedAt: new Date(),
            })
            .where(eq(agentProfiles.id, created.profile.id));
          // eslint-disable-next-line no-console
          console.log(
            `[workspaces] composio MCP url stored for ws=${created.workspace.id} profile=${created.profile.hermesProfileName}`,
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(
            `[workspaces] composio MCP setup error for ws=${created.workspace.id}:`,
            err,
          );
        }
      })();
    }

    return reply.code(201).send(toApiShape(created.workspace));
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

    // Stop any running Hermes gateways for this workspace's profiles before
    // the cascading FK delete removes their rows.
    const profilesToStop = await db
      .select({ id: agentProfiles.id })
      .from(agentProfiles)
      .where(eq(agentProfiles.workspaceId, params.data.id));
    await Promise.all(
      profilesToStop.map((p) => stopGateway(p.id, "workspace_deleted")),
    );

    await db.delete(workspaces).where(eq(workspaces.id, params.data.id));
    return reply.code(204).send();
  });
}
