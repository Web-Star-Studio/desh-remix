import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AISkill {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  name: string;
  description: string;
  icon: string;
  category: string;
  instructions: string;
  trigger_description: string | null;
  is_system: boolean;
  is_active: boolean;
  token_estimate: number | null;
  created_at: string;
  updated_at: string;
}

const SKILL_CATEGORIES = [
  { value: "analysis", label: "Análise" },
  { value: "writing", label: "Redação" },
  { value: "planning", label: "Planejamento" },
  { value: "communication", label: "Comunicação" },
  { value: "finance", label: "Finanças" },
  { value: "marketing", label: "Marketing" },
  { value: "development", label: "Desenvolvimento" },
  { value: "management", label: "Gestão" },
  { value: "sales", label: "Vendas" },
  { value: "support", label: "Suporte" },
  { value: "legal", label: "Jurídico" },
  { value: "data", label: "Dados" },
  { value: "other", label: "Outro" },
] as const;

export { SKILL_CATEGORIES };

export function useAISkills(workspaceId?: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ai_skills", user?.id, workspaceId],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // Fetch user's workspace skills + system skills (Rule 1: workspace-scoped)
      let q = supabase
        .from("ai_skills")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name", { ascending: true });

      if (workspaceId) {
        // User skills for this workspace + system skills
        q = q.or(`and(user_id.eq.${user!.id},workspace_id.eq.${workspaceId}),is_system.eq.true`);
      } else {
        // All user skills + system skills
        q = q.or(`user_id.eq.${user!.id},is_system.eq.true`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AISkill[];
    },
  });

  const create = useMutation({
    mutationFn: async (params: {
      name: string;
      description: string;
      icon?: string;
      category: string;
      instructions: string;
      trigger_description?: string;
      workspace_id?: string | null;
    }) => {
      if (params.instructions.length > 2000) {
        throw new Error("Instruções devem ter no máximo 2000 caracteres");
      }
      const tokenEstimate = Math.ceil(params.instructions.length / 4);
      const { data, error } = await supabase.from("ai_skills").insert({
        user_id: user!.id,
        workspace_id: params.workspace_id || workspaceId || null,
        name: params.name,
        description: params.description,
        icon: params.icon || "⚡",
        category: params.category,
        instructions: params.instructions,
        trigger_description: params.trigger_description || null,
        is_system: false,
        is_active: true,
        token_estimate: tokenEstimate,
      } as any).select().single();
      if (error) throw error;
      return data as AISkill;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_skills"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AISkill> & { id: string }) => {
      if (updates.instructions && updates.instructions.length > 2000) {
        throw new Error("Instruções devem ter no máximo 2000 caracteres");
      }
      const payload: any = { ...updates };
      if (updates.instructions) {
        payload.token_estimate = Math.ceil(updates.instructions.length / 4);
      }
      const { error } = await supabase.from("ai_skills").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_skills"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const skill = (query.data || []).find(s => s.id === id);
      if (skill?.is_system) throw new Error("Skills de sistema não podem ser excluídos");
      const { error } = await supabase.from("ai_skills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_skills"] }),
  });

  const activeSkills = (query.data || []).filter(s => s.is_active);
  const totalTokens = activeSkills.reduce((sum, s) => sum + (s.token_estimate || 0), 0);

  return {
    skills: query.data || [],
    activeSkills,
    totalTokens,
    isLoading: query.isLoading,
    create,
    update,
    remove,
  };
}
