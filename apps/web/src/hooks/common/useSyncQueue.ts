// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "desh_sync_queue";

// Types — canonical definitions live in /src/types/common.ts
export type { QueuedOperation } from "@/types/common";
import type { QueuedOperation } from "@/types/common";

function loadQueue(): QueuedOperation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedOperation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function useSyncQueue() {
  const isOnline = useOnlineStatus();
  const [queue, setQueue] = useState<QueuedOperation[]>(loadQueue);
  const processingRef = useRef(false);

  // Persist queue changes
  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  /** Enqueue an operation (when offline or as fallback) */
  const enqueue = useCallback((op: Omit<QueuedOperation, "id" | "queuedAt" | "retries">) => {
    const entry: QueuedOperation = {
      ...op,
      id: crypto.randomUUID(),
      queuedAt: new Date().toISOString(),
      retries: 0,
    };
    setQueue(prev => {
      const next = [...prev, entry];
      saveQueue(next);
      return next;
    });
    toast({
      title: "Operação salva offline",
      description: `"${op.label}" será sincronizada quando reconectar.`,
    });
    return entry.id;
  }, []);

  /** Remove a single operation from the queue */
  const dequeue = useCallback((id: string) => {
    setQueue(prev => {
      const next = prev.filter(op => op.id !== id);
      saveQueue(next);
      return next;
    });
  }, []);

  /** Process the entire queue sequentially */
  const flush = useCallback(async () => {
    if (processingRef.current) return;
    const current = loadQueue();
    if (current.length === 0) return;

    processingRef.current = true;
    const failed: QueuedOperation[] = [];
    let successCount = 0;

    for (const op of current) {
      try {
        const { error } = await supabase.functions.invoke(op.fn, { body: op.body });
        if (error) throw error;
        successCount++;
      } catch (err) {
        const updated = { ...op, retries: op.retries + 1 };
        if (updated.retries < 5) {
          failed.push(updated);
        }
        // Drop after 5 retries
      }
    }

    setQueue(failed);
    saveQueue(failed);
    processingRef.current = false;

    if (successCount > 0) {
      toast({
        title: "Sincronização concluída",
        description: `${successCount} operação(ões) sincronizada(s).`,
      });
    }
    if (failed.length > 0) {
      toast({
        title: "Operações pendentes",
        description: `${failed.length} operação(ões) ainda pendente(s).`,
        variant: "destructive",
      });
    }
  }, []);

  // Auto-flush when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      flush();
    }
  }, [isOnline]);

  /** Try to invoke an edge function; if offline, queue it automatically */
  const invokeOrQueue = useCallback(
    async <T = unknown>(opts: { fn: string; body?: any; label: string }): Promise<{ data: T | null; error: string | null; queued: boolean }> => {
      if (!isOnline) {
        enqueue({ fn: opts.fn, body: opts.body, label: opts.label });
        return { data: null, error: null, queued: true };
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          enqueue({ fn: opts.fn, body: opts.body, label: opts.label });
          return { data: null, error: null, queued: true };
        }

        const { data, error } = await supabase.functions.invoke(opts.fn, { body: opts.body });
        if (error) {
          const msg = typeof error === "object" && "message" in error ? (error as any).message : String(error);
          // If it's a network error, queue it
          if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network")) {
            enqueue({ fn: opts.fn, body: opts.body, label: opts.label });
            return { data: null, error: null, queued: true };
          }
          return { data: null, error: msg, queued: false };
        }
        return { data: data as T, error: null, queued: false };
      } catch {
        enqueue({ fn: opts.fn, body: opts.body, label: opts.label });
        return { data: null, error: null, queued: true };
      }
    },
    [isOnline, enqueue],
  );

  return {
    queue,
    pendingCount: queue.length,
    isOnline,
    enqueue,
    dequeue,
    flush,
    invokeOrQueue,
  };
}
