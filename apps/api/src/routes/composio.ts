import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { composioConnections, workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";
import { env } from "../config/env.js";
import {
  disconnectToolkit,
  entityIdFor,
  executeAction,
  initiateConnection,
  isComposioConfigured,
  listConnectedToolkits,
  normalizeToolkitSlug,
} from "../services/composio.js";

const WorkspaceParams = z.object({ id: z.string().uuid() });
const ToolkitParams = z.object({
  id: z.string().uuid(),
  toolkit: z.string().min(1).max(64),
});

const ConnectBody = z.object({
  scope: z.enum(["workspace", "member"]).optional(),
}).optional();

const ExecuteBody = z.object({
  workspaceId: z.string().uuid(),
  toolkit: z.string().min(1).max(64),
  action: z.string().min(1).max(200),
  arguments: z.record(z.unknown()).optional(),
});

async function requireMembership(
  workspaceId: string,
  userDbId: string,
): Promise<{ role: string } | null> {
  const db = getDb();
  if (!db) return null;
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
  return rows[0] ?? null;
}

export default async function composioRoutes(app: FastifyInstance) {
  app.get("/workspaces/:id/composio-connections", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });

    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    // Live state from Composio is the source of truth — our table only tracks
    // which connections were *initiated* via apps/api. Composio may have
    // additional active connections from older edge-fn flows; surface them.
    const live = isComposioConfigured()
      ? await listConnectedToolkits(entityIdFor(params.data.id, dbId))
      : [];

    const stored = await db
      .select()
      .from(composioConnections)
      .where(eq(composioConnections.workspaceId, params.data.id));
    const visibleStored = stored.filter(
      (c) => c.scope === "workspace" || c.userId === dbId,
    );

    const liveByToolkit = new Map(live.map((c) => [c.toolkit, c]));
    const seen = new Set<string>();
    const merged: Array<{
      id: string | null;
      toolkit: string;
      scope: string;
      status: string;
      composioEntityId: string;
      email: string | null;
      connectedAt: string | null;
      live: boolean;
    }> = [];

    for (const row of visibleStored) {
      const liveMatch = liveByToolkit.get(row.toolkit);
      seen.add(row.toolkit);
      merged.push({
        id: row.id,
        toolkit: row.toolkit,
        scope: row.scope,
        status: liveMatch ? liveMatch.status : row.status,
        composioEntityId: row.composioEntityId,
        email: liveMatch?.email ?? null,
        connectedAt: liveMatch?.connectedAt ?? row.createdAt.toISOString(),
        live: Boolean(liveMatch),
      });
    }
    // Surface live-only connections (e.g. legacy flows) so the UI can adopt them.
    for (const c of live) {
      if (seen.has(c.toolkit)) continue;
      merged.push({
        id: null,
        toolkit: c.toolkit,
        scope: "member",
        status: c.status,
        composioEntityId: c.connectionId,
        email: c.email,
        connectedAt: c.connectedAt,
        live: true,
      });
    }
    return merged;
  });

  app.post("/workspaces/:id/composio-connections/:toolkit/connect", async (req, reply) => {
    if (!isComposioConfigured()) {
      return reply.code(503).send({ error: "composio_not_configured" });
    }
    const dbId = await requireUserDbId(req);
    const params = ToolkitParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = ConnectBody.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const toolkit = normalizeToolkitSlug(params.data.toolkit);
    const entityId = entityIdFor(params.data.id, dbId);
    const scope = body.data?.scope ?? "member";

    let result;
    try {
      result = await initiateConnection(entityId, toolkit);
    } catch (err) {
      req.log.error({ err, toolkit }, "[composio] initiate failed");
      return reply.code(502).send({ error: "composio_initiate_failed" });
    }

    // Best-effort upsert of the connection row. If the user abandons the
    // OAuth flow, the row is harmless — `live: false` on subsequent GETs.
    const existing = await db
      .select({ id: composioConnections.id })
      .from(composioConnections)
      .where(
        and(
          eq(composioConnections.workspaceId, params.data.id),
          eq(composioConnections.userId, dbId),
          eq(composioConnections.toolkit, toolkit),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(composioConnections)
        .set({
          status: "pending",
          composioEntityId: result.connectionId ?? entityId,
          updatedAt: new Date(),
        })
        .where(eq(composioConnections.id, existing[0].id));
    } else {
      await db.insert(composioConnections).values({
        workspaceId: params.data.id,
        userId: scope === "member" ? dbId : null,
        toolkit,
        scope,
        composioEntityId: result.connectionId ?? entityId,
        status: "pending",
      });
    }

    return reply.send({ redirectUrl: result.redirectUrl, toolkit });
  });

  app.delete("/workspaces/:id/composio-connections/:toolkit", async (req, reply) => {
    if (!isComposioConfigured()) {
      return reply.code(503).send({ error: "composio_not_configured" });
    }
    const dbId = await requireUserDbId(req);
    const params = ToolkitParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const toolkit = normalizeToolkitSlug(params.data.toolkit);
    const entityId = entityIdFor(params.data.id, dbId);

    const removed = await disconnectToolkit(entityId, toolkit);

    await db
      .delete(composioConnections)
      .where(
        and(
          eq(composioConnections.workspaceId, params.data.id),
          eq(composioConnections.userId, dbId),
          eq(composioConnections.toolkit, toolkit),
        ),
      );

    return { removed, toolkit };
  });

  // OAuth landing — Composio redirects here after the user completes auth.
  // We bounce to the SPA's integrations page with a query flag so it can
  // refresh its connection list. No DB write happens here; the next
  // GET /workspaces/:id/composio-connections will reflect the live state.
  app.get("/composio/callback", async (_req, reply) => {
    const target =
      env.COMPOSIO_REDIRECT_URL ??
      "http://localhost:8080/integrations?composio_callback=true";
    return reply.redirect(target, 302);
  });

  app.post("/composio/execute", async (req, reply) => {
    if (!isComposioConfigured()) {
      return reply.code(503).send({ error: "composio_not_configured" });
    }
    const dbId = await requireUserDbId(req);
    const parsed = ExecuteBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const { workspaceId, toolkit, action, arguments: args } = parsed.data;

    if (!(await requireMembership(workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const entityId = entityIdFor(workspaceId, dbId);
    try {
      const result = await executeAction(entityId, action, args ?? {});
      return { ok: true, toolkit: normalizeToolkitSlug(toolkit), action, data: result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      req.log.warn({ err: message, action, toolkit }, "[composio] execute failed");
      return reply.code(502).send({ error: "composio_execute_failed", message });
    }
  });
}
