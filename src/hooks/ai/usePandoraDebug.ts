// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PandoraSession {
  id: string;
  active_channel: string;
  context_snapshot: Record<string, any>;
  last_activity_at: string;
  created_at: string;
  workspace_id: string | null;
}

interface ToolCall {
  id: string;
  tool_name: string;
  tool_category: string;
  channel: string;
  status: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  input_params: any;
  output_result: any;
  error_message: string | null;
  retry_count: number;
  session_id: string | null;
}

interface Metrics {
  totalToday: number;
  successRate: number;
  topTool: string;
  avgDurationMs: number;
}

export function usePandoraDebug() {
  const { user } = useAuth();
  const [session, setSession] = useState<PandoraSession | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ totalToday: 0, successRate: 0, topTool: "—", avgDurationMs: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch active session (last 30 min)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: sessions, error: sessErr } = await supabase
        .from("pandora_sessions")
        .select("*")
        .eq("user_id", user.id)
        .gte("last_activity_at", thirtyMinAgo)
        .order("last_activity_at", { ascending: false })
        .limit(1);

      if (sessErr) throw sessErr;
      setSession((sessions?.[0] as any) || null);

      // Fetch last 50 tool calls
      const { data: calls, error: tcErr } = await supabase
        .from("pandora_tool_calls")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (tcErr) throw tcErr;
      setToolCalls((calls as any[]) || []);

      // Compute metrics from today's calls
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCalls = (calls || []).filter((c: any) => new Date(c.created_at) >= todayStart);
      const doneCalls = todayCalls.filter((c: any) => c.status === "done");
      const durations = doneCalls
        .filter((c: any) => c.started_at && c.completed_at)
        .map((c: any) => new Date(c.completed_at).getTime() - new Date(c.started_at).getTime());

      // Top tool
      const toolCount: Record<string, number> = {};
      todayCalls.forEach((c: any) => { toolCount[c.tool_name] = (toolCount[c.tool_name] || 0) + 1; });
      const topTool = Object.entries(toolCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

      setMetrics({
        totalToday: todayCalls.length,
        successRate: todayCalls.length > 0 ? Math.round((doneCalls.length / todayCalls.length) * 100) : 0,
        topTool,
        avgDurationMs: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      });
    } catch (e: any) {
      console.error("[PandoraDebug]", e);
      setError(e.message || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime subscription for new tool calls
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("pandora-debug-tool-calls")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pandora_tool_calls", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setToolCalls((prev) => [payload.new as any, ...prev].slice(0, 50));
          // Refresh metrics
          fetchData();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  const clearSession = useCallback(async () => {
    if (!session) return;
    await supabase
      .from("pandora_sessions")
      .update({ last_activity_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() } as any)
      .eq("id", session.id);
    setSession(null);
  }, [session]);

  return { session, toolCalls, metrics, loading, error, refresh: fetchData, clearSession };
}
