// Wave 6b — `user_data` table will move to apps/api as part of admin/preferences.
// Until then this hook is localStorage-only: cutting auth over to Cognito made
// every Supabase RLS-gated read/write fail (406/401) because user.id is now a
// Cognito sub. localStorage was already the source of truth for first-paint;
// dropping the DB sync just removes the noise without changing user-visible
// behavior — settings persist per-browser, not cross-device, until migration.

import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";

interface UsePersistedWidgetOptions<T> {
  key: string;
  defaultValue: T;
  /** Kept for API compatibility — currently a no-op. */
  debounceMs?: number;
}

interface UsePersistedWidgetResult<T> {
  data: T;
  save: (newData: T) => void;
  loading: boolean;
  clearCache: () => Promise<void>;
}

function safeLocalSet(k: string, value: string) {
  try {
    localStorage.setItem(k, value);
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string } | null;
    const isQuota = e?.name === "QuotaExceededError" || /quota/i.test(e?.message ?? "");
    if (isQuota) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* noop */
      }
      console.warn(`[usePersistedWidget] localStorage quota exceeded for "${k}"`);
    }
  }
}

export function usePersistedWidget<T>({
  key,
  defaultValue,
}: UsePersistedWidgetOptions<T>): UsePersistedWidgetResult<T> {
  const workspaceCtx = useWorkspaceSafe();
  const activeWorkspaceId = workspaceCtx?.activeWorkspaceId ?? null;
  const cacheKey = activeWorkspaceId ? `dashfy-${activeWorkspaceId}-${key}` : `dashfy-${key}`;

  const defaultRef = useRef(defaultValue);
  defaultRef.current = defaultValue;

  const [data, setData] = useState<T>(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {
      /* fall through */
    }
    return defaultValue;
  });

  // Re-init from localStorage when workspace changes.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setData(JSON.parse(cached));
        return;
      }
    } catch {
      /* fall through */
    }
    setData(defaultRef.current);
  }, [cacheKey]);

  const save = useCallback(
    (newData: T) => {
      setData(newData);
      safeLocalSet(cacheKey, JSON.stringify(newData));
    },
    [cacheKey],
  );

  const clearCache = useCallback(async () => {
    localStorage.removeItem(cacheKey);
    setData(defaultRef.current);
  }, [cacheKey]);

  return { data, save, loading: false, clearCache };
}
