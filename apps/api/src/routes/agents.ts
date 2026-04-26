import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { agentProfiles, workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";
import { stop as stopGateway } from "../services/hermes/process-supervisor.js";

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const ProfileParams = z.object({ workspaceId: z.string().uuid(), profileId: z.string().uuid() });

const PatchBody = z.object({
  displayName: z.string().min(1).max(120).optional(),
  modelId: z.string().min(1).max(200).optional(),
  systemPrompt: z.string().max(8000).nullable().optional(),
  config: z.record(z.unknown()).optional(),
});

const ModelPatchBody = z.object({
  modelId: z.string().min(1).max(200),
});

function toApiShape(row: typeof agentProfiles.$inferSelect) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    displayName: row.displayName,
    hermesProfileName: row.hermesProfileName,
    hermesPort: row.hermesPort,
    status: row.status,
    provider: row.provider,
    modelId: row.modelId,
    systemPrompt: row.systemPrompt,
    config: row.config,
    lastStartedAt: row.lastStartedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

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

export default async function agentsRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/agent-profiles", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    const member = await requireMembership(params.data.workspaceId, dbId);
    if (!member) return reply.code(404).send({ error: "not_found" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const rows = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.workspaceId, params.data.workspaceId));

    return rows.map(toApiShape);
  });

  app.patch("/workspaces/:workspaceId/agent-profiles/:profileId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ProfileParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({ error: "empty_patch" });
    }

    const member = await requireMembership(params.data.workspaceId, dbId);
    if (!member) return reply.code(404).send({ error: "not_found" });
    if (member.role === "member") return reply.code(403).send({ error: "forbidden" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const [updated] = await db
      .update(agentProfiles)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(agentProfiles.id, params.data.profileId),
          eq(agentProfiles.workspaceId, params.data.workspaceId),
        ),
      )
      .returning();

    if (!updated) return reply.code(404).send({ error: "profile_not_found" });

    // Stop the running gateway so the next message picks up new settings via
    // the supervisor's ensureRunning() lazy-spawn path. We don't eagerly
    // restart — Hermes boots on the next user message.
    if (patch.modelId !== undefined || patch.systemPrompt !== undefined || patch.config !== undefined) {
      await stopGateway(updated.id, "manual").catch((err: unknown) => {
        req.log.warn({ err, profileId: updated.id }, "[agents] failed to stop gateway");
      });
    }

    return toApiShape(updated);
  });

  app.patch("/workspaces/:workspaceId/agent/settings/model", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = ModelPatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    const member = await requireMembership(params.data.workspaceId, dbId);
    if (!member) return reply.code(404).send({ error: "not_found" });
    if (member.role === "member") return reply.code(403).send({ error: "forbidden" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    // Convenience route: updates the (only) profile for the workspace. We
    // don't yet expose multi-profile selection to the SPA; once we do, this
    // endpoint can default to the active profile or be replaced entirely.
    const profiles = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.workspaceId, params.data.workspaceId))
      .limit(1);
    const target = profiles[0];
    if (!target) return reply.code(404).send({ error: "no_profile" });

    const [updated] = await db
      .update(agentProfiles)
      .set({ modelId: parsed.data.modelId, updatedAt: new Date() })
      .where(eq(agentProfiles.id, target.id))
      .returning();
    if (!updated) return reply.code(500).send({ error: "update_failed" });

    await stopGateway(updated.id, "manual").catch((err: unknown) => {
      req.log.warn({ err, profileId: updated.id }, "[agents] failed to stop gateway after model change");
    });

    return toApiShape(updated);
  });
}
