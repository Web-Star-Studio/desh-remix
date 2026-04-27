import { and, count, desc, eq, ilike, inArray, isNull, sql, sum } from "drizzle-orm";
import { files } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { assertWorkspaceMember } from "./workspace-members.js";
import {
  buildStorageKey,
  deleteObject,
  getDownloadUrl,
  getUploadUrl,
  headObject,
  isStorageConfigured,
  type FileCategory,
} from "./storage.js";
import { env } from "../config/env.js";

// Files service. Single source of truth for file CRUD across REST routes
// and (later) MCP tools. Wraps the storage layer (S3) and adds the data
// plane: folders, soft-delete, dedup, favorites, search.

export interface ApiFile {
  id: string;
  workspaceId: string;
  uploadedBy: string | null;
  folderId: string | null;
  storageKey: string;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategory;
  source: string;
  extension: string;
  contentHash: string | null;
  thumbnailUrl: string | null;
  isFavorite: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function toApiFile(row: typeof files.$inferSelect): ApiFile {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    uploadedBy: row.uploadedBy,
    folderId: row.folderId,
    storageKey: row.storageKey,
    name: row.name,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    category: row.category as FileCategory,
    source: row.source,
    extension: row.extension,
    contentHash: row.contentHash,
    thumbnailUrl: row.thumbnailUrl,
    isFavorite: row.isFavorite,
    isTrashed: row.isTrashed,
    trashedAt: row.trashedAt?.toISOString() ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

// ─── Listing / search ──────────────────────────────────────────────

export interface ListFilesOptions {
  category?: FileCategory;
  // Folder filter: a UUID picks a specific folder; the literal string `"root"`
  // selects files with no folder (i.e. folderId is null); undefined returns
  // every folder.
  folderId?: string | "root";
  // When true, returns only trashed files (the trash view). When false (default),
  // returns only non-trashed files. The trash view is opt-in so listing the
  // active inbox doesn't accidentally surface deleted rows.
  trashed?: boolean;
  favoritesOnly?: boolean;
  search?: string;
  limit?: number;
}

export async function listFiles(
  workspaceId: string,
  actorUserId: string,
  opts: ListFilesOptions = {},
): Promise<ApiFile[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const conditions = [eq(files.workspaceId, workspaceId)];
  conditions.push(eq(files.isTrashed, opts.trashed ?? false));
  if (opts.category) conditions.push(eq(files.category, opts.category));
  if (opts.folderId === "root") conditions.push(isNull(files.folderId));
  else if (opts.folderId) conditions.push(eq(files.folderId, opts.folderId));
  if (opts.favoritesOnly) conditions.push(eq(files.isFavorite, true));
  if (opts.search) {
    const pattern = `%${opts.search.trim()}%`;
    conditions.push(
      sql`(${ilike(files.name, pattern)} or ${ilike(files.originalName, pattern)})`,
    );
  }

  const rows = await db
    .select()
    .from(files)
    .where(and(...conditions))
    .orderBy(desc(files.createdAt))
    .limit(Math.max(1, Math.min(opts.limit ?? 500, 1000)));
  return rows.map(toApiFile);
}

export async function getFile(
  workspaceId: string,
  actorUserId: string,
  fileId: string,
): Promise<ApiFile> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new ServiceError(404, "file_not_found");
  return toApiFile(row);
}

// ─── Upload flow ──────────────────────────────────────────────────

export interface PrepareUploadInput {
  name: string;
  mimeType: string;
  category?: FileCategory;
}

export interface PrepareUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

export async function prepareUpload(
  workspaceId: string,
  actorUserId: string,
  input: PrepareUploadInput,
): Promise<PrepareUploadResult> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (!isStorageConfigured()) throw new ServiceError(503, "storage_not_configured");

  const category = input.category ?? "file";
  const storageKey = buildStorageKey({ workspaceId, category, filename: input.name });
  const uploadUrl = await getUploadUrl({ storageKey, contentType: input.mimeType });
  const expiresAt = new Date(Date.now() + env.AWS_S3_PRESIGN_TTL_SECONDS * 1000).toISOString();
  return { uploadUrl, storageKey, expiresAt };
}

export interface ConfirmUploadInput {
  storageKey: string;
  name: string;
  originalName?: string;
  mimeType: string;
  sizeBytes: number;
  category?: FileCategory;
  contentHash?: string | null;
  folderId?: string | null;
  source?: string;
  // When true and a duplicate by `(workspaceId, contentHash)` exists, the
  // service inserts the row anyway. False (default) returns the existing
  // file with `duplicate=true` so the SPA can prompt the user.
  forceUpload?: boolean;
}

export interface ConfirmUploadResult {
  file: ApiFile;
  duplicate: boolean;
  existing?: ApiFile;
}

export async function confirmUpload(
  workspaceId: string,
  actorUserId: string,
  input: ConfirmUploadInput,
): Promise<ConfirmUploadResult> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (!isStorageConfigured()) throw new ServiceError(503, "storage_not_configured");

  const expectedPrefix = `workspaces/${workspaceId}/`;
  if (!input.storageKey.startsWith(expectedPrefix)) {
    throw new ServiceError(400, "storage_key_mismatch");
  }

  const head = await headObject(input.storageKey);
  if (!head.exists) throw new ServiceError(409, "object_not_uploaded");

  const db = dbOrThrow();

  // Dedup by (workspaceId, contentHash). The legacy edge fn does the same
  // check; the SPA computes SHA-256 client-side via a worker. If the SPA
  // didn't supply a hash we just skip dedup and insert.
  if (input.contentHash && !input.forceUpload) {
    const [existing] = await db
      .select()
      .from(files)
      .where(
        and(
          eq(files.workspaceId, workspaceId),
          eq(files.contentHash, input.contentHash),
          eq(files.isTrashed, false),
        ),
      )
      .limit(1);
    if (existing) {
      // Best-effort: clean up the just-uploaded duplicate object so we
      // don't accumulate orphans in S3 when users always pick "skip".
      try {
        await deleteObject(input.storageKey);
      } catch {
        /* harmless; caller can re-call with forceUpload=true if they change their mind */
      }
      return { file: toApiFile(existing), duplicate: true, existing: toApiFile(existing) };
    }
  }

  if (input.folderId) {
    // Defend against folders from a different workspace — the FK only
    // enforces existence, not workspace scope.
    const { fileFolders } = await import("@desh/database/schema");
    const [folder] = await db
      .select({ id: fileFolders.id })
      .from(fileFolders)
      .where(
        and(
          eq(fileFolders.id, input.folderId),
          eq(fileFolders.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!folder) throw new ServiceError(404, "folder_not_found");
  }

  const extension = input.name.includes(".")
    ? input.name.split(".").pop()!.toLowerCase().slice(0, 20)
    : "";

  const [row] = await db
    .insert(files)
    .values({
      workspaceId,
      uploadedBy: actorUserId,
      folderId: input.folderId ?? null,
      storageKey: input.storageKey,
      name: input.name,
      originalName: input.originalName ?? input.name,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      category: input.category ?? "file",
      source: input.source ?? "upload",
      extension,
      contentHash: input.contentHash ?? null,
    })
    .returning();
  if (!row) throw new ServiceError(500, "insert_failed");
  return { file: toApiFile(row), duplicate: false };
}

// ─── Mutations ────────────────────────────────────────────────────

export interface PatchFileInput {
  name?: string;
  folderId?: string | null;
  isFavorite?: boolean;
}

export async function patchFile(
  workspaceId: string,
  actorUserId: string,
  fileId: string,
  input: PatchFileInput,
): Promise<ApiFile> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  if (input.folderId) {
    const { fileFolders } = await import("@desh/database/schema");
    const [folder] = await db
      .select({ id: fileFolders.id })
      .from(fileFolders)
      .where(
        and(
          eq(fileFolders.id, input.folderId),
          eq(fileFolders.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!folder) throw new ServiceError(404, "folder_not_found");
  }

  const set: Partial<typeof files.$inferInsert> = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.folderId !== undefined) set.folderId = input.folderId;
  if (input.isFavorite !== undefined) set.isFavorite = input.isFavorite;
  set.updatedAt = new Date();

  const [row] = await db
    .update(files)
    .set(set)
    .where(and(eq(files.id, fileId), eq(files.workspaceId, workspaceId)))
    .returning();
  if (!row) throw new ServiceError(404, "file_not_found");
  return toApiFile(row);
}

// Soft-delete a batch of files. Idempotent: trashing an already-trashed file
// just refreshes `trashedAt`. Returns the count of rows actually flipped.
export async function trashFiles(
  workspaceId: string,
  actorUserId: string,
  fileIds: string[],
): Promise<{ trashed: number }> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (fileIds.length === 0) return { trashed: 0 };
  const db = dbOrThrow();
  const result = await db
    .update(files)
    .set({ isTrashed: true, trashedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(files.workspaceId, workspaceId), inArray(files.id, fileIds)))
    .returning({ id: files.id });
  return { trashed: result.length };
}

export async function restoreFiles(
  workspaceId: string,
  actorUserId: string,
  fileIds: string[],
): Promise<{ restored: number }> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (fileIds.length === 0) return { restored: 0 };
  const db = dbOrThrow();
  const result = await db
    .update(files)
    .set({ isTrashed: false, trashedAt: null, updatedAt: new Date() })
    .where(and(eq(files.workspaceId, workspaceId), inArray(files.id, fileIds)))
    .returning({ id: files.id });
  return { restored: result.length };
}

// Delete a single file: removes the row + best-effort S3 object. Used by
// /files/:id DELETE (immediate) and by the permanent-delete batch helper.
export async function deleteFile(
  workspaceId: string,
  actorUserId: string,
  fileId: string,
): Promise<void> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new ServiceError(404, "file_not_found");

  if (isStorageConfigured()) {
    try {
      await deleteObject(row.storageKey);
    } catch (err) {
      // Leave the row so an operator can retry rather than silently lose
      // track of the object.
      throw new ServiceError(502, "storage_delete_failed");
    }
  }
  await db.delete(files).where(eq(files.id, row.id));
}

export async function permanentDeleteFiles(
  workspaceId: string,
  actorUserId: string,
  fileIds: string[],
): Promise<{ deleted: number }> {
  if (fileIds.length === 0) return { deleted: 0 };
  let count = 0;
  for (const id of fileIds) {
    try {
      await deleteFile(workspaceId, actorUserId, id);
      count++;
    } catch {
      // Skip files we couldn't delete (S3 or 404); the SPA can retry.
    }
  }
  return { deleted: count };
}

export async function emptyTrash(
  workspaceId: string,
  actorUserId: string,
): Promise<{ deleted: number }> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const trashed = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.workspaceId, workspaceId), eq(files.isTrashed, true)));
  return permanentDeleteFiles(
    workspaceId,
    actorUserId,
    trashed.map((r) => r.id),
  );
}

// ─── Signed URLs ──────────────────────────────────────────────────

export async function getFileDownloadUrl(
  workspaceId: string,
  actorUserId: string,
  fileId: string,
): Promise<{ url: string; expiresAt: string; name: string; mimeType: string }> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  if (!isStorageConfigured()) throw new ServiceError(503, "storage_not_configured");
  const db = dbOrThrow();
  const [row] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, fileId), eq(files.workspaceId, workspaceId)))
    .limit(1);
  if (!row) throw new ServiceError(404, "file_not_found");
  const url = await getDownloadUrl({ storageKey: row.storageKey });
  const expiresAt = new Date(Date.now() + env.AWS_S3_PRESIGN_TTL_SECONDS * 1000).toISOString();
  return { url, expiresAt, name: row.name, mimeType: row.mimeType };
}

// ─── Stats ────────────────────────────────────────────────────────

export interface StorageStats {
  totalCount: number;
  totalBytes: number;
  trashedCount: number;
  trashedBytes: number;
  byCategory: Record<string, { count: number; bytes: number }>;
}

export async function getStorageStats(
  workspaceId: string,
  actorUserId: string,
): Promise<StorageStats> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  // Two narrow aggregates instead of one fat groupBy — cheaper to read and
  // keeps the response shape stable when we extend it in Wave B.
  const totals = await db
    .select({ cnt: count(files.id), bytes: sum(files.sizeBytes) })
    .from(files)
    .where(and(eq(files.workspaceId, workspaceId), eq(files.isTrashed, false)));
  const trash = await db
    .select({ cnt: count(files.id), bytes: sum(files.sizeBytes) })
    .from(files)
    .where(and(eq(files.workspaceId, workspaceId), eq(files.isTrashed, true)));
  const byCat = await db
    .select({ category: files.category, cnt: count(files.id), bytes: sum(files.sizeBytes) })
    .from(files)
    .where(and(eq(files.workspaceId, workspaceId), eq(files.isTrashed, false)))
    .groupBy(files.category);

  return {
    totalCount: Number(totals[0]?.cnt ?? 0),
    totalBytes: Number(totals[0]?.bytes ?? 0),
    trashedCount: Number(trash[0]?.cnt ?? 0),
    trashedBytes: Number(trash[0]?.bytes ?? 0),
    byCategory: Object.fromEntries(
      byCat.map((r) => [
        r.category,
        { count: Number(r.cnt ?? 0), bytes: Number(r.bytes ?? 0) },
      ]),
    ),
  };
}
