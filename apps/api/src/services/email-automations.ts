import { and, asc, eq, gte, lt } from "drizzle-orm";
import { emailAutomations, users, workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { sendNotification } from "./email-notifications.js";

// Cron- or threshold-driven email automations. The runner (pg-boss daily
// tick) iterates active automations, evaluates the trigger window against
// `lastRunAt`, resolves the audience, and dispatches via the notification
// service — so preference + rate-limit handling are inherited.
//
// Trigger semantics (4b scope):
//   - `cron` with crude time matching: hourly / daily / weekly. The cron
//     string is stored verbatim for forward compatibility, but matching is
//     "did enough time pass since last_run_at?" — good enough for daily
//     summary, weekly report, broadcasts.
//   - `threshold` with `event=credit_low|inactive` etc. — implementation
//     deferred (would need cross-feature wiring); rows are created but
//     ignored by the runner today.
//   - `manual` — never fires from the cron; the admin invokes it via
//     POST /admin/email-automations/:id/run.

export type TriggerType = "cron" | "threshold" | "manual";
export type Audience = "all" | "active" | "inactive" | "admins";

export interface ApiEmailAutomation {
  id: string;
  name: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  templateSlug: string;
  targetAudience: string;
  active: boolean;
  lastRunAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function toApi(row: typeof emailAutomations.$inferSelect): ApiEmailAutomation {
  return {
    id: row.id,
    name: row.name,
    triggerType: row.triggerType,
    triggerConfig: (row.triggerConfig as Record<string, unknown> | null) ?? {},
    templateSlug: row.templateSlug,
    targetAudience: row.targetAudience,
    active: row.active,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

export async function listAutomations(): Promise<ApiEmailAutomation[]> {
  const db = dbOrThrow();
  const rows = await db.select().from(emailAutomations).orderBy(asc(emailAutomations.name));
  return rows.map(toApi);
}

export async function getAutomation(id: string): Promise<ApiEmailAutomation> {
  const db = dbOrThrow();
  const [row] = await db.select().from(emailAutomations).where(eq(emailAutomations.id, id)).limit(1);
  if (!row) throw new ServiceError(404, "automation_not_found");
  return toApi(row);
}

export interface CreateAutomationInput {
  name: string;
  triggerType: TriggerType;
  triggerConfig?: Record<string, unknown>;
  templateSlug: string;
  targetAudience?: Audience;
  active?: boolean;
}

export async function createAutomation(
  actorUserId: string,
  input: CreateAutomationInput,
): Promise<ApiEmailAutomation> {
  const db = dbOrThrow();
  const [row] = await db
    .insert(emailAutomations)
    .values({
      name: input.name,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig ?? {},
      templateSlug: input.templateSlug,
      targetAudience: input.targetAudience ?? "all",
      active: input.active ?? true,
      createdBy: actorUserId,
    })
    .returning();
  if (!row) throw new ServiceError(500, "insert_failed");
  return toApi(row);
}

export type UpdateAutomationInput = Partial<CreateAutomationInput>;

export async function updateAutomation(
  id: string,
  input: UpdateAutomationInput,
): Promise<ApiEmailAutomation> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  const db = dbOrThrow();
  const [row] = await db
    .update(emailAutomations)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(emailAutomations.id, id))
    .returning();
  if (!row) throw new ServiceError(404, "automation_not_found");
  return toApi(row);
}

export async function deleteAutomation(id: string): Promise<void> {
  const db = dbOrThrow();
  const result = await db
    .delete(emailAutomations)
    .where(eq(emailAutomations.id, id))
    .returning({ id: emailAutomations.id });
  if (!result[0]) throw new ServiceError(404, "automation_not_found");
}

// ─── Runner internals ────────────────────────────────────────────────

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Returns true if the automation is due to fire. Cron strings are matched
// crudely against common windows (hourly/daily/weekly); anything else
// defaults to "every 24h since last run" so unknown patterns still cycle.
function shouldFireCron(cronExpr: string, lastRunAt: Date | null, now: Date): boolean {
  if (!lastRunAt) return true;
  const sinceMs = now.getTime() - lastRunAt.getTime();
  if (cronExpr.startsWith("*/") || cronExpr === "* * * * *") return sinceMs >= HOUR_MS;
  if (cronExpr.includes(" * * 1") || cronExpr.includes(" * * 0")) {
    return sinceMs >= 7 * DAY_MS;
  }
  if (cronExpr.includes("0 ") && cronExpr.includes(" * * *")) return sinceMs >= 20 * HOUR_MS;
  return sinceMs >= 24 * HOUR_MS;
}

export interface RunResult {
  evaluated: number;
  fired: number;
  sent: number;
  skipped: number;
  failed: number;
}

// Audience resolver. `all` returns every user; `active` filters by
// `users.updatedAt` (a stand-in for last_sign_in_at since the new auth path
// doesn't track that explicitly yet); `admins` filters by `is_admin=true`.
async function resolveAudienceUserIds(audience: string, now: Date): Promise<string[]> {
  const db = dbOrThrow();
  if (audience === "admins") {
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.isAdmin, true));
    return rows.map((r) => r.id);
  }
  if (audience === "active") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(gte(users.updatedAt, sevenDaysAgo));
    return rows.map((r) => r.id);
  }
  if (audience === "inactive") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(lt(users.updatedAt, sevenDaysAgo));
    return rows.map((r) => r.id);
  }
  // Default: all users.
  const rows = await db.select({ id: users.id }).from(users);
  return rows.map((r) => r.id);
}

// Resolves a workspace_id for a user to thread through to send-notification.
// Falls back to null if the user has no workspaces (e.g. system user).
async function pickWorkspaceForUser(userId: string): Promise<string | null> {
  const db = dbOrThrow();
  const [row] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner")))
    .limit(1);
  return row?.workspaceId ?? null;
}

// Single automation run — broken out for the manual `run-now` admin route.
export async function runAutomation(id: string): Promise<RunResult> {
  const db = dbOrThrow();
  const automation = await getAutomation(id);
  return await dispatchAutomation(automation, new Date(), db);
}

async function dispatchAutomation(
  automation: ApiEmailAutomation,
  now: Date,
  db: ReturnType<typeof dbOrThrow>,
): Promise<RunResult> {
  const result: RunResult = { evaluated: 1, fired: 1, sent: 0, skipped: 0, failed: 0 };

  const userIds = await resolveAudienceUserIds(automation.targetAudience, now);
  for (const uid of userIds) {
    const workspaceId = await pickWorkspaceForUser(uid);
    try {
      const res = await sendNotification({
        userId: uid,
        type: automation.templateSlug,
        data: (automation.triggerConfig.data as Record<string, unknown> | undefined) ?? {},
        workspaceId,
      });
      if (res.status === "sent") result.sent++;
      else if (res.status === "skipped") result.skipped++;
      else result.failed++;
    } catch {
      result.failed++;
    }
  }

  await db
    .update(emailAutomations)
    .set({ lastRunAt: now, updatedAt: now })
    .where(eq(emailAutomations.id, automation.id));

  return result;
}

// Cron tick — invoked by the pg-boss `email.automation-tick` schedule.
export async function runAutomationTick(): Promise<RunResult> {
  const db = dbOrThrow();
  const now = new Date();
  const totals: RunResult = { evaluated: 0, fired: 0, sent: 0, skipped: 0, failed: 0 };

  const rows = await db.select().from(emailAutomations).where(eq(emailAutomations.active, true));
  for (const row of rows) {
    totals.evaluated++;
    const automation = toApi(row);

    if (automation.triggerType === "manual") continue;
    if (automation.triggerType === "threshold") continue; // deferred

    if (automation.triggerType === "cron") {
      const cronExpr = (automation.triggerConfig.cron as string | undefined) ?? "0 0 * * *";
      const last = row.lastRunAt ?? null;
      if (!shouldFireCron(cronExpr, last, now)) continue;
    }

    const partial = await dispatchAutomation(automation, now, db);
    totals.fired += partial.fired;
    totals.sent += partial.sent;
    totals.skipped += partial.skipped;
    totals.failed += partial.failed;
  }

  return totals;
}
