import { useState, useCallback, useRef } from "react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { useComposioWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import { invalidateGoogleCache } from "@/hooks/integrations/useGoogleServiceData";
import { toast } from "@/hooks/use-toast";

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  progress: number; // 0-100
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface UseDriveUploadOptions {
  currentFolderId?: string | null;
  onComplete?: () => void;
}

export function useDriveUpload({ currentFolderId, onComplete }: UseDriveUploadOptions = {}) {
  const { invoke: rawInvoke } = useEdgeFn();
  const composioWsId = useComposioWorkspaceId();
  const invoke = useCallback(<T = any>(o: Parameters<typeof rawInvoke<T>>[0]) => {
    if (o.fn === "composio-proxy" && o.body && typeof o.body === "object") {
      return rawInvoke<T>({ ...o, body: { ...o.body, workspace_id: composioWsId } });
    }
    return rawInvoke<T>(o);
  }, [rawInvoke, composioWsId]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const updateUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  }, []);

  const uploadFile = useCallback(async (item: UploadItem) => {
    const controller = new AbortController();
    abortControllers.current.set(item.id, controller);

    try {
      updateUpload(item.id, { status: "uploading", progress: 0 });

      // Step 1: Get resumable upload URI from edge function
      const { data, error } = await invoke<{ uploadUri: string; accessToken: string }>({
        fn: "composio-proxy",
        body: {
          service: "drive",
          path: "/upload/resumable",
          method: "POST",
          body: {
            name: item.file.name,
            mimeType: item.file.type || "application/octet-stream",
            fileSize: item.file.size,
            parents: currentFolderId ? [currentFolderId] : undefined,
          },
        },
      });

      if (error || !data?.uploadUri) {
        throw new Error(error || "Falha ao iniciar upload");
      }

      // Step 2: Upload directly to Google using XHR for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            updateUpload(item.id, { progress: pct });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload falhou (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error("Erro de rede no upload"));
        xhr.onabort = () => reject(new Error("Upload cancelado"));

        // Listen for abort
        controller.signal.addEventListener("abort", () => xhr.abort());

        xhr.open("PUT", data.uploadUri);
        xhr.setRequestHeader("Content-Type", item.file.type || "application/octet-stream");
        xhr.send(item.file);
      });

      updateUpload(item.id, { status: "done", progress: 100 });
    } catch (err: any) {
      if (err?.message === "Upload cancelado") {
        updateUpload(item.id, { status: "error", error: "Cancelado" });
      } else {
        updateUpload(item.id, { status: "error", error: err?.message || "Erro desconhecido" });
      }
    } finally {
      abortControllers.current.delete(item.id);
    }
  }, [invoke, currentFolderId, updateUpload]);

  const startUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const newItems: UploadItem[] = fileArray.map((file, i) => ({
      id: `upload_${Date.now()}_${i}`,
      file,
      name: file.name,
      progress: 0,
      status: "pending" as const,
    }));

    setUploads(prev => [...prev, ...newItems]);
    setIsUploading(true);

    // Upload sequentially (to avoid overwhelming the API) with 2 concurrent max
    const CONCURRENT = 2;
    const queue = [...newItems];
    const active: Promise<void>[] = [];

    const processNext = async (): Promise<void> => {
      const item = queue.shift();
      if (!item) return;
      await uploadFile(item);
      await processNext();
    };

    for (let i = 0; i < Math.min(CONCURRENT, queue.length); i++) {
      active.push(processNext());
    }

    await Promise.all(active);

    // Invalidate cache and notify
    invalidateGoogleCache("drive");
    onComplete?.();

    const completed = newItems.length;
    toast({
      title: `Upload concluído`,
      description: `${completed} arquivo${completed !== 1 ? "s" : ""} enviado${completed !== 1 ? "s" : ""} ao Google Drive`,
    });

    setIsUploading(false);

    // Auto-clear completed uploads after 5s
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.status !== "done"));
    }, 5000);
  }, [uploadFile, onComplete]);

  const cancelUpload = useCallback((id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) controller.abort();
    setUploads(prev => prev.filter(u => u.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status !== "done" && u.status !== "error"));
  }, []);

  const totalProgress = uploads.length > 0
    ? Math.round(uploads.reduce((sum, u) => sum + u.progress, 0) / uploads.length)
    : 0;

  return {
    uploads,
    isUploading,
    startUpload,
    cancelUpload,
    clearCompleted,
    totalProgress,
  };
}
