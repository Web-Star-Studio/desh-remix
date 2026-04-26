import { and, asc, eq, lte } from "drizzle-orm";
import { composioConnections, emailSnoozes } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { assertWorkspaceMember } from "./workspace-members.js";
import { entityIdFor, executeAction, isComposioConfigured } from "./composio.js";

// Snooze service. Snoozing fires Composio modifyLabels (remove from inbox,
// add SNOOZED label) and persists the original-label list for restore. The
// snooze-restore-tick pg-boss job calls findDueSnoozes() each minute and
// invokes restoreSnooze() per row to reverse the labels.

const SNOOZED_LABEL = "SNOOZED";

export interface ApiEmailSnooze {
  id: string;
  workspaceId: string;
  userId: string | null;
  gmailId: string;
  subject: string;
  fromName: string;
  snoozeUntil: string;
  originalLabels: string[];
  restored: boolean;
  createdAt: string;
}

function toApiSnooze(row: typeof emailSnoozes.$inferSelect): ApiEmailSnooze {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    gmailId: row.gmailId,
    subject: row.subject,
    fromName: row.fromName,
    snoozeUntil: row.snoozeUntil.toISOString(),
    originalLabels: row.originalLabels,
    restored: row.restored,
    createdAt: row.createdAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

export async function listSnoozes(
  workspaceId: string,
  actorUserId: string,
  opts: { includeRestored?: boolean } = {},
): Promise<ApiEmailSnooze[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const conditions = [eq(emailSnoozes.workspaceId, workspaceId)];
  if (!opts.includeRestored) conditions.push(eq(emailSnoozes.restored, false));
  const rows = await db
    .select()
    .from(emailSnoozes)
    .where(and(...conditions))
    .orderBy(asc(emailSnoozes.snoozeUntil));
  return rows.map(toApiSnooze);
}

export interface SnoozeEmailInput {
  gmailId: string;
  subject?: string;
  fromName?: string;
  snoozeUntil: string; // ISO
  originalLabels?: string[];
}

export async function snoozeEmail(
  workspaceId: string,
  actorUserId: string,
  input: SnoozeEmailInput,
): Promise<ApiEmailSnooze> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (!isComposioConfigured()) throw new ServiceError(503, "composio_unconfigured");
  const db = dbOrThrow();

  const until = new Date(input.snoozeUntil);
  if (Number.isNaN(until.getTime())) throw new ServiceError(400, "invalid_snooze_until");
  if (until.getTime() <= Date.now()) throw new ServiceError(400, "snooze_in_past");

  const entity = entityIdFor(workspaceId, actorUserId);
  // Take the inbox label off, add a SNOOZED label so the message remains
  // visible somewhere (and so the cron has a stable label to remove on
  // restore). This is the same shape as the legacy SPA's snooze action.
  await executeAction(entity, "GMAIL_MODIFY_LABELS", {
    messageId: input.gmailId,
    addLabels: [SNOOZED_LABEL],
    removeLabels: ["INBOX"],
  });

  const originalLabels = input.originalLabels ?? ["INBOX"];

  const [row] = await db
    .insert(emailSnoozes)
    .values({
      workspaceId,
      userId: actorUserId,
      gmailId: input.gmailId,
      subject: input.subject ?? "",
      fromName: input.fromName ?? "",
      snoozeUntil: until,
      originalLabels,
      restored: false,
    })
    .onConflictDoUpdate({
      target: [emailSnoozes.workspaceId, emailSnoozes.gmailId],
      set: {
        snoozeUntil: until,
        originalLabels,
        restored: false,
        subject: input.subject ?? "",
        fromName: input.fromName ?? "",
      },
    })
    .returning();
  if (!row) throw new ServiceError(500, "snooze_persist_failed");
  return toApiSnooze(row);
}

export async function restoreSnooze(
  workspaceId: string,
  snoozeId: string,
  actorUserIdOpt?: string,
): Promise<void> {
  const db = dbOrThrow();
  if (actorUserIdOpt) await assertWorkspaceMember(workspaceId, actorUserIdOpt);

  const [snooze] = await db
    .select()
    .from(emailSnoozes)
    .where(and(eq(emailSnoozes.id, snoozeId), eq(emailSnoozes.workspaceId, workspaceId)))
    .limit(1);
  if (!snooze) throw new ServiceError(404, "snooze_not_found");
  if (snooze.restored) return;

  const userId = snooze.userId;
  if (!userId) {
    // No user attribution — can't make the Composio call; mark restored so
    // the cron stops picking it up but log a warning.
    await db
      .update(emailSnoozes)
      .set({ restored: true })
      .where(eq(emailSnoozes.id, snoozeId));
    return;
  }

  if (!isComposioConfigured()) throw new ServiceError(503, "composio_unconfigured");

  // Resolve the connection so we know the entity (we may be running from
  // the cron, where the actor user is the snooze creator).
  const [conn] = await db
    .select({ id: composioConnections.id })
    .from(composioConnections)
    .where(
      and(
        eq(composioConnections.workspaceId, workspaceId),
        eq(composioConnections.toolkit, "gmail"),
        eq(composioConnections.userId, userId),
      ),
    )
    .limit(1);
  if (!conn) {
    // Connection got disconnected; just clear the snooze.
    await db
      .update(emailSnoozes)
      .set({ restored: true })
      .where(eq(emailSnoozes.id, snoozeId));
    return;
  }

  const entity = entityIdFor(workspaceId, userId);
  await executeAction(entity, "GMAIL_MODIFY_LABELS", {
    messageId: snooze.gmailId,
    addLabels: snooze.originalLabels,
    removeLabels: [SNOOZED_LABEL],
  });

  await db
    .update(emailSnoozes)
    .set({ restored: true })
    .where(eq(emailSnoozes.id, snoozeId));
}

// Cron-side: rows whose snoozeUntil has elapsed and aren't yet restored.
// Capped to keep a single tick bounded; remaining rows pick up next minute.
export async function findDueSnoozes(
  limit = 100,
): Promise<{ id: string; workspaceId: string }[]> {
  const db = dbOrThrow();
  const rows = await db
    .select({ id: emailSnoozes.id, workspaceId: emailSnoozes.workspaceId })
    .from(emailSnoozes)
    .where(
      and(
        eq(emailSnoozes.restored, false),
        lte(emailSnoozes.snoozeUntil, new Date()),
      ),
    )
    .orderBy(asc(emailSnoozes.snoozeUntil))
    .limit(limit);
  return rows;
}
