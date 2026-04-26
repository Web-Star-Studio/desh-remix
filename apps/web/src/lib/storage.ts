import { apiFetch, ApiError } from "@/lib/api-client";

/**
 * Thin transport over `/workspaces/:id/files/...`. Mirrors composio-client's
 * shape — typed errors, no React-specific assumptions, hooks call into it.
 *
 * Upload flow: getUploadUrl → SPA PUTs the bytes directly to S3 →
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
  storageKey: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategory;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UploadUrlResponse {
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
}

interface DownloadUrlResponse {
  url: string;
  expiresAt: string;
}

function decodeApiError(err: unknown): StorageError {
  if (err instanceof ApiError) {
    if (err.status === 401) return new StorageError("unauthorized", "Sessão inválida.", err);
    if (err.status === 404) return new StorageError("not_found", "Arquivo não encontrado.", err);
    if (err.status === 503) return new StorageError("not_configured", "Storage não configurado.", err);
    if (err.status === 409) {
      const code = (err.body as { error?: string } | null)?.error === "object_not_uploaded"
        ? "object_not_uploaded"
        : "unknown";
      return new StorageError(code, "Conflito ao confirmar upload.", err);
    }
    if (err.status === 400) {
      const code = (err.body as { error?: string } | null)?.error === "storage_key_mismatch"
        ? "storage_key_mismatch"
        : "unknown";
      return new StorageError(code, "Requisição inválida.", err);
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  return new StorageError("unknown", message, err);
}

export async function listFiles(
  workspaceId: string,
  category?: FileCategory,
): Promise<FileRow[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  try {
    return await apiFetch<FileRow[]>(`/workspaces/${workspaceId}/files${qs}`);
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

export async function deleteFile(workspaceId: string, fileId: string): Promise<void> {
  try {
    await apiFetch<void>(`/workspaces/${workspaceId}/files/${fileId}`, { method: "DELETE" });
  } catch (err) {
    throw decodeApiError(err);
  }
}

export interface UploadFileOptions {
  category?: FileCategory;
  // Optional content hash for dedup; not enforced server-side yet.
  contentHash?: string;
}

// End-to-end upload: API → S3 PUT → API confirm. Returns the persisted row.
// Callers get a stable `id` they can store as a foreign reference (in note
// HTML, profile-document rows, etc.) without baking in a URL.
export async function uploadFile(
  workspaceId: string,
  file: File,
  opts: UploadFileOptions = {},
): Promise<FileRow> {
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

  // PUT the bytes to S3. Critical: we send Content-Type matching what the
  // presign was generated with — S3 rejects mismatches with 403.
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
    return await apiFetch<FileRow>(`/workspaces/${workspaceId}/files/confirm`, {
      method: "POST",
      body: JSON.stringify({
        storageKey: urlRes.storageKey,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        category,
        contentHash: opts.contentHash ?? null,
      }),
    });
  } catch (err) {
    throw decodeApiError(err);
  }
}
