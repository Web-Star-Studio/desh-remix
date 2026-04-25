// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface GatewayKeyLog {
  id: string;
  key_id: string;
  user_id: string;
  event: string;
  session_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export function useGatewayApiKeyLogs(keyId?: string) {
  const [logs, setLogs] = useState<GatewayKeyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("gateway_api_key_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (keyId) {
      query = query.eq("key_id", keyId);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching key logs:", error);
      toast({ title: "Erro ao carregar logs", variant: "destructive" });
    } else {
      setLogs((data as GatewayKeyLog[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [keyId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, total, refetch: fetchLogs };
}
