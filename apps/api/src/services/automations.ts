import { and, desc, eq } from "drizzle-orm";
import { automationLogs, automationRules, tasks, notes } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type AutomationTriggerType =
  | "email_received"
  | "email_keyword"
  | "task_created"
  | "task_completed"
  | "task_overdue"
  | "event_created"
  | "contact_added"
  | "contact_low_score"
  | "finance_transaction"
  | "habit_incomplete"
  | "note_created"
  | "scheduled"
  | "whatsapp_received"
  | "social_post_published"
  | "social_post_failed"
  | "follower_milestone";

export type AutomationActionType =
  | "create_task"
  | "send_notification"
  | "add_tag"
  | "create_note"
  | "create_event"
  | "send_whatsapp"
  | "pandora_whatsapp"
  | "create_social_post"
  | "schedule_post"
  | "send_email";

export interface AutomationRuleInput {
  name: string;
  enabled: boolean;
  triggerType: AutomationTriggerType;
  triggerConfig: Record<string, unknown>;
  actionType: AutomationActionType;
  actionConfig: Record<string, unknown>;
}

// Snake-case shape returned to the SPA — preserves the existing AutomationRule
// type so the components don't need rewiring. New SPA code should prefer the
// camelCase Drizzle row shape, but Wave A keeps the legacy contract.
export interface ApiAutomationRule {
  id: string;
  user_id: string;
  workspace_id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  action_type: string;
  action_config: Record<string, unknown>;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiAutomationLog {
  id: string;
  rule_id: string;
  workspace_id: string;
  user_id: string | null;
  trigger_data: Record<string, unknown>;
  action_result: Record<string, unknown>;
  status: string;
  created_at: string;
}

function toApiRule(row: typeof automationRules.$inferSelect): ApiAutomationRule {
  return {
    id: row.id,
    user_id: row.userId,
    workspace_id: row.workspaceId,
    name: row.name,
    enabled: row.enabled,
    trigger_type: row.triggerType,
    trigger_config: (row.triggerConfig ?? {}) as Record<string, unknown>,
    action_type: row.actionType,
    action_config: (row.actionConfig ?? {}) as Record<string, unknown>,
    execution_count: row.executionCount,
    last_executed_at: row.lastExecutedAt ? row.lastExecutedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

function toApiLog(row: typeof automationLogs.$inferSelect): ApiAutomationLog {
  return {
    id: row.id,
    rule_id: row.ruleId,
    workspace_id: row.workspaceId,
    user_id: row.userId,
    trigger_data: (row.triggerData ?? {}) as Record<string, unknown>,
    action_result: (row.actionResult ?? {}) as Record<string, unknown>,
    status: row.status,
    created_at: row.createdAt.toISOString(),
  };
}

// ── Query helpers ──────────────────────────────────────────────────────────

function db() {
  const conn = getDb();
  if (!conn) throw new ServiceError(500, "db_unavailable");
  return conn;
}

async function loadRule(workspaceId: string, ruleId: string) {
  const rows = await db()
    .select()
    .from(automationRules)
    .where(and(eq(automationRules.id, ruleId), eq(automationRules.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function listRules(workspaceId: string): Promise<ApiAutomationRule[]> {
  const rows = await db()
    .select()
    .from(automationRules)
    .where(eq(automationRules.workspaceId, workspaceId))
    .orderBy(desc(automationRules.createdAt));
  return rows.map(toApiRule);
}

export async function listLogs(
  workspaceId: string,
  opts: { ruleId?: string; limit?: number } = {},
): Promise<ApiAutomationLog[]> {
  const conds = [eq(automationLogs.workspaceId, workspaceId)];
  if (opts.ruleId) conds.push(eq(automationLogs.ruleId, opts.ruleId));
  const rows = await db()
    .select()
    .from(automationLogs)
    .where(and(...conds))
    .orderBy(desc(automationLogs.createdAt))
    .limit(opts.limit ?? 100);
  return rows.map(toApiLog);
}

export async function createRule(
  workspaceId: string,
  userId: string,
  input: AutomationRuleInput,
): Promise<ApiAutomationRule> {
  const [row] = await db()
    .insert(automationRules)
    .values({
      workspaceId,
      userId,
      name: input.name,
      enabled: input.enabled,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig,
      actionType: input.actionType,
      actionConfig: input.actionConfig,
    })
    .returning();
  if (!row) throw new ServiceError(500, "insert_failed");
  return toApiRule(row);
}

export async function updateRule(
  workspaceId: string,
  ruleId: string,
  patch: Partial<AutomationRuleInput>,
): Promise<ApiAutomationRule> {
  const existing = await loadRule(workspaceId, ruleId);
  if (!existing) throw new ServiceError(404, "rule_not_found");
  const setObj: Partial<typeof automationRules.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (patch.name !== undefined) setObj.name = patch.name;
  if (patch.enabled !== undefined) setObj.enabled = patch.enabled;
  if (patch.triggerType !== undefined) setObj.triggerType = patch.triggerType;
  if (patch.triggerConfig !== undefined) setObj.triggerConfig = patch.triggerConfig;
  if (patch.actionType !== undefined) setObj.actionType = patch.actionType;
  if (patch.actionConfig !== undefined) setObj.actionConfig = patch.actionConfig;
  const [row] = await db()
    .update(automationRules)
    .set(setObj)
    .where(eq(automationRules.id, ruleId))
    .returning();
  if (!row) throw new ServiceError(500, "update_failed");
  return toApiRule(row);
}

export async function deleteRule(workspaceId: string, ruleId: string): Promise<void> {
  const result = await db()
    .delete(automationRules)
    .where(and(eq(automationRules.id, ruleId), eq(automationRules.workspaceId, workspaceId)))
    .returning({ id: automationRules.id });
  if (result.length === 0) throw new ServiceError(404, "rule_not_found");
}

export async function toggleRule(
  workspaceId: string,
  ruleId: string,
  enabled: boolean,
): Promise<ApiAutomationRule> {
  return updateRule(workspaceId, ruleId, { enabled });
}

export async function duplicateRule(
  workspaceId: string,
  userId: string,
  ruleId: string,
): Promise<ApiAutomationRule> {
  const existing = await loadRule(workspaceId, ruleId);
  if (!existing) throw new ServiceError(404, "rule_not_found");
  return createRule(workspaceId, userId, {
    name: `${existing.name} (cópia)`,
    enabled: false, // duplicates start disabled — user opts in explicitly
    triggerType: existing.triggerType as AutomationTriggerType,
    triggerConfig: existing.triggerConfig as Record<string, unknown>,
    actionType: existing.actionType as AutomationActionType,
    actionConfig: existing.actionConfig as Record<string, unknown>,
  });
}

// ── Manual run (Wave A: curated subset) ────────────────────────────────────
//
// Wave A handles the four "safe" actions that don't need any external side
// channel: create_task, create_note, send_notification (logged only — push
// delivery still TBD), and send_email (delegated to the existing
// notifications service). Other action types return `not_implemented_in_wave_a`
// which the SPA test button surfaces clearly.
//
// Wave B will plug in: send_whatsapp via Zernio, pandora_whatsapp via
// ai-router + Zernio, create_event via the calendar wave, add_tag via
// contacts, create_social_post via Zernio.

export interface RunRuleResult {
  status: "success" | "error";
  actionResult: Record<string, unknown>;
}

export async function runRuleOnce(
  workspaceId: string,
  userId: string,
  ruleId: string,
  triggerData: Record<string, unknown> = {},
): Promise<RunRuleResult> {
  const rule = await loadRule(workspaceId, ruleId);
  if (!rule) throw new ServiceError(404, "rule_not_found");

  let result: RunRuleResult;
  try {
    const data = await dispatchAction(workspaceId, userId, rule, triggerData);
    result = { status: "success", actionResult: data };
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    result = {
      status: "error",
      actionResult: { action: rule.actionType, code, message: code },
    };
  }

  await db().insert(automationLogs).values({
    ruleId: rule.id,
    workspaceId,
    userId,
    triggerData,
    actionResult: result.actionResult,
    status: result.status,
  });

  if (result.status === "success") {
    await db()
      .update(automationRules)
      .set({
        executionCount: rule.executionCount + 1,
        lastExecutedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(automationRules.id, rule.id));
  }

  return result;
}

async function dispatchAction(
  workspaceId: string,
  userId: string,
  rule: typeof automationRules.$inferSelect,
  triggerData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const config = (rule.actionConfig ?? {}) as Record<string, unknown>;
  const interpolate = (value: unknown): string => {
    if (typeof value !== "string") return "";
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const v = (triggerData as Record<string, unknown>)[key];
      return v == null ? "" : String(v);
    });
  };

  switch (rule.actionType) {
    case "create_task": {
      const title = interpolate(config.title) || "Tarefa automática";
      const description = interpolate(config.description);
      const priorityRaw = String(config.priority ?? "medium").toLowerCase();
      const priority: "low" | "medium" | "high" =
        priorityRaw === "low" || priorityRaw === "high" ? priorityRaw : "medium";
      const daysUntilDue = Number(config.days_until_due ?? config.daysUntilDue ?? 0);
      const dueDate =
        daysUntilDue > 0
          ? new Date(Date.now() + daysUntilDue * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
          : null;
      const [row] = await db()
        .insert(tasks)
        .values({
          workspaceId,
          createdBy: userId,
          title,
          description: description || "",
          priority,
          dueDate,
          status: "todo",
        })
        .returning({ id: tasks.id });
      return { action: "create_task", taskId: row?.id, title };
    }
    case "create_note": {
      const title = interpolate(config.title) || "Nota automática";
      const content = interpolate(config.content);
      const [row] = await db()
        .insert(notes)
        .values({
          workspaceId,
          createdBy: userId,
          title,
          content,
        })
        .returning({ id: notes.id });
      return { action: "create_note", noteId: row?.id, title };
    }
    case "send_notification": {
      // Browser/push delivery is the SPA's job. Server side just records the
      // intent — the SPA's notification poll picks it up via automation_logs.
      const title = interpolate(config.title) || "Notificação";
      const body = interpolate(config.body);
      return { action: "send_notification", title, body, delivered: false, reason: "logged_only" };
    }
    case "send_email":
    case "send_whatsapp":
    case "pandora_whatsapp":
    case "create_event":
    case "add_tag":
    case "create_social_post":
    case "schedule_post":
      // Wave B: these depend on email-templates wiring, the Zernio agent
      // path, the calendar wave, and contacts tag mutations. We log a clear
      // marker instead of partial behavior.
      throw new Error(`not_implemented_in_wave_a:${rule.actionType}`);
    default:
      throw new Error(`unknown_action_type:${rule.actionType}`);
  }
}
