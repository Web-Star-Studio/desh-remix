import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */

interface AgentTemplate {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  category: string | null;
  model: string;
  temperature: number;
  system_prompt: string | null;
  tools_enabled: string[] | null;
}

/* ═══════════════════════════════════════════════════
   INDUSTRY RECOMMENDATIONS
   ═══════════════════════════════════════════════════ */

const INDUSTRY_RECOMMENDATIONS: Record<string, string[]> = {
  Marketing:   ["assistant", "marketing", "sales", "writer", "analyst"],
  Tecnologia:  ["assistant", "dev", "manager", "analyst"],
  Finanças:    ["assistant", "finance", "analyst", "consultant"],
  Saúde:       ["assistant", "support", "manager", "hr"],
  Jurídico:    ["assistant", "legal", "writer", "manager"],
  Educação:    ["assistant", "writer", "analyst", "manager"],
  Varejo:      ["assistant", "sales", "support", "marketing"],
  Imobiliário: ["assistant", "sales", "finance", "consultant"],
  Outro:       ["assistant", "manager", "consultant"],
};

const CATEGORY_LABELS: Record<string, string> = {
  assistant: "Assistente",
  finance: "Finanças",
  sales: "Comercial",
  marketing: "Marketing",
  support: "Atendimento",
  manager: "Gestão",
  dev: "Desenvolvimento",
  writer: "Redação",
  analyst: "Análise",
  consultant: "Estratégia",
  legal: "Jurídico",
  hr: "RH",
};

/* ═══════════════════════════════════════════════════
   HOOK: Fetch templates from DB
   ═══════════════════════════════════════════════════ */

export function useAgentTemplates() {
  return useQuery({
    queryKey: ["ai_agent_templates"],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, name, description, icon, color, category, model, temperature, system_prompt, tools_enabled")
        .eq("is_template", true)
        .is("user_id", null)
        .order("name");
      if (error) throw error;
      return (data || []) as AgentTemplate[];
    },
  });
}

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */

interface AgentTemplateLibraryProps {
  open: boolean;
  onClose: () => void;
  /** Called after creating the agent copy — receives the new agent ID */
  onAgentCreated?: (agentId: string) => void;
  /** Industry for recommendations (from workspace) */
  industry?: string;
}

const AgentTemplateLibrary = ({ open, onClose, onAgentCreated, industry }: AgentTemplateLibraryProps) => {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useAgentTemplates();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState<string | null>(null);

  const recommended = useMemo(() => {
    if (!industry) return [];
    return INDUSTRY_RECOMMENDATIONS[industry] || INDUSTRY_RECOMMENDATIONS["Outro"];
  }, [industry]);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  }, [templates, search]);

  const recommendedTemplates = useMemo(() => {
    if (!recommended.length) return [];
    return filtered.filter(t => t.category && recommended.includes(t.category));
  }, [filtered, recommended]);

  const otherTemplates = useMemo(() => {
    if (!recommended.length) return filtered;
    const recIds = new Set(recommendedTemplates.map(t => t.id));
    return filtered.filter(t => !recIds.has(t.id));
  }, [filtered, recommended, recommendedTemplates]);

  const handleUseTemplate = async (template: AgentTemplate) => {
    if (!user || !activeWorkspaceId) {
      toast.error("Selecione um workspace antes de usar um template.");
      return;
    }
    setCreating(template.id);
    try {
      const { data, error } = await supabase.from("ai_agents").insert({
        user_id: user.id,
        workspace_id: activeWorkspaceId,
        name: template.name,
        description: template.description,
        icon: template.icon,
        color: template.color,
        category: template.category,
        model: template.model,
        temperature: template.temperature,
        system_prompt: template.system_prompt,
        tools_enabled: template.tools_enabled,
        template_id: template.id,
        is_template: false,
        is_active: true,
      } as any).select("id").single();

      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["ai_agents"] });
      toast.success(`"${template.name}" adicionado ao workspace! ✨`);
      onAgentCreated?.(data.id);
      onClose();
    } catch (err) {
      console.error("Error creating agent from template:", err);
      toast.error("Erro ao criar agente. Tente novamente.");
    } finally {
      setCreating(null);
    }
  };

  const renderCard = (t: AgentTemplate, isRecommended: boolean) => (
    <div
      key={t.id}
      className={`relative p-4 rounded-2xl border transition-all hover:shadow-md group ${
        isRecommended
          ? "border-primary/30 bg-primary/[0.03]"
          : "border-border/40 bg-card/50 hover:border-border/60"
      }`}
    >
      {isRecommended && (
        <div className="absolute -top-2 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-semibold">
          <Star className="w-2.5 h-2.5 fill-primary" /> Recomendado
        </div>
      )}

      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: `${t.color || "hsl(220,80%,50%)"}20` }}
        >
          {t.icon || "🤖"}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">{t.name}</h4>
          {t.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
          )}

          <div className="flex items-center gap-2 mt-2">
            {t.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground font-medium">
                {CATEGORY_LABELS[t.category] || t.category}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/60">
              {t.model.includes("pro") ? "Pro" : "Flash"} · {t.temperature}
            </span>
          </div>

          {t.tools_enabled && t.tools_enabled.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {t.tools_enabled.slice(0, 4).map(tool => (
                <span key={tool} className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground/70">
                  {tool.replace(/_/g, " ")}
                </span>
              ))}
              {t.tools_enabled.length > 4 && (
                <span className="text-[9px] text-muted-foreground/50">+{t.tools_enabled.length - 4}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => handleUseTemplate(t)}
        disabled={creating === t.id || !activeWorkspaceId}
        className="mt-3 w-full text-xs font-medium py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {creating === t.id ? (
          <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        ) : (
          <Sparkles className="w-3 h-3" />
        )}
        {creating === t.id ? "Criando..." : "Usar template"}
      </button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Biblioteca de Agentes
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar agente..."
            className="pl-9 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 pb-2">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && recommendedTemplates.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <Star className="w-3 h-3 text-primary" />
                Recomendados para {industry}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recommendedTemplates.map(t => renderCard(t, true))}
              </div>
            </div>
          )}

          {!isLoading && otherTemplates.length > 0 && (
            <div>
              {recommendedTemplates.length > 0 && (
                <h3 className="text-xs font-semibold text-muted-foreground mb-3">Todos os templates</h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {otherTemplates.map(t => renderCard(t, false))}
              </div>
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum template encontrado.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentTemplateLibrary;
