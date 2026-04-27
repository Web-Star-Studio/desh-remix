import { apiFetch, ApiError } from "@/lib/api-client";

/**
 * Thin transport over `/workspaces/:id/files/...` and `/workspaces/:id/file-folders/...`.
 * Shape mirrors `composio-client` — typed errors, no React-specific assumptions,
 * hooks call into it.
 *
 * Upload flow: requestUploadUrl → SPA PUTs the bytes directly to S3 →
 * confirmUpload writes the row. Bytes never traverse `apps/api`.
 */

export type FileCategory = "file" | "note-image" | "profile-doc";

export type StorageErrorCode =
  | "not_configured"
  | "unauthorized"
  | "not_found"
  | "object_not_uploaded"
  | "storage_key_mismatch"
  | "upload_failed"
  | "delete_failed"
  | "folder_not_found"
  | "unknown";

export class StorageError extends Error {
  constructor(public code: StorageErrorCode, message: string, public cause?: unknown) {
    super(message);
  }
}

export interface FileRow {
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

export interface FolderRow {
  id: string;
  workspaceId: string;
  createdBy: string | null;
  name: string;
  parentId: string | null;
  color: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorageStats {
  totalCount: number;
  totalBytes: number;
  trashedCount: number;
  trashedBytes: number;
  byCategory: Record<string, { count: number; bytes: number }>;
}

interface UploadUrlResponse {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

interface ConfirmResponse {
  file: FileRow;
  duplicate: boolean;
  existing?: FileRow;
}

interface DownloadUrlResponse {
  url: string;
  expiresAt: string;
  name: string;
  mimeType: string;
}

function decodeApiError(err: unknown): StorageError {
  if (err instanceof ApiError) {
    if (err.status === 401) return new StorageError("unauthorized", "Sessão inválida.", err);
    if (err.status === 404) {
      const code =
        (err.body as { error?: string } | null)?.error === "folder_not_found"
          ? "folder_not_found"
          : "not_found";
      return new StorageError(code, "Recurso não encontrado.", err);
    }
    if (err.status === 503) return new StorageError("not_configured", "Storage não configurado.", err);
    if (err.status === 409) {
      const code =
        (err.body as { error?: string } | null)?.error === "object_not_uploaded"
          ? "object_not_uploaded"
          : "unknown";
      return new StorageError(code, "Conflito ao confirmar upload.", err);
    }
    if (err.status === 400) {
      const code =
        (err.body as { error?: string } | null)?.error === "storage_key_mismatch"
          ? "storage_key_mismatch"
          : "unknown";
      return new StorageError(code, "Requisição inválida.", err);
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  return new StorageError("unknown", message, err);
}

// ─── Files ────────────────────────────────────────────────────────

export interface ListFilesOptions {
  category?: FileCategory;
  folderId?: string | "root";
  trashed?: boolean;
  favorites?: boolean;
  search?: string;
  limit?: number;
}

export async function listFiles(
  workspaceId: string,
  opts: ListFilesOptions = {},
): Promise<FileRow[]> {
  const qs = new URLSearchParams();
  if (opts.category) qs.set("category", opts.category);
  if (opts.folderId) qs.set("folderId", opts.folderId);
  if (opts.trashed) qs.set("trashed", "true");
  if (opts.favorites) qs.set("favorites", "true");
  if (opts.search) qs.set("search", opts.search);
  if (opts.limit) qs.set("limit", String(opts.limit));
  const tail = qs.toString() ? `?${qs}` : "";
  try {
    return await apiFetch<FileRow[]>(`/workspaces/${workspaceId}/files${tail}`);
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function getFileMeta(workspaceId: string, fileId: string): Promise<FileRow> {
  try {
    return await apiFetch<FileRow>(`/workspaces/${workspaceId}/files/${fileId}`);
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function getDownloadUrl(workspaceId: string, fileId: string): Promise<string> {
  try {
    const res = await apiFetch<DownloadUrlResponse>(
      `/workspaces/${workspaceId}/files/${fileId}/download-url`,
    );
    return res.url;
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function patchFile(
  workspaceId: string,
  fileId: string,
  patch: { name?: string; folderId?: string | null; isFavorite?: boolean },
): Promise<FileRow> {
  try {
    return await apiFetch<FileRow>(`/workspaces/${workspaceId}/files/${fileId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function trashFiles(workspaceId: string, fileIds: string[]): Promise<{ trashed: number }> {
  try {
    return await apiFetch<{ trashed: number }>(`/workspaces/${workspaceId}/files/trash`, {
      method: "POST",
      body: JSON.stringify({ fileIds }),
    });
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function restoreFiles(workspaceId: string, fileIds: string[]): Promise<{ restored: number }> {
  try {
    return await apiFetch<{ restored: number }>(`/workspaces/${workspaceId}/files/restore`, {
      method: "POST",
      body: JSON.stringify({ fileIds }),
    });
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function permanentDeleteFiles(workspaceId: string, fileIds: string[]): Promise<{ deleted: number }> {
  try {
    return await apiFetch<{ deleted: number }>(`/workspaces/${workspaceId}/files/permanent-delete`, {
      method: "POST",
      body: JSON.stringify({ fileIds }),
    });
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function emptyTrash(workspaceId: string): Promise<{ deleted: number }> {
  try {
    return await apiFetch<{ deleted: number }>(`/workspaces/${workspaceId}/files/trash/empty`, {
      method: "POST",
    });
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function deleteFile(workspaceId: string, fileId: string): Promise<void> {
  try {
    await apiFetch<void>(`/workspaces/${workspaceId}/files/${fileId}`, { method: "DELETE" });
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function getStorageStats(workspaceId: string): Promise<StorageStats> {
  try {
    return await apiFetch<StorageStats>(`/workspaces/${workspaceId}/files/stats`);
  } catch (err) {
    throw decodeApiError(err);
  }
}

// ─── Upload ───────────────────────────────────────────────────────

export interface UploadFileOptions {
  category?: FileCategory;
  folderId?: string | null;
  contentHash?: string;
  // When true, bypass the dedup-by-hash short-circuit and create a duplicate
  // row anyway. The SPA prompts the user before retrying with this flag.
  forceUpload?: boolean;
  source?: string;
}

export interface UploadResult {
  file: FileRow;
  duplicate: boolean;
  existing?: FileRow;
}

// End-to-end upload: API → S3 PUT → API confirm. Returns the persisted row
// (or the existing duplicate row if dedup matched).
export async function uploadFile(
  workspaceId: string,
  file: File,
  opts: UploadFileOptions = {},
): Promise<UploadResult> {
  const category = opts.category ?? "file";

  let urlRes: UploadUrlResponse;
  try {
    urlRes = await apiFetch<UploadUrlResponse>(`/workspaces/${workspaceId}/files/upload-url`, {
      method: "POST",
      body: JSON.stringify({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        category,
      }),
    });
  } catch (err) {
    throw decodeApiError(err);
  }

  const putRes = await fetch(urlRes.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) {
    throw new StorageError(
      "upload_failed",
      `S3 PUT falhou (${putRes.status} ${putRes.statusText})`,
    );
  }

  try {
    return await apiFetch<ConfirmResponse>(`/workspaces/${workspaceId}/files/confirm`, {
      method: "POST",
      body: JSON.stringify({
        storageKey: urlRes.storageKey,
        name: file.name,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        category,
        contentHash: opts.contentHash ?? null,
        folderId: opts.folderId ?? null,
        source: opts.source,
        forceUpload: opts.forceUpload,
      }),
    });
  } catch (err) {
    throw decodeApiError(err);
  }
}

// ─── Folders ──────────────────────────────────────────────────────

export async function listFolders(workspaceId: string): Promise<FolderRow[]> {
  try {
    return await apiFetch<FolderRow[]>(`/workspaces/${workspaceId}/file-folders`);
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function createFolder(
  workspaceId: string,
  input: { name: string; parentId?: string | null; color?: string; icon?: string; sortOrder?: number },
): Promise<FolderRow> {
  try {
    return await apiFetch<FolderRow>(`/workspaces/${workspaceId}/file-folders`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function patchFolder(
  workspaceId: string,
  folderId: string,
  patch: { name?: string; parentId?: string | null; color?: string; icon?: string; sortOrder?: number },
): Promise<FolderRow> {
  try {
    return await apiFetch<FolderRow>(`/workspaces/${workspaceId}/file-folders/${folderId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  } catch (err) {
    throw decodeApiError(err);
  }
}

export async function deleteFolder(workspaceId: string, folderId: string): Promise<void> {
  try {
    await apiFetch<void>(`/workspaces/${workspaceId}/file-folders/${folderId}`, { method: "DELETE" });
  } catch (err) {
    throw decodeApiError(err);
  }
}
