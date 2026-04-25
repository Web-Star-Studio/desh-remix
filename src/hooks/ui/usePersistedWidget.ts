// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";
import { useFlushOnExit } from "@/hooks/common/useFlushOnExit";
import { useDemo } from "@/contexts/DemoContext";

interface UsePersistedWidgetOptions<T> {
  key: string;
  defaultValue: T;
  debounceMs?: number;
}

interface UsePersistedWidgetResult<T> {
  data: T;
  save: (newData: T) => void;
  loading: boolean;
  clearCache: () => Promise<void>;
}

export function usePersistedWidget<T>({
  key,
  defaultValue,
  debounceMs = 1000,
}: UsePersistedWidgetOptions<T>): UsePersistedWidgetResult<T> {
  const { user } = useAuth();
  const { isDemoMode, isLoading: isDemoTransitioning, demoWorkspaceId } = useDemo();
  const workspaceCtx = useWorkspaceSafe();
  const activeWorkspaceId = workspaceCtx?.activeWorkspaceId ?? null;
  // True when operating inside a demo workspace (even during brief transition windows)
  const isInDemoWorkspace = isDemoMode || isDemoTransitioning || (demoWorkspaceId != null && activeWorkspaceId === demoWorkspaceId);
  const cacheKey = activeWorkspaceId ? `dashfy-${activeWorkspaceId}-${key}` : `dashfy-${key}`;
  const [data, setData] = useState<T>(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
    return defaultValue;
  });

  // Safe localStorage write — silently degrades when quota is exceeded.
  // Data still lives in React state and is synced to DB.
  const safeLocalSet = useCallback((k: string, value: string) => {
    try {
      localStorage.setItem(k, value);
    } catch (err: any) {
      const isQuota = err?.name === "QuotaExceededError" || /quota/i.test(err?.message || "");
      if (isQuota) {
        try { localStorage.removeItem(k); } catch {}
        console.warn(`[usePersistedWidget] localStorage quota exceeded for "${k}" — falling back to in-memory + DB only.`);
      } else {
        console.warn(`[usePersistedWidget] localStorage write failed for "${k}":`, err);
      }
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowIdRef = useRef<string | null>(null);
  const dbDataType = activeWorkspaceId ? `${activeWorkspaceId}:${key}` : key;

  const hasFetchedRef = useRef<string | null>(null);

  // Flush on exit — skip when in demo workspace
  const { markPending, clearPending } = useFlushOnExit<T>(rowIdRef, dbDataType, isInDemoWorkspace);

  // Re-init from localStorage when workspace changes & cancel pending debounces
  useEffect(() => {
    // Cancel any pending DB sync from the previous workspace
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    clearPending();

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) { setData(JSON.parse(cached)); return; }
    } catch {}
    setData(defaultValue);
  }, [cacheKey]);

  // Fetch from DB on mount (if logged in) — skip during demo
  useEffect(() => {
    if (!user || hasFetchedRef.current === cacheKey || isInDemoWorkspace) return;
    hasFetchedRef.current = cacheKey;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: rows, error } = await supabase
          .from("user_data")
          .select("id, data")
          .eq("user_id", user.id)
          .eq("data_type", dbDataType)
          .limit(1);

        if (error) throw error;

        if (rows && rows.length > 0) {
          rowIdRef.current = rows[0].id;
          const dbData = rows[0].data as T;
          setData(dbData);
          safeLocalSet(cacheKey, JSON.stringify(dbData));
        }
        // NOTE: Do NOT auto-insert a new row if none exists.
        // The row will be created on the first user-initiated save().
        // This prevents stale demo data from being written to the real workspace.
      } catch (err) {
        console.error(`usePersistedWidget[${dbDataType}] fetch error:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, cacheKey, dbDataType, isInDemoWorkspace]);

  // Reset fetch flag when user changes
  useEffect(() => {
    hasFetchedRef.current = null;
    rowIdRef.current = null;
  }, [user?.id]);

  const syncToDb = useCallback(
    async (newData: T) => {
      if (!user) return;
      // Skip DB writes when inside a demo workspace
      if (isInDemoWorkspace) return;

      try {
        if (rowIdRef.current) {
          await supabase
            .from("user_data")
            .update({ data: newData as any, updated_at: new Date().toISOString() })
            .eq("id", rowIdRef.current);
        } else {
          // Select first to check if row exists
          const { data: existing } = await supabase
            .from("user_data")
            .select("id")
            .eq("user_id", user.id)
            .eq("data_type", dbDataType)
            .limit(1)
            .single();

          if (existing) {
            rowIdRef.current = existing.id;
            await supabase
              .from("user_data")
              .update({ data: newData as any, updated_at: new Date().toISOString() })
              .eq("id", existing.id);
          } else {
            const { data: inserted, error } = await supabase
              .from("user_data")
              .insert({ user_id: user.id, data_type: dbDataType, data: newData as any } as any)
              .select("id")
              .single();

            if (!error && inserted) {
              rowIdRef.current = inserted.id;
            }
          }
        }
        clearPending(); // Sync succeeded, clear pending
      } catch (err) {
        console.error(`usePersistedWidget[${dbDataType}] sync error:`, err);
      }
    },
    [user, dbDataType, clearPending, isInDemoWorkspace]
  );

  const save = useCallback(
    (newData: T) => {
      setData(newData);
      safeLocalSet(cacheKey, JSON.stringify(newData));

      // Only sync to DB if not in demo workspace
      if (isInDemoWorkspace) return;

      markPending(newData); // Track for flush on exit

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => syncToDb(newData), debounceMs);
    },
    [cacheKey, debounceMs, syncToDb, markPending, isInDemoWorkspace, safeLocalSet]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const clearCache = useCallback(async () => {
    if (!user) return;
    // Clear localStorage
    localStorage.removeItem(cacheKey);
    // Delete from DB
    if (rowIdRef.current) {
      await supabase.from("user_data").delete().eq("id", rowIdRef.current);
      rowIdRef.current = null;
    } else {
      // Try to find and delete by data_type
      await supabase
        .from("user_data")
        .delete()
        .eq("user_id", user.id)
        .eq("data_type", dbDataType);
    }
    // Reset local state to default
    setData(defaultValue);
    hasFetchedRef.current = null;
  }, [user, cacheKey, dbDataType, defaultValue]);

  return { data, save, loading, clearCache };
}
