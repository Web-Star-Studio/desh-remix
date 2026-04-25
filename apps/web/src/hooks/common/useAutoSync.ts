// TODO: Migrar para edge function — acesso direto ao Supabase
/**
 * useAutoSync – fires ONCE per browser session when the user is authenticated.
 *
 * Optimized v2:
 *  1. Staggered Google cache invalidation by priority (Calendar+Gmail first, then Tasks+Drive, then People).
 *  2. Auto-reconnects WhatsApp Web sessions in PARALLEL (Promise.allSettled) instead of sequentially.
 *
 * Guards:
 *  - sessionStorage flag prevents re-running on hot reloads / route changes.
 *  - Only runs when `user` is truthy (post-login).
 *  - WhatsApp reconnect only fires if no session is already CONNECTED/QR_PENDING per workspace.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { invalidateGoogleCache } from "@/hooks/integrations/useGoogleServiceData";
import { supabase } from "@/integrations/supabase/client";
import { callWhatsappProxy } from "@/lib/whatsappProxy";

const SESSION_FLAG = "desh-auto-sync-done";

export function useAutoSync() {
  const { user } = useAuth();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    const flag = sessionStorage.getItem(SESSION_FLAG);
    if (flag === user.id || ranRef.current) return;
    ranRef.current = true;
    sessionStorage.setItem(SESSION_FLAG, user.id);

    // ── 1. Staggered Google cache invalidation by priority ──

    // Priority 1 — immediate: Calendar + Gmail (most visible on dashboard)
    invalidateGoogleCache("calendar");
    invalidateGoogleCache("gmail");

    // Priority 2 — +2s: Tasks + Drive
    const t1 = setTimeout(() => {
      invalidateGoogleCache("tasks");
      invalidateGoogleCache("drive");
    }, 2000);

    // Priority 3 — +4s: People/Contacts
    const t2 = setTimeout(() => {
      invalidateGoogleCache("people");
    }, 4000);

    // ── 2. Auto-reconnect WhatsApp Web (parallel, workspace-aware) ──
    (async () => {
      try {
        const { data: sessions } = await supabase
          .from("whatsapp_web_sessions")
          .select("session_id, status, auto_reconnect, workspace_id, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (!sessions || sessions.length === 0) return;

        const now = Date.now();

        const reconnectPromises = sessions
          .filter(sess => {
            if (sess.status === "CONNECTED" || sess.status === "QR_PENDING" || sess.status === "RECONNECTING") {
              console.debug("[auto-sync] WhatsApp already", sess.status, "ws:", sess.workspace_id);
              return false;
            }
            if (sess.auto_reconnect === false) {
              console.debug("[auto-sync] WhatsApp auto_reconnect disabled for ws:", sess.workspace_id);
              return false;
            }
            const updatedAt = sess.updated_at ? new Date(sess.updated_at).getTime() : 0;
            if (now - updatedAt < 30_000) {
              console.debug("[auto-sync] WhatsApp recently updated, skipping ws:", sess.workspace_id);
              return false;
            }
            return true;
          })
          .map(sess => {
            console.debug("[auto-sync] Attempting WhatsApp auto-reconnect for ws:", sess.workspace_id);
            return callWhatsappProxy("POST", "/sessions", undefined, sess.workspace_id, 20_000)
              .then(() => console.debug("[auto-sync] WhatsApp reconnect sent for ws:", sess.workspace_id))
              .catch(err => console.info("[auto-sync] WhatsApp reconnect deferred ws:", sess.workspace_id, err));
          });

        if (reconnectPromises.length > 0) {
          await Promise.allSettled(reconnectPromises);
          console.debug("[auto-sync] All WhatsApp reconnect attempts completed in parallel");
        }
      } catch (err) {
        console.warn("[auto-sync] WhatsApp auto-reconnect failed:", err);
      }
    })();

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [user]);
}
