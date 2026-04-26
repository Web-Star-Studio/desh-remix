// TODO: Migrar para edge function — acesso direto ao Supabase
import { useCallback, useEffect, useRef } from "react"; // force HMR reset
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Registers visibilitychange + beforeunload listeners that flush
 * pending data to the DB via fetch keepalive when the user leaves.
 *
 * Call `markPending(data)` whenever new data is debounced.
 * Call `clearPending()` after a successful DB sync.
 *
 * @param skipFlush — when true, flush is a no-op (used for demo mode)
 */
export function useFlushOnExit<T>(
  rowIdRef: React.RefObject<string | null>,
  dbDataType: string,
  skipFlush?: boolean
) {
  const { user } = useAuth();
  const pendingRef = useRef<T | null>(null);
  const skipRef = useRef(skipFlush);
  skipRef.current = skipFlush;

  // Stable identities: callers put these in useEffect/useCallback deps.
  // Without useCallback, every parent render produces new fn references,
  // which made `useWidgetLayout`'s reset effect re-fire (and call setWidgets
  // with a fresh array) on every render → "Maximum update depth exceeded".
  const markPending = useCallback((data: T) => {
    pendingRef.current = data;
  }, []);

  const clearPending = useCallback(() => {
    pendingRef.current = null;
  }, []);

  useEffect(() => {
    const flush = async () => {
      // Skip flushing when in demo mode
      if (skipRef.current) return;

      const pending = pendingRef.current;
      if (!pending || !user) return;

      // Get current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": ANON_KEY,
        "Prefer": "return=minimal",
      };

      try {
        if (rowIdRef.current) {
          fetch(`${SUPABASE_URL}/rest/v1/user_data?id=eq.${rowIdRef.current}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ data: pending, updated_at: new Date().toISOString() }),
            keepalive: true,
          });
        } else {
          fetch(`${SUPABASE_URL}/rest/v1/user_data`, {
            method: "POST",
            headers: { ...headers, "Prefer": "return=minimal,resolution=merge-duplicates" },
            body: JSON.stringify({
              id: crypto.randomUUID(),
              user_id: user.id,
              data_type: dbDataType,
              data: pending,
            }),
            keepalive: true,
          });
        }
        pendingRef.current = null;
      } catch {
        // Best effort — page is closing
      }
    };

    const onVisChange = () => {
      if (document.visibilityState === "hidden") flush();
    };

    const onBeforeUnload = () => flush();

    document.addEventListener("visibilitychange", onVisChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [user, dbDataType, rowIdRef]);

  return { markPending, clearPending };
}
