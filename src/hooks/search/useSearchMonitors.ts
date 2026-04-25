// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SearchMonitor {
  id: string;
  name: string;
  query: string;
  engine: string;
  frequency: string;
  enabled: boolean;
  notify_on_change: boolean;
  last_checked_at: string | null;
  last_results_hash: string | null;
  created_at: string;
  updated_at: string;
  params: any;
}

export interface MonitorResult {
  id: string;
  monitor_id: string;
  results_data: any;
  diff_summary: string | null;
  created_at: string;
}

export function useSearchMonitors() {
  const [monitors, setMonitors] = useState<SearchMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResults, setSelectedResults] = useState<MonitorResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  const fetchMonitors = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("serp_monitors")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching monitors:", error);
      toast.error("Erro ao carregar monitores");
    } else {
      setMonitors((data || []) as SearchMonitor[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMonitors(); }, [fetchMonitors]);

  const createMonitor = useCallback(async (monitor: {
    name: string;
    query: string;
    frequency: string;
    notify_on_change: boolean;
    provider?: "perplexity" | "serpapi" | "both";
  }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabase
      .from("serp_monitors")
      .insert({
        user_id: session.user.id,
        name: monitor.name,
        query: monitor.query,
        engine: "google",
        frequency: monitor.frequency,
        notify_on_change: monitor.notify_on_change,
        params: { provider: monitor.provider || "both" },
      })
      .select()
      .single();

    if (error) {
      toast.error("Erro ao criar monitor");
      return null;
    }
    toast.success("Monitor criado com sucesso!");
    setMonitors(prev => [data as SearchMonitor, ...prev]);
    return data;
  }, []);

  const toggleMonitor = useCallback(async (id: string, enabled: boolean) => {
    const { error } = await supabase
      .from("serp_monitors")
      .update({ enabled })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar monitor");
      return;
    }
    setMonitors(prev => prev.map(m => m.id === id ? { ...m, enabled } : m));
    toast.success(enabled ? "Monitor ativado" : "Monitor pausado");
  }, []);

  const deleteMonitor = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("serp_monitors")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir monitor");
      return;
    }
    setMonitors(prev => prev.filter(m => m.id !== id));
    toast.success("Monitor excluído");
  }, []);

  const fetchResults = useCallback(async (monitorId: string) => {
    setLoadingResults(true);
    const { data, error } = await supabase
      .from("serp_monitor_results")
      .select("*")
      .eq("monitor_id", monitorId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching results:", error);
      toast.error("Erro ao carregar resultados");
    } else {
      setSelectedResults((data || []) as MonitorResult[]);
    }
    setLoadingResults(false);
  }, []);

  return {
    monitors,
    loading,
    createMonitor,
    toggleMonitor,
    deleteMonitor,
    fetchResults,
    selectedResults,
    loadingResults,
    refresh: fetchMonitors,
  };
}
