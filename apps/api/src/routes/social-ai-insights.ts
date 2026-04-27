import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { socialAiInsights, workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";

const WorkspaceParams = z.object({ id: z.string().uuid() });
const InsightParams = z.object({
  id: z.string().uuid(),
  insightId: z.string().uuid(),
});

const CreateBody = z.object({
  actionType: z.string().min(1).max(64),
  actionLabel: z.string().min(1).max(200),
  contextData: z.string().max(20_000).nullish(),
  resultText: z.string().min(1).max(20_000),
});

async function requireMembership(workspaceId: string, userDbId: string) {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userDbId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export default async function socialAiInsightsRoutes(app: FastifyInstance) {
  app.get("/workspaces/:id/social-ai-insights", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const rows = await db
      .select()
      .from(socialAiInsights)
      .where(eq(socialAiInsights.workspaceId, params.data.id))
      .orderBy(desc(socialAiInsights.createdAt))
      .limit(30);
    return { insights: rows };
  });

  app.post("/workspaces/:id/social-ai-insights", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const [row] = await db
      .insert(socialAiInsights)
      .values({
        workspaceId: params.data.id,
        userId: dbId,
        actionType: body.actionType,
        actionLabel: body.actionLabel,
        contextData: body.contextData ?? null,
        resultText: body.resultText,
      })
      .returning();
    return reply.code(201).send({ insight: row });
  });

  app.delete("/workspaces/:id/social-ai-insights/:insightId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = InsightParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const result = await db
      .delete(socialAiInsights)
      .where(
        and(
          eq(socialAiInsights.id, params.data.insightId),
          eq(socialAiInsights.workspaceId, params.data.id),
        ),
      )
      .returning({ id: socialAiInsights.id });
    if (result.length === 0) return reply.code(404).send({ error: "not_found" });
    return reply.code(204).send();
  });
}
