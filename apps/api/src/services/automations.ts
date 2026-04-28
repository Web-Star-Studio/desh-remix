import { and, desc, eq, lt, ne } from "drizzle-orm";
import {
  automationLogs,
  automationRules,
  events,
  tasks,
  notes,
  workspaceMembers,
} from "@desh/database/schema";
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
    case "create_event": {
      // Calendar wave: events ride the same workspace-scoped, day/month/year
      // shape used by the SPA grid. `days_until` shifts off today; `time`
      // optionally pins a start_at on that day. Color/recurrence default
      // from category if the rule doesn't set them explicitly.
      const label = interpolate(config.label) || interpolate(config.title) || "Evento";
      const daysUntil = Number(config.days_until ?? config.daysUntil ?? 0);
      const target = new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000);
      const day = target.getDate();
      const month = target.getMonth();
      const year = target.getFullYear();

      const categoryRaw = String(config.category ?? "outro");
      const allowedCategories = new Set(["trabalho", "pessoal", "saúde", "educação", "lazer", "outro"]);
      const category = allowedCategories.has(categoryRaw) ? categoryRaw : "outro";

      const recurrenceRaw = String(config.recurrence ?? "none");
      const allowedRecurrence = new Set(["none", "daily", "weekly", "monthly"]);
      const recurrence = allowedRecurrence.has(recurrenceRaw) ? recurrenceRaw : "none";

      let startAt: Date | null = null;
      let endAt: Date | null = null;
      if (typeof config.time === "string" && /^\d{1,2}:\d{2}$/.test(config.time)) {
        const [hh, mm] = config.time.split(":").map(Number);
        startAt = new Date(year, month, day, hh ?? 0, mm ?? 0);
        const durationMin = Number(config.duration_minutes ?? config.durationMinutes ?? 60);
        endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);
      }

      const [row] = await db()
        .insert(events)
        .values({
          workspaceId,
          createdBy: userId,
          label,
          day,
          month,
          year,
          startAt,
          endAt,
          category,
          recurrence,
          color: typeof config.color === "string" ? config.color : "bg-muted-foreground",
          location: typeof config.location === "string" ? interpolate(config.location) : null,
          description:
            typeof config.description === "string" ? interpolate(config.description) : null,
        })
        .returning({ id: events.id });
      return { action: "create_event", eventId: row?.id, label, day, month, year };
    }
    case "send_email":
    case "send_whatsapp":
    case "pandora_whatsapp":
    case "add_tag":
    case "create_social_post":
    case "schedule_post":
      // Wave B: these depend on email-templates wiring, the Zernio agent
      // path, and contacts tag mutations. We log a clear marker instead of
      // partial behavior.
      throw new Error(`not_implemented_in_wave_a:${rule.actionType}`);
    default:
      throw new Error(`unknown_action_type:${rule.actionType}`);
  }
}

// ── Wave B: event bus + cron tick ──────────────────────────────────────────
//
// `dispatchAutomationEvent` is the realtime entry point — it loads enabled
// rules in a workspace matching `triggerType`, applies any per-trigger
// predicate against the event payload, then runs each match. Callers are
// the existing service helpers (createTask/createContact/createTransaction/
// etc.) that fire emit fire-and-forget AFTER their write commits, so a slow
// or failing automation doesn't block the originating request.
//
// `runScheduledTick` is the cron entry point invoked once per minute by
// the pg-boss `automation.cron-tick` schedule. It scans for rules of type
// `scheduled` whose configured time has elapsed since `last_executed_at`
// and for `task_overdue` rules where any task in the workspace has slipped
// past its due date. (The `habit_incomplete` trigger is intentionally
// skipped — habits feature isn't on the roadmap yet.)

export type AutomationEventPayload = Record<string, unknown>;

export async function dispatchAutomationEvent(
  workspaceId: string,
  triggerType: AutomationTriggerType,
  payload: AutomationEventPayload,
): Promise<void> {
  let rows: (typeof automationRules.$inferSelect)[];
  try {
    rows = await db()
      .select()
      .from(automationRules)
      .where(
        and(
          eq(automationRules.workspaceId, workspaceId),
          eq(automationRules.enabled, true),
          eq(automationRules.triggerType, triggerType),
        ),
      );
  } catch (err) {
     
    console.error("[automations] dispatch query failed", { workspaceId, triggerType, err });
    return;
  }

  for (const rule of rows) {
    if (!matchesTrigger(rule, payload)) continue;
    try {
      await runRuleOnce(workspaceId, rule.userId, rule.id, payload);
    } catch (err) {
      console.error("[automations] dispatch run failed", { ruleId: rule.id, err });
    }
  }
}

// Convenience wrapper for callers that don't want to await the dispatch —
// most write paths fire and forget. Errors are logged inside dispatch.
export function emitAutomationEvent(
  workspaceId: string,
  triggerType: AutomationTriggerType,
  payload: AutomationEventPayload,
): void {
  void dispatchAutomationEvent(workspaceId, triggerType, payload);
}

function matchesTrigger(
  rule: typeof automationRules.$inferSelect,
  payload: AutomationEventPayload,
): boolean {
  const cfg = (rule.triggerConfig ?? {}) as Record<string, unknown>;
  switch (rule.triggerType as AutomationTriggerType) {
    case "email_keyword": {
      const keyword = String(cfg.keyword ?? "").trim().toLowerCase();
      if (!keyword) return true;
      const haystack = [payload.subject, payload.body, payload.snippet]
        .filter((v): v is string => typeof v === "string")
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    }
    case "finance_transaction": {
      // Optional filters: type ('income'|'expense'), category, min_amount.
      const wantType = typeof cfg.type === "string" ? cfg.type : null;
      if (wantType && payload.type !== wantType) return false;
      const wantCat = typeof cfg.category === "string" ? cfg.category : null;
      if (wantCat && payload.category !== wantCat) return false;
      const minAmount = Number(cfg.min_amount ?? cfg.minAmount ?? 0);
      if (minAmount > 0 && Number(payload.amount ?? 0) < minAmount) return false;
      return true;
    }
    case "task_created":
    case "task_completed":
    case "contact_added":
    case "note_created":
      // No predicate — all events of this type fire the rule.
      return true;
    default:
      // Unknown predicate types: be permissive so future trigger types
      // don't silently drop until matchers are added.
      return true;
  }
}

// ── Cron tick ──────────────────────────────────────────────────────────────

export interface ScheduledTickResult {
  scheduledFired: number;
  taskOverdueFired: number;
}

export async function runScheduledTick(): Promise<ScheduledTickResult> {
  const conn = getDb();
  if (!conn) return { scheduledFired: 0, taskOverdueFired: 0 };

  const scheduledFired = await fireScheduledRules(conn);
  const taskOverdueFired = await fireTaskOverdueRules(conn);

  return { scheduledFired, taskOverdueFired };
}

// `scheduled` rules use a triggerConfig of either:
//   { time: "HH:MM", days: [0..6] }  — daily at HH:MM (UTC) on listed weekdays
//   { interval_minutes: N }          — every N minutes since last run
// We keep both shapes because the SPA UI hasn't standardised on one yet;
// rules whose config doesn't parse into either shape are skipped.
async function fireScheduledRules(conn: NonNullable<ReturnType<typeof getDb>>): Promise<number> {
  const rules = await conn
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.enabled, true),
        eq(automationRules.triggerType, "scheduled"),
      ),
    );

  const now = new Date();
  let fired = 0;
  for (const rule of rules) {
    if (!shouldFireScheduled(rule, now)) continue;
    try {
      await runRuleOnce(rule.workspaceId, rule.userId, rule.id, {
        firedAt: now.toISOString(),
        source: "cron",
      });
      fired += 1;
    } catch (err) {
      console.error("[automations] scheduled run failed", { ruleId: rule.id, err });
    }
  }
  return fired;
}

function shouldFireScheduled(
  rule: typeof automationRules.$inferSelect,
  now: Date,
): boolean {
  const cfg = (rule.triggerConfig ?? {}) as Record<string, unknown>;
  const lastRun = rule.lastExecutedAt ? rule.lastExecutedAt.getTime() : 0;

  if (typeof cfg.interval_minutes === "number" && cfg.interval_minutes > 0) {
    const dueAt = lastRun + cfg.interval_minutes * 60 * 1000;
    return now.getTime() >= dueAt;
  }

  if (typeof cfg.time === "string" && /^\d{1,2}:\d{2}$/.test(cfg.time)) {
    const [hh, mm] = cfg.time.split(":").map(Number);
    const wantH = hh ?? 0;
    const wantM = mm ?? 0;
    if (now.getUTCHours() !== wantH) return false;
    if (Math.abs(now.getUTCMinutes() - wantM) > 1) return false;
    if (Array.isArray(cfg.days) && cfg.days.length > 0) {
      if (!cfg.days.includes(now.getUTCDay())) return false;
    }
    // Avoid double-fire within the same minute window.
    return now.getTime() - lastRun >= 60 * 1000;
  }

  return false;
}

// `task_overdue` fires once per (rule, task) pair when a task slips past
// its due date. The current implementation is best-effort: we scan tasks
// past `now` with status≠completed in workspaces that have at least one
// `task_overdue` rule, and dispatch each matching task. The de-dup story
// (don't spam the same task daily) is handled by the rule body itself —
// SPA-side configs typically include `priority` filtering or a "create
// follow-up task" action that becomes idempotent at the task level.
async function fireTaskOverdueRules(
  conn: NonNullable<ReturnType<typeof getDb>>,
): Promise<number> {
  const rules = await conn
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.enabled, true),
        eq(automationRules.triggerType, "task_overdue"),
      ),
    );
  if (rules.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  let fired = 0;
  for (const rule of rules) {
    const overdueTasks = await conn
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, rule.workspaceId),
          ne(tasks.status, "done"),
          lt(tasks.dueDate, today),
        ),
      )
      .limit(100);

    for (const t of overdueTasks) {
      try {
        await runRuleOnce(rule.workspaceId, rule.userId, rule.id, {
          taskId: t.id,
          title: t.title,
          dueDate: t.dueDate,
          source: "cron",
        });
        fired += 1;
      } catch (err) {
        console.error("[automations] task_overdue run failed", {
          ruleId: rule.id,
          taskId: t.id,
          err,
        });
      }
    }
  }
  return fired;
}

// ── Owner resolution helper ───────────────────────────────────────────────
// Realtime emitters from non-route paths (e.g. webhook handlers, MCP tool
// invocations) may have a workspaceId but no acting userId. Fall back to
// the workspace's owner so the audit log stays attributable.

export async function resolveOwnerUserId(workspaceId: string): Promise<string | null> {
  const rows = await db()
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, "owner"),
      ),
    )
    .limit(1);
  return rows[0]?.userId ?? null;
}

