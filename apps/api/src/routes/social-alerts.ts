import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { socialAlerts, workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";

const WorkspaceParams = z.object({ id: z.string().uuid() });
const AlertParams = z.object({
  id: z.string().uuid(),
  alertId: z.string().uuid(),
});

const CreateBody = z.object({
  alertType: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  platform: z.string().max(64).nullish(),
  metricValue: z.number().nullish(),
  thresholdValue: z.number().nullish(),
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

export default async function socialAlertsRoutes(app: FastifyInstance) {
  // List unacknowledged alerts for the workspace.
  app.get("/workspaces/:id/social-alerts", async (req, reply) => {
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
      .from(socialAlerts)
      .where(
        and(eq(socialAlerts.workspaceId, params.data.id), eq(socialAlerts.acknowledged, false)),
      )
      .orderBy(desc(socialAlerts.createdAt))
      .limit(20);
    return { alerts: rows };
  });

  // Insert a new alert (called by the SPA when metrics cross thresholds).
  app.post("/workspaces/:id/social-alerts", async (req, reply) => {
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
      .insert(socialAlerts)
      .values({
        workspaceId: params.data.id,
        userId: dbId,
        alertType: body.alertType,
        title: body.title,
        message: body.message,
        severity: body.severity,
        platform: body.platform ?? null,
        metricValue: body.metricValue != null ? body.metricValue.toString() : null,
        thresholdValue: body.thresholdValue != null ? body.thresholdValue.toString() : null,
      })
      .returning();
    return reply.code(201).send({ alert: row });
  });

  // Acknowledge an alert (clear from banner).
  app.patch("/workspaces/:id/social-alerts/:alertId/acknowledge", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = AlertParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const [row] = await db
      .update(socialAlerts)
      .set({ acknowledged: true })
      .where(
        and(
          eq(socialAlerts.id, params.data.alertId),
          eq(socialAlerts.workspaceId, params.data.id),
        ),
      )
      .returning();
    if (!row) return reply.code(404).send({ error: "not_found" });
    return { alert: row };
  });
}
