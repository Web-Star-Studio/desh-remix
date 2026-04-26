import { and, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { emails } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { assertWorkspaceMember } from "./workspace-members.js";
import { publishEmailEvent } from "./email-event-bus.js";

// Service layer for the unified Gmail message cache. Read paths back the
// SPA inbox; write paths are driven by gmail-sync (webhook-triggered) and
// the action layer (mark-read/star/trash). Composio is NOT called from
// here — the action layer remains in the SPA's useGmailActions Composio
// façade, so this service only mirrors the resulting state into the cache.

export interface ApiEmail {
  id: string;
  workspaceId: string;
  connectionId: string;
  gmailId: string;
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  bodyPreview: string;
  date: string;
  isUnread: boolean;
  isStarred: boolean;
  hasAttachment: boolean;
  labelIds: string[];
  folder: string;
  headers: Record<string, unknown>;
  metadata: Record<string, unknown>;
  composioSyncedAt: string | null;
  createdAt: string;
}

function toApiEmail(row: typeof emails.$inferSelect): ApiEmail {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    connectionId: row.connectionId,
    gmailId: row.gmailId,
    threadId: row.threadId,
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    subject: row.subject,
    snippet: row.snippet,
    bodyPreview: row.bodyPreview,
    date: row.date.toISOString(),
    isUnread: row.isUnread,
    isStarred: row.isStarred,
    hasAttachment: row.hasAttachment,
    labelIds: row.labelIds,
    folder: row.folder,
    headers: (row.headers as Record<string, unknown> | null) ?? {},
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    composioSyncedAt: row.composioSyncedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

export interface ListEmailsOptions {
  folder?: string;
  label?: string;
  limit?: number;
  cursor?: string; // ISO date — return rows with date < cursor
}

export async function listEmails(
  workspaceId: string,
  actorUserId: string,
  opts: ListEmailsOptions = {},
): Promise<{ items: ApiEmail[]; nextCursor: string | null }> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const conditions = [eq(emails.workspaceId, workspaceId)];
  if (opts.folder) conditions.push(eq(emails.folder, opts.folder));
  if (opts.label) {
    // text[] contains operator
    conditions.push(sql`${emails.labelIds} @> array[${opts.label}]::text[]`);
  }
  if (opts.cursor) {
    const cursorDate = new Date(opts.cursor);
    if (Number.isNaN(cursorDate.getTime())) {
      throw new ServiceError(400, "invalid_cursor");
    }
    conditions.push(lt(emails.date, cursorDate));
  }

  const rows = await db
    .select()
    .from(emails)
    .where(and(...conditions))
    .orderBy(desc(emails.date))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(toApiEmail);
  const nextCursor = hasMore ? rows[limit - 1]!.date.toISOString() : null;
  return { items, nextCursor };
}

export async function searchEmails(
  workspaceId: string,
  actorUserId: string,
  query: string,
  limit = 20,
): Promise<ApiEmail[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const trimmed = query.trim();
  if (!trimmed) return [];
  const pattern = `%${trimmed}%`;
  const rows = await db
    .select()
    .from(emails)
    .where(
      and(
        eq(emails.workspaceId, workspaceId),
        or(
          ilike(emails.subject, pattern),
          ilike(emails.fromName, pattern),
          ilike(emails.fromEmail, pattern),
          ilike(emails.snippet, pattern),
          ilike(emails.bodyPreview, pattern),
        ),
      ),
    )
    .orderBy(desc(emails.date))
    .limit(Math.max(1, Math.min(limit, 100)));
  return rows.map(toApiEmail);
}

export async function getEmail(
  workspaceId: string,
  actorUserId: string,
  emailId: string,
): Promise<ApiEmail> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const [row] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, emailId), eq(emails.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new ServiceError(404, "email_not_found");
  return toApiEmail(row);
}

export interface PatchEmailInput {
  isRead?: boolean;
  isStarred?: boolean;
  labelIds?: string[];
  folder?: string;
}

export async function patchEmail(
  workspaceId: string,
  actorUserId: string,
  emailId: string,
  input: PatchEmailInput,
): Promise<ApiEmail> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const set: Partial<typeof emails.$inferInsert> = {};
  if (input.isRead !== undefined) set.isUnread = !input.isRead;
  if (input.isStarred !== undefined) set.isStarred = input.isStarred;
  if (input.labelIds !== undefined) set.labelIds = input.labelIds;
  if (input.folder !== undefined) set.folder = input.folder;

  const [updated] = await db
    .update(emails)
    .set(set)
    .where(and(eq(emails.id, emailId), eq(emails.workspaceId, workspaceId)))
    .returning();
  if (!updated) throw new ServiceError(404, "email_not_found");
  return toApiEmail(updated);
}

export async function trashEmail(
  workspaceId: string,
  actorUserId: string,
  emailId: string,
): Promise<ApiEmail> {
  return patchEmail(workspaceId, actorUserId, emailId, { folder: "trash" });
}

// ─── Internal write paths (called by gmail-sync, not by routes) ─────

export interface UpsertEmailInput {
  workspaceId: string;
  connectionId: string;
  gmailId: string;
  threadId?: string | null;
  fromName?: string;
  fromEmail?: string;
  subject?: string;
  snippet?: string;
  bodyPreview?: string;
  date: Date;
  isUnread?: boolean;
  isStarred?: boolean;
  hasAttachment?: boolean;
  labelIds?: string[];
  folder?: string;
  headers?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function upsertEmails(rows: UpsertEmailInput[]): Promise<void> {
  if (rows.length === 0) return;
  const db = dbOrThrow();
  const now = new Date();
  // Group by workspace so we can fan out a single SSE notification per
  // workspace at the end. Different workspaces never share the same row
  // (PK includes workspace_id) so this grouping is exact.
  const byWorkspace = new Map<string, string[]>();
  for (const r of rows) {
    const list = byWorkspace.get(r.workspaceId) ?? [];
    list.push(r.gmailId);
    byWorkspace.set(r.workspaceId, list);
  }
  await db
    .insert(emails)
    .values(
      rows.map((r) => ({
        workspaceId: r.workspaceId,
        connectionId: r.connectionId,
        gmailId: r.gmailId,
        threadId: r.threadId ?? null,
        fromName: r.fromName ?? "",
        fromEmail: r.fromEmail ?? "",
        subject: r.subject ?? "",
        snippet: r.snippet ?? "",
        bodyPreview: r.bodyPreview ?? "",
        date: r.date,
        isUnread: r.isUnread ?? true,
        isStarred: r.isStarred ?? false,
        hasAttachment: r.hasAttachment ?? false,
        labelIds: r.labelIds ?? [],
        folder: r.folder ?? "inbox",
        headers: r.headers ?? {},
        metadata: r.metadata ?? {},
        composioSyncedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [emails.workspaceId, emails.gmailId],
      set: {
        threadId: sql`excluded.thread_id`,
        fromName: sql`excluded.from_name`,
        fromEmail: sql`excluded.from_email`,
        subject: sql`excluded.subject`,
        snippet: sql`excluded.snippet`,
        bodyPreview: sql`excluded.body_preview`,
        date: sql`excluded.date`,
        isUnread: sql`excluded.is_unread`,
        isStarred: sql`excluded.is_starred`,
        hasAttachment: sql`excluded.has_attachment`,
        labelIds: sql`excluded.label_ids`,
        folder: sql`excluded.folder`,
        headers: sql`excluded.headers`,
        metadata: sql`excluded.metadata`,
        composioSyncedAt: sql`excluded.composio_synced_at`,
      },
    });
  // Fan out SSE notifications. The cache write completed; subscribers can
  // now refetch the affected rows.
  for (const [workspaceId, gmailIds] of byWorkspace) {
    publishEmailEvent({ type: "upsert", workspaceId, gmailIds, ts: now.toISOString() });
  }
}

export async function deleteEmailsByGmailId(
  workspaceId: string,
  gmailIds: string[],
): Promise<void> {
  if (gmailIds.length === 0) return;
  const db = dbOrThrow();
  await db
    .delete(emails)
    .where(
      and(
        eq(emails.workspaceId, workspaceId),
        inArray(emails.gmailId, gmailIds),
      ),
    );
  publishEmailEvent({
    type: "delete",
    workspaceId,
    gmailIds,
    ts: new Date().toISOString(),
  });
}
