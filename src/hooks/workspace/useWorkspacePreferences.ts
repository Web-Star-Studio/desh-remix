import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { WorkspacePreferences } from "@/types/workspace";

/**
 * Manages user_workspace_preferences — favorite workspace, ordering, all-mode behavior.
 */
export function useWorkspacePreferences(userId: string | undefined) {
  const [preferences, setPreferences] = useState<WorkspacePreferences | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (!userId || fetched.current) return;
    fetched.current = true;

    const load = async () => {
      const { data } = await (supabase as any)
        .from("user_workspace_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setPreferences(data as WorkspacePreferences);
      }
    };
    load();
  }, [userId]);

  const ensurePrefs = useCallback(async (): Promise<WorkspacePreferences> => {
    if (preferences) return preferences;
    if (!userId) throw new Error("No user");

    const { data, error } = await (supabase as any)
      .from("user_workspace_preferences")
      .upsert({ user_id: userId }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;
    const prefs = data as WorkspacePreferences;
    setPreferences(prefs);
    return prefs;
  }, [userId, preferences]);

  const updatePreferences = useCallback(async (updates: Partial<WorkspacePreferences>) => {
    if (!userId) return;
    await ensurePrefs();

    const { user_id, id, created_at, updated_at, ...safeUpdates } = updates as any;
    const { error } = await (supabase as any)
      .from("user_workspace_preferences")
      .upsert(
        { user_id: userId, ...safeUpdates },
        { onConflict: "user_id" }
      );

    if (!error) {
      setPreferences(prev => prev ? { ...prev, ...safeUpdates } : null);
    }
  }, [userId, ensurePrefs]);

  return { preferences, updatePreferences };
}
