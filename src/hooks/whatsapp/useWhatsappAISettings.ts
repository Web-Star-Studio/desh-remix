// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";
import {
  errResult,
  okResult,
  toWABAError,
  type WABAResult,
} from "@/services/zernio/types";

// Types — canonical definitions live in /src/types/whatsapp.ts
export type { WhatsappAISettings } from "@/types/whatsapp";
import type { WhatsappAISettings } from "@/types/whatsapp";

export function useWhatsappAISettings() {
  const { user } = useAuth();
  const wsCtx = useWorkspaceSafe();
  const activeWorkspaceId = wsCtx?.activeWorkspaceId ?? wsCtx?.defaultWorkspace?.id ?? null;

  const [settings, setSettings] = useState<WhatsappAISettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user || !activeWorkspaceId) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSettings(null);

    const { data, error } = await supabase
      .from("whatsapp_ai_settings" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("workspace_id", activeWorkspaceId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching whatsapp ai settings:", error);
    }
    setSettings(data as unknown as WhatsappAISettings | null);
    setLoading(false);
  }, [user, activeWorkspaceId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const upsertSettings = useCallback(
    async (
      updates: Partial<WhatsappAISettings>,
    ): Promise<WABAResult<WhatsappAISettings | null>> => {
      if (!user || !activeWorkspaceId) {
        return errResult({
          message: "Selecione um workspace antes de salvar.",
          code: "validation_error",
        });
      }

      try {
        if (settings) {
          // Update
          const { error } = await supabase
            .from("whatsapp_ai_settings" as any)
            .update(updates as any)
            .eq("id", settings.id);
          if (error) throw error;
        } else {
          // Insert with workspace_id
          const { error } = await supabase
            .from("whatsapp_ai_settings" as any)
            .insert({ user_id: user.id, workspace_id: activeWorkspaceId, ...updates } as any);
          if (error) throw error;
        }

        toast.success("Configurações salvas");
        await fetchSettings();
        return okResult(settings);
      } catch (e) {
        const info = toWABAError(e);
        toast.error("Erro ao salvar configurações", { description: info.message });
        console.error(e);
        return errResult(info);
      }
    },
    [user, activeWorkspaceId, settings, fetchSettings],
  );

  return { settings, loading, upsertSettings, refetch: fetchSettings };
}
