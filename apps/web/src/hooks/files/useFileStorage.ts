// File-storage hook on apps/api. Wraps `lib/storage.ts` for the Files page
// (NativeFileExplorer, FileUploadZone, FilePreviewDrawer, MoveToFolderDialog,
// StorageMeter). The legacy hook had 30 methods; we keep the same surface
// but stub Wave-B-deferred ops so component callers don't break:
//
//  - **AI categorize / batch analyze** → blocked on the ai-router migration;
//    methods log + return zero-results.
//  - **Inbox import flow** → separate ingestion pipeline; deferred.
//  - **File-link to other entities** + **share links** + **versioning** →
//    UI components are still rendered but the actions no-op until Wave B
//    adds the table + endpoints.
//
// Snake_case camelCase mismatch: the apps/api shape is camelCase; legacy
// callers expect snake_case `DeshFile`/`DeshFolder`. We adapt at the
// boundary so the consuming components stay unchanged.

import { useState, useCallback } from "react";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import { toast } from "@/hooks/use-toast";
import {
  createFolder as apiCreateFolder,
  deleteFile as apiDeleteFile,
  deleteFolder as apiDeleteFolder,
  emptyTrash as apiEmptyTrash,
  getDownloadUrl as apiGetDownloadUrl,
  getFileMeta as apiGetFileMeta,
  getStorageStats as apiGetStorageStats,
  listFiles as apiListFiles,
  listFolders as apiListFolders,
  patchFile as apiPatchFile,
  patchFolder as apiPatchFolder,
  permanentDeleteFiles as apiPermanentDeleteFiles,
  restoreFiles as apiRestoreFiles,
  trashFiles as apiTrashFiles,
  uploadFile as apiUploadFile,
  type FileRow,
  type FolderRow,
} from "@/lib/storage";

// ── Public types preserved for components ──────────────────────────

export interface DeshFile {
  id: string;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  folder_id: string | null;
  workspace_id: string | null;
  source: string;
  content_hash: string | null;
  thumbnail_url: string | null;
  ocr_text: string | null;
  ocr_status: string;
  ai_category: string | null;
  ai_summary: string | null;
  ai_tags: string[];
  ai_suggested_links: AISuggestedLink[] | null;
  ai_processing_status: string;
  is_favorite: boolean;
  is_trashed: boolean;
  trashed_at: string | null;
  parent_file_id: string | null;
  version: number;
  extension: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AISuggestedLink {
  entity_type: string;
  search_term?: string;
  reason: string;
  entity_id?: string | null;
  resolved?: boolean;
}

export interface DeshFolder {
  id: string;
  name: string;
  parent_id: string | null;
  workspace_id: string | null;
  color: string;
  icon: string;
  is_smart: boolean;
  smart_rules: unknown;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: "preparing" | "hashing" | "uploading" | "confirming" | "done" | "error" | "duplicate" | "validating";
  error?: string;
}

// ── Adapters ───────────────────────────────────────────────────────

function fromApiFile(row: FileRow): DeshFile {
  return {
    id: row.id,
    name: row.name,
    original_name: row.originalName,
    mime_type: row.mimeType,
    size_bytes: row.sizeBytes,
    storage_path: row.storageKey,
    folder_id: row.folderId,
    workspace_id: row.workspaceId,
    source: row.source,
    content_hash: row.contentHash,
    thumbnail_url: row.thumbnailUrl,
    // Wave-B-deferred AI/OCR fields default to null/empty so the UI doesn't
    // crash; the AI feature wave repopulates them when it ships.
    ocr_text: null,
    ocr_status: "pending",
    ai_category: null,
    ai_summary: null,
    ai_tags: [],
    ai_suggested_links: null,
    ai_processing_status: "pending",
    is_favorite: row.isFavorite,
    is_trashed: row.isTrashed,
    trashed_at: row.trashedAt,
    parent_file_id: null,
    version: 1,
    extension: row.extension || null,
    metadata: row.metadata ?? {},
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function fromApiFolder(row: FolderRow): DeshFolder {
  return {
    id: row.id,
    name: row.name,
    parent_id: row.parentId,
    workspace_id: row.workspaceId,
    color: row.color,
    icon: row.icon,
    is_smart: false,
    smart_rules: null,
    sort_order: row.sortOrder,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

// ── Validation helpers (preserved from legacy hook) ────────────────

const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "msi", "scr", "pif", "vbs", "vbe",
  "js", "jse", "wsf", "wsh", "ps1", "ps2", "psc1", "psc2",
  "reg", "inf", "cpl", "hta", "lnk", "dll", "sys",
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Arquivo muito grande (${(file.size / 1048576).toFixed(1)}MB). Limite: 100MB.` };
  }
  if (file.size === 0) return { valid: false, error: "Arquivo vazio." };
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Tipo de arquivo não permitido (.${ext}).` };
  }
  if (file.name.length > 255) {
    return { valid: false, error: "Nome do arquivo muito longo (máx. 255 caracteres)." };
  }
  return { valid: true };
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

// SHA-256 in a worker for big files; main-thread for small. Same as legacy.
async function computeHash(file: File): Promise<string | undefined> {
  try {
    if (file.size > 10 * 1024 * 1024) {
      return new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL("../../workers/hashWorker.ts", import.meta.url),
          { type: "module" },
        );
        const timeout = setTimeout(() => {
          worker.terminate();
          resolve(undefined);
        }, 30_000);
        worker.onmessage = (e) => {
          clearTimeout(timeout);
          worker.terminate();
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.hash);
        };
        worker.onerror = (e) => {
          clearTimeout(timeout);
          worker.terminate();
          reject(e);
        };
        worker.postMessage(file);
      });
    }
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

// ── Hook ───────────────────────────────────────────────────────────

export function useFileStorage() {
  const { activeWorkspaceId } = useWorkspaceFilter();
  const [files, setFiles] = useState<DeshFile[]>([]);
  const [folders, setFolders] = useState<DeshFolder[]>([]);
  const [allFolders, setAllFolders] = useState<DeshFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});

  const listFiles = useCallback(
    async (opts: { folderId?: string; trashed?: boolean; favorites?: boolean; search?: string } = {}) => {
      if (!activeWorkspaceId) return { files: [], folders: [], allFolders: [] };
      setLoading(true);
      try {
        // The legacy edge fn returned files + folders + allFolders in one call;
        // apps/api splits them. Fan out concurrently.
        const [fileRows, folderRowsAll] = await Promise.all([
          apiListFiles(activeWorkspaceId, {
            folderId: opts.folderId ?? "root",
            trashed: opts.trashed,
            favorites: opts.favorites,
            search: opts.search,
          }),
          apiListFolders(activeWorkspaceId),
        ]);
        const allFolderRows = folderRowsAll.map(fromApiFolder);
        const childFolders = allFolderRows.filter(
          (f) => (f.parent_id ?? null) === (opts.folderId ?? null),
        );
        const fileList = fileRows.map(fromApiFile);
        setFiles(fileList);
        setFolders(childFolders);
        setAllFolders(allFolderRows);
        return { files: fileList, folders: childFolders, allFolders: allFolderRows };
      } catch (err) {
        console.error("[useFileStorage] list failed:", err);
        return { files: [], folders: [], allFolders: [] };
      } finally {
        setLoading(false);
      }
    },
    [activeWorkspaceId],
  );

  const uploadFile = useCallback(
    async (file: File, folderId?: string): Promise<DeshFile | null> => {
      if (!activeWorkspaceId) return null;
      const uploadId = crypto.randomUUID();

      setUploads((prev) => ({
        ...prev,
        [uploadId]: { fileName: file.name, progress: 0, status: "validating" },
      }));
      const validation = validateFile(file);
      if (!validation.valid) {
        setUploads((prev) => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], status: "error", error: validation.error },
        }));
        toast({ title: "Arquivo rejeitado", description: validation.error, variant: "destructive" });
        setTimeout(() => setUploads((prev) => { const n = { ...prev }; delete n[uploadId]; return n; }), 4000);
        return null;
      }

      const safeName = sanitizeFileName(file.name);
      try {
        setUploads((prev) => ({
          ...prev,
          [uploadId]: { fileName: safeName, progress: 5, status: "hashing" },
        }));
        const contentHash = await computeHash(file);

        setUploads((prev) => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 15, status: "uploading" },
        }));

        // Single round-trip: upload-url → S3 PUT → confirm. The wrapper
        // handles all three; we just track progress.
        let result = await apiUploadFile(activeWorkspaceId, file, {
          contentHash,
          folderId: folderId ?? null,
          source: "upload",
        });

        if (result.duplicate) {
          setUploads((prev) => ({
            ...prev,
            [uploadId]: { ...prev[uploadId], progress: 90, status: "duplicate" },
          }));
          const shouldContinue = window.confirm(
            `O arquivo "${safeName}" já existe como "${result.existing?.name ?? "?"}". Deseja fazer upload mesmo assim?`,
          );
          if (!shouldContinue) {
            setUploads((prev) => { const n = { ...prev }; delete n[uploadId]; return n; });
            return fromApiFile(result.existing ?? result.file);
          }
          // Force-upload: re-run the full flow; the second confirm bypasses
          // the dedup short-circuit. (We re-PUT because the previous object
          // may already have been cleaned up by the dedup path.)
          result = await apiUploadFile(activeWorkspaceId, file, {
            contentHash,
            folderId: folderId ?? null,
            source: "upload",
            forceUpload: true,
          });
        }

        setUploads((prev) => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 100, status: "done" },
        }));
        setTimeout(() => setUploads((prev) => { const n = { ...prev }; delete n[uploadId]; return n; }), 2000);
        return fromApiFile(result.file);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setUploads((prev) => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], status: "error", error: message },
        }));
        toast({ title: "Erro no upload", description: message, variant: "destructive" });
        setTimeout(() => setUploads((prev) => { const n = { ...prev }; delete n[uploadId]; return n; }), 4000);
        return null;
      }
    },
    [activeWorkspaceId],
  );

  const uploadFiles = useCallback(
    async (fileList: File[], folderId?: string): Promise<DeshFile[]> => {
      const results: DeshFile[] = [];
      const queue = [...fileList];
      const concurrency = 3;
      const worker = async () => {
        while (queue.length > 0) {
          const file = queue.shift();
          if (!file) break;
          const result = await uploadFile(file, folderId);
          if (result) results.push(result);
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
      return results;
    },
    [uploadFile],
  );

  const createFolder = useCallback(
    async (name: string, parentId?: string) => {
      if (!activeWorkspaceId) return null;
      const created = await apiCreateFolder(activeWorkspaceId, {
        name: sanitizeFileName(name),
        parentId: parentId ?? null,
      });
      return fromApiFolder(created);
    },
    [activeWorkspaceId],
  );

  const renameFile = useCallback(
    async (fileId: string, newName: string) => {
      if (!activeWorkspaceId) return null;
      const row = await apiPatchFile(activeWorkspaceId, fileId, { name: sanitizeFileName(newName) });
      return fromApiFile(row);
    },
    [activeWorkspaceId],
  );

  const renameFolder = useCallback(
    async (folderId: string, newName: string) => {
      if (!activeWorkspaceId) return null;
      const row = await apiPatchFolder(activeWorkspaceId, folderId, {
        name: sanitizeFileName(newName),
      });
      return fromApiFolder(row);
    },
    [activeWorkspaceId],
  );

  const moveFiles = useCallback(
    async (fileIds: string[], folderId: string | null) => {
      if (!activeWorkspaceId) return;
      // No bulk move endpoint; iterate. Fine for small batches; we can add a
      // /files/move route in Wave B if a UX flow needs it.
      await Promise.all(
        fileIds.map((id) =>
          apiPatchFile(activeWorkspaceId, id, { folderId }).catch((err) => {
            console.warn(`[useFileStorage] move ${id} failed`, err);
          }),
        ),
      );
    },
    [activeWorkspaceId],
  );

  const trashFiles = useCallback(
    async (fileIds: string[]) => {
      if (!activeWorkspaceId) return;
      await apiTrashFiles(activeWorkspaceId, fileIds);
    },
    [activeWorkspaceId],
  );

  const restoreFiles = useCallback(
    async (fileIds: string[]) => {
      if (!activeWorkspaceId) return;
      await apiRestoreFiles(activeWorkspaceId, fileIds);
    },
    [activeWorkspaceId],
  );

  const permanentDelete = useCallback(
    async (fileIds: string[]) => {
      if (!activeWorkspaceId) return;
      await apiPermanentDeleteFiles(activeWorkspaceId, fileIds);
    },
    [activeWorkspaceId],
  );

  const emptyTrash = useCallback(async () => {
    if (!activeWorkspaceId) return;
    await apiEmptyTrash(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const deleteFolder = useCallback(
    async (folderId: string) => {
      if (!activeWorkspaceId) return;
      await apiDeleteFolder(activeWorkspaceId, folderId);
    },
    [activeWorkspaceId],
  );

  const toggleFavorite = useCallback(
    async (fileId: string, favorite: boolean) => {
      if (!activeWorkspaceId) return null;
      const row = await apiPatchFile(activeWorkspaceId, fileId, { isFavorite: favorite });
      return fromApiFile(row);
    },
    [activeWorkspaceId],
  );

  // Legacy returned `{ url, name }`; preserve that shape so the preview
  // drawer doesn't need to change.
  const getDownloadUrl = useCallback(
    async (fileId: string) => {
      if (!activeWorkspaceId) return null;
      const url = await apiGetDownloadUrl(activeWorkspaceId, fileId);
      const meta = await apiGetFileMeta(activeWorkspaceId, fileId);
      return { url, name: meta.name };
    },
    [activeWorkspaceId],
  );

  // For preview, the SPA passes (url, name, mimeType). Same source as
  // download — bucket-level "block public access" makes signed URLs the only
  // way the browser can fetch the bytes.
  const getPreviewUrl = useCallback(
    async (fileId: string) => {
      if (!activeWorkspaceId) return null;
      const meta = await apiGetFileMeta(activeWorkspaceId, fileId);
      const url = await apiGetDownloadUrl(activeWorkspaceId, fileId);
      return { url, name: meta.name, mimeType: meta.mimeType };
    },
    [activeWorkspaceId],
  );

  const getStats = useCallback(async () => {
    if (!activeWorkspaceId) return { stats: null };
    const stats = await apiGetStorageStats(activeWorkspaceId);
    return { stats };
  }, [activeWorkspaceId]);

  // ── Wave-B-deferred surface (kept callable so components don't break) ──

  // The Files inbox + cross-entity links + AI-driven categorize all share
  // the same fate: their backing tables (file_inbox / file_links) and the
  // ai-router edge fn haven't been migrated yet. Stubbed return shapes match
  // the legacy ones so callers branch on `[]`/`success: false` cleanly.

  const listInbox = useCallback(async () => ({ items: [] as unknown[] }), []);
  const importInboxItem = useCallback(
    async (_itemId: string, _folderId?: string) => null,
    [],
  );
  const ignoreInboxItem = useCallback(async (_itemId: string) => undefined, []);

  const linkFile = useCallback(
    async (_fileId: string, _entityType: string, _entityId: string) => undefined,
    [],
  );
  const dismissSuggestedLink = useCallback(
    async (_fileId: string, _linkIndex: number) => undefined,
    [],
  );

  const analyzeFile = useCallback(
    async (_fileId: string): Promise<{ success: boolean; error?: string }> => ({
      success: false,
      error: "ai_router_not_migrated",
    }),
    [],
  );
  const analyzeFiles = useCallback(
    async (fileIds: string[]) => ({ succeeded: 0, failed: fileIds.length }),
    [],
  );

  return {
    files,
    folders,
    allFolders,
    loading,
    uploads,
    listFiles,
    uploadFile,
    uploadFiles,
    createFolder,
    renameFile,
    renameFolder,
    moveFiles,
    trashFiles,
    restoreFiles,
    permanentDelete,
    emptyTrash,
    deleteFolder,
    toggleFavorite,
    getDownloadUrl,
    getPreviewUrl,
    getStats,
    listInbox,
    importInboxItem,
    ignoreInboxItem,
    linkFile,
    dismissSuggestedLink,
    analyzeFile,
    analyzeFiles,
  };
}
