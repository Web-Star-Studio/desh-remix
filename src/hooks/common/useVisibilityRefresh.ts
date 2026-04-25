/**
 * useVisibilityRefresh — Auto-refresh data when user returns to the tab
 * after being away for a configurable threshold.
 */
import { useEffect, useRef } from "react";

interface UseVisibilityRefreshOptions {
  /** Callback to run when user returns to the tab */
  onRefresh: () => void;
  /** Minimum time away (ms) before triggering refresh. Default: 60_000 (1 min) */
  thresholdMs?: number;
  /** Whether the hook is enabled */
  enabled?: boolean;
}

export function useVisibilityRefresh({
  onRefresh,
  thresholdMs = 60_000,
  enabled = true,
}: UseVisibilityRefreshOptions) {
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else {
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (hiddenAt && Date.now() - hiddenAt >= thresholdMs) {
          onRefresh();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [onRefresh, thresholdMs, enabled]);
}
