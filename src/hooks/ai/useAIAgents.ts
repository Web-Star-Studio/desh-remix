// TODO: Migrar para edge function — acesso direto ao Supabase
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";

// Types — canonical definitions live in /src/types/ai.ts
export type { AIAgent } from "@/types/ai";
import type { AIAgent } from "@/types/ai";

export const DEFAULT_AGENT_NAME = "Assistente Geral";

const DEFAULT_AGENTS: Array<Omit<AIAgent, "id" | "user_id" | "created_at" | "updated_at">> = [
  {
    name: "Assistente Geral",
    description: "Assistente versátil para qualquer tarefa do dia a dia",
    system_prompt: "Você é um assistente pessoal amigável e eficiente. Ajude o usuário com qualquer tarefa de forma clara e concisa. Responda sempre em português brasileiro.",
    icon: "🤖",
    color: "hsl(35, 80%, 50%)",
    model: "google/gemini-3-flash-preview",
    temperature: 0.7,
  },
  {
    name: "Redator",
    description: "Especialista em escrita criativa, copywriting e revisão de textos",
    system_prompt: "Você é um redator profissional e criativo. Suas especialidades incluem:\n- Copywriting persuasivo e marketing\n- Textos para redes sociais, blogs e newsletters\n- Revisão gramatical e melhoria de estilo\n- Storytelling e narrativas envolventes\n- Adaptação de tom (formal, casual, técnico, humorístico)\n\nSempre sugira melhorias e variações. Use formatação markdown para organizar suas respostas. Responda em português brasileiro.",
    icon: "✍️",
    color: "hsl(280, 70%, 50%)",
    model: "google/gemini-3-flash-preview",
    temperature: 0.8,
  },
  {
    name: "Programador",
    description: "Desenvolvedor full-stack para código, debug e arquitetura",
    system_prompt: "Você é um programador sênior full-stack com expertise em:\n- JavaScript/TypeScript, React, Node.js, Python\n- SQL, banco de dados, APIs REST e GraphQL\n- Arquitetura de software e design patterns\n- Debug, otimização de performance e code review\n- DevOps, Docker, CI/CD\n\nSempre forneça código limpo e bem comentado. Explique decisões técnicas quando relevante. Use blocos de código com syntax highlighting. Responda em português brasileiro.",
    icon: "💻",
    color: "hsl(150, 60%, 40%)",
    model: "google/gemini-2.5-pro",
    temperature: 0.3,
  },
  {
    name: "Analista",
    description: "Especialista em análise de dados, estratégia e relatórios",
    system_prompt: "Você é um analista de dados e estrategista de negócios com expertise em:\n- Análise quantitativa e qualitativa de dados\n- Criação de relatórios executivos e dashboards\n- KPIs, métricas e OKRs\n- Planejamento estratégico e tomada de decisão\n- Análise de mercado e concorrência\n- Visualização de dados e storytelling com números\n\nSeja preciso com dados, use tabelas markdown quando apropriado, e sempre forneça insights acionáveis. Responda em português brasileiro.",
    icon: "📊",
    color: "hsl(220, 80%, 50%)",
    model: "google/gemini-2.5-flash",
    temperature: 0.5,
  },
];

export function useAIAgents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const seededRef = useRef(false);

  const { activeWorkspaceId } = useWorkspace();

  // Rule 1 — queryKey includes workspaceId for cache isolation
  const query = useQuery({
    queryKey: ["ai_agents", user?.id, activeWorkspaceId],
    enabled: !!user,
    staleTime: 15 * 60_000,
    queryFn: async () => {
      let q = supabase
        .from("ai_agents")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_template", false)
        .order("created_at", { ascending: true });

      // Rule 1 — Filter by workspace when a specific workspace is selected
      if (activeWorkspaceId) {
        q = q.or(`workspace_id.eq.${activeWorkspaceId},workspace_id.is.null`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as AIAgent[];
    },
  });

  // Seed default agents on first visit
  useEffect(() => {
    if (!user || seededRef.current || query.isLoading || !query.data) return;
    if (query.data.length > 0) { seededRef.current = true; return; }
    seededRef.current = true;

    const seedAgents = async () => {
      const inserts = DEFAULT_AGENTS.map(a => ({ ...a, user_id: user.id }));
      const { error } = await supabase.from("ai_agents").insert(inserts as any);
      if (!error) qc.invalidateQueries({ queryKey: ["ai_agents"] });
    };
    seedAgents();
  }, [user, query.data, query.isLoading, qc]);

  const create = useMutation({
    mutationFn: async (params: Omit<AIAgent, "id" | "user_id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase.from("ai_agents").insert({
        user_id: user!.id,
        ...params,
      }).select().single();
      if (error) throw error;
      return data as AIAgent;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_agents"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AIAgent> & { id: string }) => {
      const { error } = await supabase.from("ai_agents").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_agents"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const agents = query.data || [];
      const target = agents.find(a => a.id === id);
      if (target?.name === DEFAULT_AGENT_NAME) {
        toast.error("O agente padrão não pode ser excluído.");
        throw new Error("Cannot delete default agent");
      }
      const { error } = await supabase.from("ai_agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_agents"] }),
  });

  const defaultAgent = useMemo(() => {
    return (query.data || []).find(a => a.name === DEFAULT_AGENT_NAME) || null;
  }, [query.data]);

  return { agents: query.data || [], isLoading: query.isLoading, create, update, remove, defaultAgent };
}
