import { useState, useCallback } from "react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "@/hooks/use-toast";

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

/* ── File validation ── */

const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "msi", "scr", "pif", "vbs", "vbe",
  "js", "jse", "wsf", "wsh", "ps1", "ps2", "psc1", "psc2",
  "reg", "inf", "cpl", "hta", "lnk", "dll", "sys",
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function validateFile(file: File): { valid: boolean; error?: string } {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `Arquivo muito grande (${(file.size / 1048576).toFixed(1)}MB). Limite: 100MB.` };
  }
  if (file.size === 0) {
    return { valid: false, error: "Arquivo vazio." };
  }
  // Extension check
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Tipo de arquivo não permitido (.${ext}).` };
  }
  // Name sanitization check
  if (file.name.length > 255) {
    return { valid: false, error: "Nome do arquivo muito longo (máx. 255 caracteres)." };
  }
  return { valid: true };
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") // Remove illegal chars
    .replace(/\.{2,}/g, ".") // No double dots
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim()
    .slice(0, 255);
}

/* ── Hash computation (Worker for large files) ── */

async function computeHash(file: File): Promise<string | undefined> {
  try {
    if (file.size > 10 * 1024 * 1024) {
      return new Promise((resolve, reject) => {
        const worker = new Worker(
          new URL("../../workers/hashWorker.ts", import.meta.url),
          { type: "module" }
        );
        const timeout = setTimeout(() => {
          worker.terminate();
          resolve(undefined); // Don't block upload if hash times out
        }, 30000);
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

export function useFileStorage() {
  const { invoke } = useEdgeFn();
  const { activeWorkspaceId } = useWorkspace();
  const [files, setFiles] = useState<DeshFile[]>([]);
  const [folders, setFolders] = useState<DeshFolder[]>([]);
  const [allFolders, setAllFolders] = useState<DeshFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});

  const callStorage = useCallback(
    async <T = unknown>(action: string, params: Record<string, unknown> = {}) => {
      const { data, error } = await invoke<T>({
        fn: "files-storage",
        body: { action, ...params },
      });
      if (error) throw new Error(error);
      return data as T;
    },
    [invoke]
  );

  const listFiles = useCallback(
    async (opts: { folderId?: string; trashed?: boolean; favorites?: boolean; search?: string } = {}) => {
      setLoading(true);
      try {
        const result = await callStorage<{ files: DeshFile[]; folders: DeshFolder[]; allFolders: DeshFolder[] }>("list", {
          ...opts,
          workspaceId: activeWorkspaceId,
        });
        if (result) {
          setFiles(result.files);
          setFolders(result.folders);
          if (result.allFolders) setAllFolders(result.allFolders);
        }
        return result;
      } finally {
        setLoading(false);
      }
    },
    [callStorage, activeWorkspaceId]
  );

  /* ── Upload via proxy (fallback) ── */
  const uploadViaProxy = useCallback(
    async (file: File, storagePath: string, uploadId: string): Promise<void> => {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const fileBase64 = btoa(binary);

      setUploads((prev) => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], progress: 50, status: "uploading" },
      }));

      await callStorage("upload-proxy", {
        storagePath,
        contentType: file.type || "application/octet-stream",
        fileBase64,
      });
    },
    [callStorage]
  );

  const uploadFile = useCallback(
    async (file: File, folderId?: string): Promise<DeshFile | null> => {
      const uploadId = crypto.randomUUID();

      // 0. Validate file
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
        setTimeout(() => {
          setUploads((prev) => { const n = { ...prev }; delete n[uploadId]; return n; });
        }, 4000);
        return null;
      }

      const safeName = sanitizeFileName(file.name);

      setUploads((prev) => ({
        ...prev,
        [uploadId]: { fileName: safeName, progress: 0, status: "preparing" },
      }));

      try {
        // 1. Compute hash
        setUploads((prev) => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 5, status: "hashing" },
        }));
        const contentHash = await computeHash(file);

        // 2. Get presigned upload URL
        setUploads((prev) => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 15, status: "uploading" },
        }));

        const urlResult = await callStorage<{ url: string; storagePath: string }>("get-upload-url", {
          fileName: safeName,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          folderId,
          workspaceId: activeWorkspaceId,
        });

        if (!urlResult?.storagePath) throw new Error("Failed to get upload path");

        // 3. Try direct R2 upload
        let directUploadSucceeded = false;
        try {
          const putRes = await fetch(urlResult.url, {
            method: "PUT",
            mode: "cors",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          });
          if (!putRes.ok) {
            const errorText = await putRes.text().catch(() => "no body");
            throw new Error(`PUT failed: ${putRes.status} — ${errorText}`);
          }
          directUploadSucceeded = true;
        } catch (directErr: any) {
          console.warn("[Upload] Direct R2 upload failed:", directErr?.message);
        }

        // 4. Fallback: proxy
        if (!directUploadSucceeded) {
          const MAX_PROXY_SIZE = 4 * 1024 * 1024;
          if (file.size > MAX_PROXY_SIZE) {
            throw new Error(
              `Arquivo muito grande para upload indireto (${(file.size / 1048576).toFixed(1)}MB). Limite: 4MB.`
            );
          }
          await uploadViaProxy(file, urlResult.storagePath, uploadId);
        }

        setUploads((prev) => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 80, status: "confirming" },
        }));

        // 5. Confirm upload
        const confirmResult = await callStorage<{
          file?: DeshFile;
          duplicateFound?: boolean;
          existingFile?: any;
          storagePath?: string;
        }>("confirm-upload", {
          storagePath: urlResult.storagePath,
          fileName: safeName,
          originalName: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          folderId,
          workspaceId: activeWorkspaceId,
          contentHash,
        });

        // Handle duplicate
        if (confirmResult?.duplicateFound) {
          setUploads((prev) => ({
            ...prev,
            [uploadId]: { ...prev[uploadId], progress: 90, status: "duplicate" },
          }));

          const shouldContinue = window.confirm(
            `O arquivo "${safeName}" já existe como "${confirmResult.existingFile?.name}". Deseja fazer upload mesmo assim?`
          );

          if (!shouldContinue) {
            setUploads((prev) => { const n = { ...prev }; delete n[uploadId]; return n; });
            return null;
          }

          const forceResult = await callStorage<{ file: DeshFile }>("confirm-upload", {
            storagePath: urlResult.storagePath,
            fileName: safeName,
            originalName: file.name,
            contentType: file.type || "application/octet-stream",
            sizeBytes: file.size,
            folderId,
            workspaceId: activeWorkspaceId,
            contentHash,
            forceUpload: true,
          });

          setUploads((prev) => ({
            ...prev,
            [uploadId]: { ...prev[uploadId], progress: 100, status: "done" },
          }));
          setTimeout(() => {
            setUploads((prev) => { const n = { ...prev }; delete n[uploadId]; return n; });
          }, 2000);

          return forceResult?.file || null;
        }

        setUploads((prev) => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], progress: 100, status: "done" },
        }));
        setTimeout(() => {
          setUploads((prev) => { const n = { ...prev }; delete n[uploadId]; return n; });
        }, 2000);

        return confirmResult?.file || null;
      } catch (err: any) {
        setUploads((prev) => ({
          ...prev,
          [uploadId]: { ...prev[uploadId], status: "error", error: err.message },
        }));
        toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
        setTimeout(() => {
          setUploads((prev) => { const n = { ...prev }; delete n[uploadId]; return n; });
        }, 4000);
        return null;
      }
    },
    [callStorage, activeWorkspaceId, uploadViaProxy]
  );

  /** Upload multiple files in parallel (max 3 concurrent) */
  const uploadFiles = useCallback(
    async (fileList: File[], folderId?: string): Promise<DeshFile[]> => {
      const results: DeshFile[] = [];
      const concurrency = 3;
      const queue = [...fileList];

      const worker = async () => {
        while (queue.length > 0) {
          const file = queue.shift();
          if (!file) break;
          const result = await uploadFile(file, folderId);
          if (result) results.push(result);
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
      );

      return results;
    },
    [uploadFile]
  );

  const createFolder = useCallback(
    async (name: string, parentId?: string) => {
      const result = await callStorage<{ folder: DeshFolder }>("create-folder", {
        name: sanitizeFileName(name), parentId, workspaceId: activeWorkspaceId,
      });
      return result?.folder;
    },
    [callStorage, activeWorkspaceId]
  );

  const renameFile = useCallback(
    (fileId: string, newName: string) => callStorage("rename", { fileId, newName: sanitizeFileName(newName) }),
    [callStorage]
  );

  const renameFolder = useCallback(
    (folderId: string, newName: string) => callStorage("rename-folder", { folderId, newName: sanitizeFileName(newName) }),
    [callStorage]
  );

  const moveFiles = useCallback(
    (fileIds: string[], folderId: string | null) => callStorage("move", { fileIds, folderId }),
    [callStorage]
  );

  const trashFiles = useCallback(
    (fileIds: string[]) => callStorage("trash", { fileIds }),
    [callStorage]
  );

  const restoreFiles = useCallback(
    (fileIds: string[]) => callStorage("restore", { fileIds }),
    [callStorage]
  );

  const permanentDelete = useCallback(
    (fileIds: string[]) => callStorage("permanent-delete", { fileIds }),
    [callStorage]
  );

  const emptyTrash = useCallback(
    () => callStorage("empty-trash"),
    [callStorage]
  );

  const deleteFolder = useCallback(
    (folderId: string) => callStorage("delete-folder", { folderId }),
    [callStorage]
  );

  const toggleFavorite = useCallback(
    (fileId: string, favorite: boolean) => callStorage("toggle-favorite", { fileId, favorite }),
    [callStorage]
  );

  const getDownloadUrl = useCallback(
    async (fileId: string) => {
      return callStorage<{ url: string; name: string }>("get-download-url", { fileId });
    },
    [callStorage]
  );

  const getPreviewUrl = useCallback(
    async (fileId: string) => {
      return callStorage<{ url: string; name: string; mimeType: string }>("get-preview-url", { fileId });
    },
    [callStorage]
  );

  const getStats = useCallback(
    () => callStorage<{ stats: any }>("stats"),
    [callStorage]
  );

  /* ── Inbox actions ── */

  const listInbox = useCallback(
    () => callStorage<{ items: any[] }>("list-inbox"),
    [callStorage]
  );

  const importInboxItem = useCallback(
    (itemId: string, folderId?: string) =>
      callStorage<{ file: DeshFile }>("import-inbox-item", { itemId, folderId, workspaceId: activeWorkspaceId }),
    [callStorage, activeWorkspaceId]
  );

  const ignoreInboxItem = useCallback(
    (itemId: string) => callStorage("ignore-inbox-item", { itemId }),
    [callStorage]
  );

  const linkFile = useCallback(
    (fileId: string, entityType: string, entityId: string) =>
      callStorage("link-file", { fileId, entityType, entityId }),
    [callStorage]
  );

  const dismissSuggestedLink = useCallback(
    async (fileId: string, linkIndex: number) => {
      await callStorage("dismiss-suggested-link", { fileId, linkIndex });
    },
    [callStorage]
  );

  /** Manually trigger AI analysis for a file (costs 2 credits) */
  const analyzeFile = useCallback(
    async (fileId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const { data, error } = await invoke<any>({
          fn: "ai-router",
          body: { module: "files", action: "auto_categorize", fileId },
        });
        if (error) {
          if (error.includes("créditos") || error.includes("insufficient") || error.includes("credits")) {
            return { success: false, error: "insufficient_credits" };
          }
          throw new Error(error);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
    [invoke]
  );

  /** Batch analyze multiple files */
  const analyzeFiles = useCallback(
    async (fileIds: string[]): Promise<{ succeeded: number; failed: number }> => {
      let succeeded = 0;
      let failed = 0;
      for (const fileId of fileIds) {
        const result = await analyzeFile(fileId);
        if (result.success) succeeded++;
        else failed++;
      }
      return { succeeded, failed };
    },
    [analyzeFile]
  );

  return {
    files, folders, allFolders, loading, uploads,
    listFiles, uploadFile, uploadFiles, createFolder, renameFile, renameFolder,
    moveFiles, trashFiles, restoreFiles, permanentDelete, emptyTrash, deleteFolder,
    toggleFavorite, getDownloadUrl, getPreviewUrl, getStats,
    listInbox, importInboxItem, ignoreInboxItem,
    linkFile, dismissSuggestedLink, analyzeFile, analyzeFiles,
  };
}
