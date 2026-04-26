import { and, eq, sql } from "drizzle-orm";
import { composioConnections, gmailLabels } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { assertWorkspaceMember } from "./workspace-members.js";
import { entityIdFor, executeAction, isComposioConfigured } from "./composio.js";

// Gmail label catalog service. Reads back the cached label list; writes go
// through Composio (GMAIL_FETCH_LABELS / GMAIL_CREATE_LABEL / GMAIL_DELETE_LABEL)
// followed by a row-level upsert to keep the cache fresh. The label cache is
// cheap to refresh on demand; we don't run a cron for it.

export interface ApiGmailLabel {
  id: string;
  workspaceId: string;
  connectionId: string;
  gmailLabelId: string;
  name: string;
  labelType: string;
  colorBg: string | null;
  colorText: string | null;
  messagesTotal: number;
  messagesUnread: number;
  syncedAt: string;
}

function toApiLabel(row: typeof gmailLabels.$inferSelect): ApiGmailLabel {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    connectionId: row.connectionId,
    gmailLabelId: row.gmailLabelId,
    name: row.name,
    labelType: row.labelType,
    colorBg: row.colorBg,
    colorText: row.colorText,
    messagesTotal: row.messagesTotal,
    messagesUnread: row.messagesUnread,
    syncedAt: row.syncedAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

export async function listLabels(
  workspaceId: string,
  actorUserId: string,
): Promise<ApiGmailLabel[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const rows = await db
    .select()
    .from(gmailLabels)
    .where(eq(gmailLabels.workspaceId, workspaceId))
    .orderBy(gmailLabels.name);
  return rows.map(toApiLabel);
}

async function resolveGmailConnection(
  workspaceId: string,
  actorUserId: string,
): Promise<typeof composioConnections.$inferSelect> {
  const db = dbOrThrow();
  const [conn] = await db
    .select()
    .from(composioConnections)
    .where(
      and(
        eq(composioConnections.workspaceId, workspaceId),
        eq(composioConnections.toolkit, "gmail"),
        eq(composioConnections.userId, actorUserId),
      ),
    )
    .limit(1);
  if (!conn) throw new ServiceError(404, "gmail_connection_not_found");
  return conn;
}

interface ComposioLabel {
  id: string;
  name: string;
  type?: string;
  color?: { backgroundColor?: string; textColor?: string };
  messagesTotal?: number;
  messagesUnread?: number;
}

export async function refreshLabels(
  workspaceId: string,
  actorUserId: string,
): Promise<ApiGmailLabel[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (!isComposioConfigured()) throw new ServiceError(503, "composio_unconfigured");
  const db = dbOrThrow();
  const conn = await resolveGmailConnection(workspaceId, actorUserId);
  const entity = entityIdFor(workspaceId, actorUserId);

  const result = (await executeAction(entity, "GMAIL_FETCH_LABELS", {})) as {
    data?: { labels?: ComposioLabel[] };
    labels?: ComposioLabel[];
  };
  const labelsRaw = result.data?.labels ?? result.labels ?? [];
  const now = new Date();

  if (labelsRaw.length > 0) {
    await db
      .insert(gmailLabels)
      .values(
        labelsRaw.map((l) => ({
          workspaceId,
          connectionId: conn.id,
          gmailLabelId: l.id,
          name: l.name,
          labelType: l.type === "system" ? "system" : "user",
          colorBg: l.color?.backgroundColor ?? null,
          colorText: l.color?.textColor ?? null,
          messagesTotal: l.messagesTotal ?? 0,
          messagesUnread: l.messagesUnread ?? 0,
          syncedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [gmailLabels.workspaceId, gmailLabels.connectionId, gmailLabels.gmailLabelId],
        set: {
          name: sql`excluded.name`,
          labelType: sql`excluded.label_type`,
          colorBg: sql`excluded.color_bg`,
          colorText: sql`excluded.color_text`,
          messagesTotal: sql`excluded.messages_total`,
          messagesUnread: sql`excluded.messages_unread`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
  }

  return listLabels(workspaceId, actorUserId);
}

export interface CreateLabelInput {
  name: string;
  colorBg?: string;
  colorText?: string;
}

export async function createLabel(
  workspaceId: string,
  actorUserId: string,
  input: CreateLabelInput,
): Promise<ApiGmailLabel> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (!isComposioConfigured()) throw new ServiceError(503, "composio_unconfigured");
  const db = dbOrThrow();
  const conn = await resolveGmailConnection(workspaceId, actorUserId);
  const entity = entityIdFor(workspaceId, actorUserId);

  const args: Record<string, unknown> = { name: input.name };
  if (input.colorBg && input.colorText) {
    args.color = { backgroundColor: input.colorBg, textColor: input.colorText };
  }
  const result = (await executeAction(entity, "GMAIL_CREATE_LABEL", args)) as {
    data?: ComposioLabel;
    id?: string;
    name?: string;
  };
  const created = result.data ?? (result as ComposioLabel);
  if (!created.id) throw new ServiceError(502, "composio_no_label_id");

  const [row] = await db
    .insert(gmailLabels)
    .values({
      workspaceId,
      connectionId: conn.id,
      gmailLabelId: created.id,
      name: created.name ?? input.name,
      labelType: created.type === "system" ? "system" : "user",
      colorBg: created.color?.backgroundColor ?? input.colorBg ?? null,
      colorText: created.color?.textColor ?? input.colorText ?? null,
      messagesTotal: created.messagesTotal ?? 0,
      messagesUnread: created.messagesUnread ?? 0,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) {
    // Already cached — fall through to a fresh select.
    const [existing] = await db
      .select()
      .from(gmailLabels)
      .where(
        and(
          eq(gmailLabels.workspaceId, workspaceId),
          eq(gmailLabels.connectionId, conn.id),
          eq(gmailLabels.gmailLabelId, created.id),
        ),
      )
      .limit(1);
    if (!existing) throw new ServiceError(500, "label_persist_failed");
    return toApiLabel(existing);
  }
  return toApiLabel(row);
}

export async function deleteLabel(
  workspaceId: string,
  actorUserId: string,
  labelId: string,
): Promise<void> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (!isComposioConfigured()) throw new ServiceError(503, "composio_unconfigured");
  const db = dbOrThrow();

  const [label] = await db
    .select()
    .from(gmailLabels)
    .where(and(eq(gmailLabels.id, labelId), eq(gmailLabels.workspaceId, workspaceId)))
    .limit(1);
  if (!label) throw new ServiceError(404, "label_not_found");

  const entity = entityIdFor(workspaceId, actorUserId);
  await executeAction(entity, "GMAIL_DELETE_LABEL", { id: label.gmailLabelId });
  await db.delete(gmailLabels).where(eq(gmailLabels.id, labelId));
}
