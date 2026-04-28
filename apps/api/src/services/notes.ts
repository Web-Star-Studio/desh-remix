import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { notes } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { assertWorkspaceMember } from "./workspace-members.js";
import { emitAutomationEvent } from "./automations.js";

// Notes service. Single source of truth for note CRUD across REST routes
// and (future) MCP tools. Follows the contacts/tasks pattern: workspace +
// member-gated, soft-delete via `deletedAt`, bulk ops as a single update.

export interface ApiNote {
  id: string;
  workspaceId: string;
  createdBy: string | null;
  title: string;
  content: string;
  tags: string[];
  notebook: string;
  color: string;
  pinned: boolean;
  favorited: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toApi(row: typeof notes.$inferSelect): ApiNote {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdBy: row.createdBy,
    title: row.title,
    content: row.content,
    tags: row.tags,
    notebook: row.notebook,
    color: row.color,
    pinned: row.pinned,
    favorited: row.favorited,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

// ─── List / search ─────────────────────────────────────────────────

export interface ListNotesOptions {
  // When true, returns only soft-deleted notes (the trash view). Default false
  // returns active notes only.
  trashed?: boolean;
  notebook?: string;
  favoritesOnly?: boolean;
  search?: string;
  limit?: number;
}

export async function listNotes(
  workspaceId: string,
  actorUserId: string,
  opts: ListNotesOptions = {},
): Promise<ApiNote[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const conditions = [eq(notes.workspaceId, workspaceId)];
  if (opts.trashed) conditions.push(isNotNull(notes.deletedAt));
  else conditions.push(isNull(notes.deletedAt));
  if (opts.notebook) conditions.push(eq(notes.notebook, opts.notebook));
  if (opts.favoritesOnly) conditions.push(eq(notes.favorited, true));
  if (opts.search) {
    const pattern = `%${opts.search.trim()}%`;
    const tagMatch = sql`${notes.tags}::text ilike ${pattern}`;
    const m = or(ilike(notes.title, pattern), ilike(notes.content, pattern), tagMatch);
    if (m) conditions.push(m);
  }

  // Pinned-first, then most-recently-updated. The SPA does the same sort
  // client-side today; doing it server-side lets us keep the SPA shape
  // unchanged and stable across paginated requests in the future.
  const rows = await db
    .select()
    .from(notes)
    .where(and(...conditions))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt), asc(notes.title))
    .limit(Math.max(1, Math.min(opts.limit ?? 1000, 5000)));
  return rows.map(toApi);
}

export async function getNote(
  workspaceId: string,
  actorUserId: string,
  noteId: string,
): Promise<ApiNote> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const [row] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new ServiceError(404, "note_not_found");
  return toApi(row);
}

// Distinct notebook names for the sidebar tree. Excludes the empty default.
export async function listNotebooks(
  workspaceId: string,
  actorUserId: string,
): Promise<string[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const rows = await db
    .selectDistinct({ notebook: notes.notebook })
    .from(notes)
    .where(and(eq(notes.workspaceId, workspaceId), isNull(notes.deletedAt)));
  return rows
    .map((r) => r.notebook)
    .filter((n) => n && n.length > 0)
    .sort();
}

// ─── Mutations ────────────────────────────────────────────────────

export interface CreateNoteInput {
  title?: string;
  content?: string;
  tags?: string[];
  notebook?: string;
  color?: string;
  pinned?: boolean;
  favorited?: boolean;
}

export async function createNote(
  workspaceId: string,
  actorUserId: string,
  input: CreateNoteInput,
): Promise<ApiNote> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const [row] = await db
    .insert(notes)
    .values({
      workspaceId,
      createdBy: actorUserId,
      title: input.title ?? "",
      content: input.content ?? "",
      tags: input.tags ?? [],
      notebook: input.notebook ?? "",
      color: input.color ?? "border-l-primary",
      pinned: input.pinned ?? false,
      favorited: input.favorited ?? false,
    })
    .returning();
  if (!row) throw new ServiceError(500, "insert_failed");
  emitAutomationEvent(workspaceId, "note_created", {
    noteId: row.id,
    title: row.title,
    notebook: row.notebook,
  });
  return toApi(row);
}

export type UpdateNoteInput = Partial<CreateNoteInput>;

export async function updateNote(
  workspaceId: string,
  actorUserId: string,
  noteId: string,
  input: UpdateNoteInput,
): Promise<ApiNote> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const [row] = await db
    .update(notes)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(notes.id, noteId), eq(notes.workspaceId, workspaceId)))
    .returning();
  if (!row) throw new ServiceError(404, "note_not_found");
  return toApi(row);
}

// Soft-delete: flips `deletedAt`. Restoring sets it back to null. Idempotent
// (re-trashing refreshes the timestamp; restoring an active note is a no-op).
export async function trashNotes(
  workspaceId: string,
  actorUserId: string,
  noteIds: string[],
): Promise<{ trashed: number }> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (noteIds.length === 0) return { trashed: 0 };
  const db = dbOrThrow();
  const result = await db
    .update(notes)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(notes.workspaceId, workspaceId), inArray(notes.id, noteIds)))
    .returning({ id: notes.id });
  return { trashed: result.length };
}

export async function restoreNotes(
  workspaceId: string,
  actorUserId: string,
  noteIds: string[],
): Promise<{ restored: number }> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (noteIds.length === 0) return { restored: 0 };
  const db = dbOrThrow();
  const result = await db
    .update(notes)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(notes.workspaceId, workspaceId), inArray(notes.id, noteIds)))
    .returning({ id: notes.id });
  return { restored: result.length };
}

export async function permanentDeleteNotes(
  workspaceId: string,
  actorUserId: string,
  noteIds: string[],
): Promise<{ deleted: number }> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (noteIds.length === 0) return { deleted: 0 };
  const db = dbOrThrow();
  const result = await db
    .delete(notes)
    .where(and(eq(notes.workspaceId, workspaceId), inArray(notes.id, noteIds)))
    .returning({ id: notes.id });
  return { deleted: result.length };
}

export async function emptyTrash(
  workspaceId: string,
  actorUserId: string,
): Promise<{ deleted: number }> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const result = await db
    .delete(notes)
    .where(and(eq(notes.workspaceId, workspaceId), isNotNull(notes.deletedAt)))
    .returning({ id: notes.id });
  return { deleted: result.length };
}

// ─── Bulk ops ─────────────────────────────────────────────────────
// The SPA exposes "bulk pin / favorite / set notebook / set color" on
// multi-selected notes. One UPDATE per call keeps the SPA's optimistic
// path simple — the response returns the updated rows so the cache
// re-syncs in one go.

export interface BulkPatchInput {
  noteIds: string[];
  pinned?: boolean;
  favorited?: boolean;
  notebook?: string;
  color?: string;
  // Adds these tags to every selected note (deduplicates server-side).
  addTags?: string[];
}

export async function bulkPatchNotes(
  workspaceId: string,
  actorUserId: string,
  input: BulkPatchInput,
): Promise<ApiNote[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (input.noteIds.length === 0) return [];
  const db = dbOrThrow();

  const set: Partial<typeof notes.$inferInsert> = {};
  if (input.pinned !== undefined) set.pinned = input.pinned;
  if (input.favorited !== undefined) set.favorited = input.favorited;
  if (input.notebook !== undefined) set.notebook = input.notebook;
  if (input.color !== undefined) set.color = input.color;
  set.updatedAt = new Date();

  let result: (typeof notes.$inferSelect)[];
  if (input.addTags && input.addTags.length > 0) {
    // Postgres array union — `tags || $1` then dedup via a subquery would be
    // ideal, but Drizzle's `set` doesn't compose raw SQL in arrays cleanly
    // across rows. Two-pass is fine here because the bulk action is a small
    // selection (≤100 rows in practice).
    result = [];
    const rows = await db
      .select()
      .from(notes)
      .where(and(eq(notes.workspaceId, workspaceId), inArray(notes.id, input.noteIds)));
    for (const row of rows) {
      const merged = Array.from(new Set([...row.tags, ...input.addTags]));
      const [updated] = await db
        .update(notes)
        .set({ ...set, tags: merged })
        .where(eq(notes.id, row.id))
        .returning();
      if (updated) result.push(updated);
    }
  } else {
    result = await db
      .update(notes)
      .set(set)
      .where(and(eq(notes.workspaceId, workspaceId), inArray(notes.id, input.noteIds)))
      .returning();
  }
  return result.map(toApi);
}
