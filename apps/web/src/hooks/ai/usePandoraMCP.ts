// TODO: Migrar para edge function — acesso direto ao Supabase
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceSafe } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

interface MCPMessage {
  role: "user" | "assistant";
  content: string;
}

interface MCPResponse {
  type: string;
  content: string;
  tools_used?: string[];
  model?: string;
  mcp?: boolean;
}

const MCP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pandora-mcp`;

export function usePandoraMCP() {
  const { user, profile } = useAuth();
  const workspace = useWorkspaceSafe();
  const [isLoading, setIsLoading] = useState(false);
  const historyRef = useRef<MCPMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (message: string): Promise<string | null> => {
    if (!user) {
      toast.error("Você precisa estar logado.");
      return null;
    }

    setIsLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return null;
      }

      const activeWorkspace = workspace?.activeWorkspaceId;
      const workspaceName = workspace?.workspaces?.find(w => w.id === activeWorkspace)?.name || "Pessoal";

      const resp = await fetch(MCP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          workspace_id: activeWorkspace || undefined,
          workspace_name: workspaceName,
          conversation_history: historyRef.current.slice(-20),
          user_name: profile?.display_name || user.email?.split("@")[0] || "Usuário",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        signal: controller.signal,
      });

      if (resp.status === 402) {
        toast.error("Créditos insuficientes. Recarregue em Configurações.");
        return null;
      }

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${resp.status}`);
      }

      const data: MCPResponse = await resp.json();

      // Update conversation history
      historyRef.current = [
        ...historyRef.current,
        { role: "user", content: message },
        { role: "assistant", content: data.content },
      ];

      // Log tools used for debugging
      if (data.tools_used?.length) {
        console.debug("[PandoraMCP] Tools used:", data.tools_used);
      }

      return data.content;
    } catch (err: any) {
      if (err.name === "AbortError") return null;
      console.error("[PandoraMCP] Error:", err);
      toast.error(err.message?.includes("fetch") ? "Falha na conexão." : err.message || "Erro ao processar.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, profile, workspace]);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  return { sendMessage, isLoading, clearHistory, abort };
}
