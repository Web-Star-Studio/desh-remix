// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

/**
 * Lightweight hook that exposes the current Supabase session
 * and re-renders the consumer whenever the auth state changes
 * (login, logout, token refresh).
 *
 * Widgets that auto-fetch from edge functions should depend on
 * `session` so they refetch automatically after the user logs in.
 */
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Get the initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setReady(true);
    }).catch(() => { setReady(true); });

    // Listen for changes (login / logout / token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, ready, isAuthenticated: !!session };
}
