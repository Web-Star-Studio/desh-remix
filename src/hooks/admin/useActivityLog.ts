// TODO: Migrar para edge function — acesso direto ao Supabase
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ActivityCategory =
  | "notas" | "tarefas" | "calendario" | "contatos" | "financas"
  | "email" | "mensagens" | "arquivos" | "ia" | "configuracoes"
  | "autenticacao" | "automacoes" | "geral";

interface LogOptions {
  action: string;
  category?: ActivityCategory;
  details?: Record<string, unknown>;
}

export function useActivityLog() {
  const { user } = useAuth();

  const log = useCallback(
    async ({ action, category = "geral", details = {} }: LogOptions) => {
      if (!user) return;
      try {
        await supabase.from("user_activity_logs" as any).insert({
          user_id: user.id,
          action,
          category,
          details,
        } as any);
      } catch {
        // silent — logging should never block the user
      }
    },
    [user]
  );

  return { log };
}
