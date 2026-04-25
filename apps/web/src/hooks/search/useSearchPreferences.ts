// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SearchPreferences {
  // Search engines
  perplexity_enabled: boolean;
  serpapi_enabled: boolean;
  // SerpAPI sub-engines to show
  serp_show_knowledge_graph: boolean;
  serp_show_people_also_ask: boolean;
  serp_show_shopping: boolean;
  serp_show_news: boolean;
  serp_show_organic: boolean;
  serp_show_images: boolean;
  // Specialized engines visibility
  serp_show_finance: boolean;
  serp_show_flights: boolean;
  serp_show_hotels: boolean;
  serp_show_jobs: boolean;
  serp_show_events: boolean;
  serp_show_scholar: boolean;
  serp_show_youtube: boolean;
  serp_show_maps: boolean;
  serp_show_patents: boolean;
  serp_show_trends: boolean;
  // Monitor defaults
  monitor_default_provider: "perplexity" | "serpapi" | "both";
  // Search behavior
  auto_serp_on_web: boolean; // auto-fire SerpAPI on "Web" filter
  auto_serp_on_news: boolean;
  auto_serp_on_images: boolean;
}

const DEFAULT_PREFS: SearchPreferences = {
  perplexity_enabled: true,
  serpapi_enabled: true,
  serp_show_knowledge_graph: true,
  serp_show_people_also_ask: true,
  serp_show_shopping: true,
  serp_show_news: true,
  serp_show_organic: true,
  serp_show_images: true,
  serp_show_finance: true,
  serp_show_flights: true,
  serp_show_hotels: true,
  serp_show_jobs: true,
  serp_show_events: true,
  serp_show_scholar: true,
  serp_show_youtube: true,
  serp_show_maps: true,
  serp_show_patents: true,
  serp_show_trends: true,
  monitor_default_provider: "both",
  auto_serp_on_web: true,
  auto_serp_on_news: true,
  auto_serp_on_images: true,
};

const STORAGE_KEY = "desh_search_preferences";

export function useSearchPreferences() {
  const [prefs, setPrefs] = useState<SearchPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_PREFS;
  });

  // Also persist to user_data for cross-device sync
  const syncToCloud = useCallback(async (newPrefs: SearchPreferences) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from("user_data").upsert(
      {
        user_id: session.user.id,
        data_type: "search_preferences",
        data: newPrefs as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,data_type" }
    );
  }, []);

  // Load from cloud on mount
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("user_data")
        .select("data")
        .eq("user_id", session.user.id)
        .eq("data_type", "search_preferences")
        .maybeSingle();

      if (data?.data) {
        const cloudPrefs = { ...DEFAULT_PREFS, ...(data.data as any) };
        setPrefs(cloudPrefs);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudPrefs));
      }
    })();
  }, []);

  const updatePrefs = useCallback((partial: Partial<SearchPreferences>) => {
    setPrefs(prev => {
      const updated = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      syncToCloud(updated);
      return updated;
    });
  }, [syncToCloud]);

  const resetPrefs = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFS));
    syncToCloud(DEFAULT_PREFS);
  }, [syncToCloud]);

  return { prefs, updatePrefs, resetPrefs };
}
