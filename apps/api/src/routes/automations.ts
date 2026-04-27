import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";
import {
  createRule,
  deleteRule,
  duplicateRule,
  listLogs,
  listRules,
  runRuleOnce,
  toggleRule,
  updateRule,
  type AutomationActionType,
  type AutomationRuleInput,
  type AutomationTriggerType,
} from "../services/automations.js";

const WorkspaceParams = z.object({ id: z.string().uuid() });
const RuleParams = z.object({ id: z.string().uuid(), ruleId: z.string().uuid() });

// The trigger/action enums mirror the schema's check constraints. Keeping a
// single source of truth would require importing from the service module
// types — we list them here so route validation is loud and visible.
const TriggerType = z.enum([
  "email_received",
  "email_keyword",
  "task_created",
  "task_completed",
  "task_overdue",
  "event_created",
  "contact_added",
  "contact_low_score",
  "finance_transaction",
  "habit_incomplete",
  "note_created",
  "scheduled",
  "whatsapp_received",
  "social_post_published",
  "social_post_failed",
  "follower_milestone",
]);

const ActionType = z.enum([
  "create_task",
  "send_notification",
  "add_tag",
  "create_note",
  "create_event",
  "send_whatsapp",
  "pandora_whatsapp",
  "create_social_post",
  "schedule_post",
  "send_email",
]);

const RuleBody = z.object({
  name: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
  trigger_type: TriggerType,
  trigger_config: z.record(z.unknown()).default({}),
  action_type: ActionType,
  action_config: z.record(z.unknown()).default({}),
});

const RulePatchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  trigger_type: TriggerType.optional(),
  trigger_config: z.record(z.unknown()).optional(),
  action_type: ActionType.optional(),
  action_config: z.record(z.unknown()).optional(),
});

async function requireMembership(workspaceId: string, userDbId: string): Promise<{ role: string } | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userDbId)))
    .limit(1);
  return rows[0] ?? null;
}

function bodyToInput(body: z.infer<typeof RuleBody>): AutomationRuleInput {
  return {
    name: body.name,
    enabled: body.enabled,
    triggerType: body.trigger_type as AutomationTriggerType,
    triggerConfig: body.trigger_config,
    actionType: body.action_type as AutomationActionType,
    actionConfig: body.action_config,
  };
}

function patchToInput(patch: z.infer<typeof RulePatchBody>): Partial<AutomationRuleInput> {
  const out: Partial<AutomationRuleInput> = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.enabled !== undefined) out.enabled = patch.enabled;
  if (patch.trigger_type !== undefined) out.triggerType = patch.trigger_type as AutomationTriggerType;
  if (patch.trigger_config !== undefined) out.triggerConfig = patch.trigger_config;
  if (patch.action_type !== undefined) out.actionType = patch.action_type as AutomationActionType;
  if (patch.action_config !== undefined) out.actionConfig = patch.action_config;
  return out;
}

function sendServiceError(reply: import("fastify").FastifyReply, err: unknown) {
  if (isServiceError(err)) {
    return reply.code(err.httpStatus).send({ error: err.errorCode });
  }
  return reply.code(500).send({ error: "internal_error", message: (err as Error).message ?? "" });
}

export default async function automationsRoutes(app: FastifyInstance) {
  // ── Rules CRUD ──────────────────────────────────────────────────────────

  app.get("/workspaces/:id/automation-rules", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    try {
      const rules = await listRules(params.data.id);
      return { rules };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/workspaces/:id/automation-rules", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const parsed = RuleBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      const rule = await createRule(params.data.id, dbId, bodyToInput(parsed.data));
      return reply.code(201).send({ rule });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.patch("/workspaces/:id/automation-rules/:ruleId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = RuleParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const parsed = RulePatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.code(400).send({ error: "empty_patch" });
    }
    try {
      const rule = await updateRule(params.data.id, params.data.ruleId, patchToInput(parsed.data));
      return { rule };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.delete("/workspaces/:id/automation-rules/:ruleId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = RuleParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    try {
      await deleteRule(params.data.id, params.data.ruleId);
      return reply.code(204).send();
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  // ── Convenience operations ─────────────────────────────────────────────

  app.post("/workspaces/:id/automation-rules/:ruleId/toggle", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = RuleParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const Body = z.object({ enabled: z.boolean() }).safeParse(req.body);
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });
    try {
      const rule = await toggleRule(params.data.id, params.data.ruleId, Body.data.enabled);
      return { rule };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/workspaces/:id/automation-rules/:ruleId/duplicate", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = RuleParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    try {
      const rule = await duplicateRule(params.data.id, dbId, params.data.ruleId);
      return reply.code(201).send({ rule });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  // Manual fire — Wave A action subset only (create_task, create_note,
  // send_notification). Other types get logged as `error` with code
  // `not_implemented_in_wave_a:<action>` so the SPA "Test" button surfaces
  // the gap clearly.
  app.post("/workspaces/:id/automation-rules/:ruleId/run", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = RuleParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const Body = z
      .object({ triggerData: z.record(z.unknown()).optional() })
      .safeParse(req.body ?? {});
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });
    try {
      const result = await runRuleOnce(
        params.data.id,
        dbId,
        params.data.ruleId,
        Body.data.triggerData ?? {},
      );
      // 200 even on action failure — the run was logged, the SPA branches on
      // result.status to render the test outcome. 4xx/5xx are reserved for
      // membership/validation/db errors.
      return result;
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  // ── Logs ─────────────────────────────────────────────────────────────────

  app.get("/workspaces/:id/automation-logs", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }
    const Q = z
      .object({
        ruleId: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      })
      .safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    try {
      const logs = await listLogs(params.data.id, { ruleId: Q.data.ruleId, limit: Q.data.limit });
      return { logs };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });
}
