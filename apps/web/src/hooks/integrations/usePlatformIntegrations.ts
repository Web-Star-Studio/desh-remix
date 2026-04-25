// Platform integrations hook — acesso direto ao Supabase
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PlatformIntegration {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export const usePlatformIntegrations = () => {
  const [integrations, setIntegrations] = useState<PlatformIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = useCallback(async () => {
    const { data, error } = await supabase
      .from("platform_integrations")
      .select("id, label, icon, enabled, updated_at, updated_by")
      .order("label");
    if (!error && data) setIntegrations(data as unknown as PlatformIntegration[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const enabledMap = useMemo(() => {
    const map = new Map<string, boolean>();
    integrations.forEach(i => map.set(i.id, i.enabled));
    return map;
  }, [integrations]);

  const isIntegrationEnabled = useCallback((id: string): boolean => {
    return enabledMap.get(id) ?? true; // default true if not found
  }, [enabledMap]);

  const toggleIntegration = useCallback(async (id: string, enabled: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("platform_integrations")
      .update({ enabled, updated_by: user?.id, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) throw error;
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, enabled, updated_by: user?.id ?? null, updated_at: new Date().toISOString() } : i));
  }, []);

  return useMemo(() => ({ integrations, loading, isIntegrationEnabled, toggleIntegration, refresh: fetchIntegrations }), [integrations, loading, isIntegrationEnabled, toggleIntegration, fetchIntegrations]);
};
