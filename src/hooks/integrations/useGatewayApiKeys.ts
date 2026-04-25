// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface GatewayApiKey {
  id: string;
  user_id: string;
  key_prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export function useGatewayApiKeys() {
  const [keys, setKeys] = useState<GatewayApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_gateway_api_keys")
      .select("id, user_id, key_prefix, label, created_at, last_used_at, revoked_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching gateway API keys:", error);
    } else {
      setKeys((data as GatewayApiKey[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  /**
   * Generate a new API key — returns the raw key ONCE (never stored).
   */
  const generateKey = useCallback(async (label: string): Promise<string | null> => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc("generate_gateway_api_key", {
        _label: label,
      });

      if (error) throw new Error(error.message);

      await fetchKeys();
      return data as string;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar chave";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      return null;
    } finally {
      setGenerating(false);
    }
  }, [fetchKeys]);

  /**
   * Revoke a key by its ID.
   */
  const revokeKey = useCallback(async (keyId: string): Promise<void> => {
    try {
      const { error } = await supabase.rpc("revoke_gateway_api_key", {
        _key_id: keyId,
      });
      if (error) throw new Error(error.message);
      toast({ title: "Chave revogada", description: "A API key foi revogada com sucesso." });
      await fetchKeys();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao revogar chave";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  }, [fetchKeys]);

  /**
   * Rename (update label) of a key.
   */
  const renameKey = useCallback(async (keyId: string, newLabel: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from("user_gateway_api_keys")
        .update({ label: newLabel })
        .eq("id", keyId);
      if (error) throw new Error(error.message);
      toast({ title: "Label atualizado" });
      await fetchKeys();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao renomear chave";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  }, [fetchKeys]);

  /**
   * Delete a key permanently.
   */
  const deleteKey = useCallback(async (keyId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from("user_gateway_api_keys")
        .delete()
        .eq("id", keyId);

      if (error) throw new Error(error.message);
      toast({ title: "Chave removida" });
      await fetchKeys();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao remover chave";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  }, [fetchKeys]);

  return { keys, loading, generating, generateKey, revokeKey, deleteKey, renameKey, refetch: fetchKeys };
}
