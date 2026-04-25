import React, { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Check, Sparkles, Star } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAgentTemplates } from "@/components/ai/AgentTemplateLibrary";
import type { Workspace } from "@/types/workspace";

/* ═══════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════ */

type WsType = "personal" | "company" | "project" | "education";

interface WizardState {
  // Step 1
  name: string;
  type: WsType;
  icon: string;
  color: string;
  // Step 2
  industry: string;
  description: string;
  role: string;
  // Step 3
  pendingIntegrations: string[];
  // Step 4
  selectedAgents: string[];
}

interface Props {
  workspace: Workspace;
  onComplete: () => void;
  onClose: () => void;
}

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const WS_TYPES: { value: WsType; icon: string; label: string }[] = [
  { value: "personal", icon: "🏠", label: "Pessoal" },
  { value: "company", icon: "🏢", label: "Empresa" },
  { value: "project", icon: "📋", label: "Projeto" },
  { value: "education", icon: "🎓", label: "Educação" },
];

const INDUSTRIES = [
  "Tecnologia", "Marketing", "Saúde", "Finanças", "Educação",
  "Varejo", "Jurídico", "Imobiliário", "Outro",
];

const INTEGRATIONS = [
  { id: "gmail", label: "Gmail", icon: "📧" },
  { id: "calendar", label: "Google Calendar", icon: "📅" },
  { id: "drive", label: "Google Drive", icon: "📁" },
  { id: "tasks", label: "Google Tasks", icon: "✅" },
  { id: "contacts", label: "Google Contacts", icon: "👤" },
  { id: "banking", label: "Open Banking", icon: "🏦" },
  { id: "whatsapp", label: "WhatsApp", icon: "💬" },
];

const EMOJIS = [
  "🏠", "💼", "🏢", "🎨", "📚", "🎮", "🧪", "🌟", "🚀", "💡",
  "📊", "🛒", "🎯", "⚡", "🔬", "🌍", "🎓", "🏆", "🎵", "📱",
  "💎", "🔧", "🌈", "🐱", "🍀", "🔥", "❤️", "🧠", "📝", "🛡️",
];

const COLORS = [
  "hsl(220, 80%, 50%)", "hsl(280, 80%, 50%)", "hsl(340, 80%, 50%)",
  "hsl(160, 80%, 40%)", "hsl(30, 90%, 50%)", "hsl(200, 80%, 50%)",
  "hsl(0, 70%, 50%)", "hsl(45, 90%, 55%)", "hsl(90, 60%, 40%)",
  "hsl(315, 70%, 50%)", "hsl(180, 60%, 45%)", "hsl(250, 60%, 60%)",
];

/* ═══════════════════════════════════════════════════
   INDUSTRY → CATEGORY RECOMMENDATIONS
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

interface DbTemplate {
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

function getRecommendedIds(templates: DbTemplate[], industry: string): string[] {
  const cats = INDUSTRY_RECOMMENDATIONS[industry] || INDUSTRY_RECOMMENDATIONS["Outro"];
  // "assistant" category is always recommended
  return templates
    .filter(t => t.category && cats.includes(t.category))
    .map(t => t.id);
}

function buildContextSummary(state: WizardState): string {
  const typeLabel = WS_TYPES.find(t => t.value === state.type)?.label ?? "";
  const parts = [typeLabel, state.industry, state.description, state.role ? `Papel: ${state.role}` : ""]
    .filter(Boolean);
  return parts.join(" · ");
}

/* ═══════════════════════════════════════════════════
   STEP COMPONENTS
   ═══════════════════════════════════════════════════ */

const inputClass = "w-full px-3 py-2.5 rounded-xl bg-foreground/5 border border-foreground/10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors";

function StepIdentity({ state, setState }: { state: WizardState; setState: (s: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome do perfil</label>
        <input value={state.name} onChange={e => setState({ name: e.target.value })} placeholder="Ex: Empresa X" className={inputClass} autoFocus />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Tipo</label>
        <div className="grid grid-cols-2 gap-2">
          {WS_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setState({ type: t.value, icon: t.icon })}
              className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                state.type === t.value
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06]"
              }`}
            >
              <span className="text-xl">{t.icon}</span>
              <span className="text-sm font-medium text-foreground">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ícone</label>
        <div className="flex gap-1.5 flex-wrap">
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => setState({ icon: e })}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all ${
                state.icon === e ? "bg-primary/20 scale-110 ring-1 ring-primary" : "bg-foreground/5 hover:bg-foreground/10"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Cor</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setState({ color: c })}
              className={`w-8 h-8 rounded-full transition-all border-2 ${
                state.color === c ? "border-foreground scale-110 shadow-lg" : "border-transparent hover:scale-105"
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepContext({ state, setState }: { state: WizardState; setState: (s: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Setor / Indústria</label>
        <select
          value={state.industry}
          onChange={e => setState({ industry: e.target.value })}
          className={inputClass}
        >
          <option value="">Selecione...</option>
          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descrição</label>
        <textarea
          value={state.description}
          onChange={e => setState({ description: e.target.value.slice(0, 500) })}
          placeholder="Ex: Agência digital de 15 anos, foco em IA e automação..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
        <span className="text-[10px] text-muted-foreground/50 mt-0.5 block text-right">{state.description.length}/500</span>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Seu papel</label>
        <input
          value={state.role}
          onChange={e => setState({ role: e.target.value })}
          placeholder="Ex: CEO, Gerente de Marketing, Desenvolvedor..."
          className={inputClass}
        />
      </div>
    </div>
  );
}

function StepIntegrations({ state, setState }: { state: WizardState; setState: (s: Partial<WizardState>) => void }) {
  const toggle = (id: string) => {
    setState({
      pendingIntegrations: state.pendingIntegrations.includes(id)
        ? state.pendingIntegrations.filter(i => i !== id)
        : [...state.pendingIntegrations, id],
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground/70 leading-relaxed">
        Selecione as integrações que deseja conectar. A conexão será feita depois, nas configurações do perfil.
      </p>

      <div className="space-y-2">
        {INTEGRATIONS.map(integ => {
          const selected = state.pendingIntegrations.includes(integ.id);
          return (
            <button
              key={integ.id}
              onClick={() => toggle(integ.id)}
              className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-all text-left ${
                selected
                  ? "border-primary/50 bg-primary/10"
                  : "border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06]"
              }`}
            >
              <span className="text-lg">{integ.icon}</span>
              <span className="flex-1 text-sm font-medium text-foreground">{integ.label}</span>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                selected ? "border-primary bg-primary" : "border-foreground/20"
              }`}>
                {selected && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
        <span className="text-sm mt-0.5">🔒</span>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Cada workspace tem conexões independentes. O Gmail deste workspace não se mistura com outros.
        </p>
      </div>
    </div>
  );
}

function StepAgents({ state, setState, templates }: { state: WizardState; setState: (s: Partial<WizardState>) => void; templates: DbTemplate[] }) {
  const recommended = useMemo(() => getRecommendedIds(templates, state.industry), [templates, state.industry]);
  const assistantTemplate = templates.find(t => t.category === "assistant");

  const toggle = (id: string) => {
    // "assistant" category is always on
    if (assistantTemplate && id === assistantTemplate.id) return;
    setState({
      selectedAgents: state.selectedAgents.includes(id)
        ? state.selectedAgents.filter(a => a !== id)
        : [...state.selectedAgents, id],
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground/70 leading-relaxed">
        Agentes recomendados com base no seu perfil. Você pode alterar depois.
      </p>

      <div className="space-y-2">
        {templates.map(agent => {
          const selected = state.selectedAgents.includes(agent.id);
          const isRecommended = recommended.includes(agent.id);
          const isAssistant = assistantTemplate && agent.id === assistantTemplate.id;

          return (
            <button
              key={agent.id}
              onClick={() => toggle(agent.id)}
              className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-all text-left ${
                selected
                  ? "border-primary/50 bg-primary/10"
                  : "border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.06]"
              }`}
            >
              <span className="text-lg">{agent.icon || "🤖"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{agent.name}</span>
                  {isAssistant && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">obrigatório</span>
                  )}
                  {isRecommended && !isAssistant && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">recomendado</span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground/70 block truncate">{agent.description}</span>
              </div>
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                selected ? "border-primary bg-primary" : "border-foreground/20"
              } ${isAssistant ? "opacity-50 cursor-not-allowed" : ""}`}>
                {selected && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN WIZARD
   ═══════════════════════════════════════════════════ */

const STEPS = [
  { title: "Identidade", subtitle: "Nome, tipo e visual" },
  { title: "Contexto", subtitle: "Setor e descrição" },
  { title: "Integrações", subtitle: "Serviços a conectar" },
  { title: "Agentes", subtitle: "IA personalizada" },
];

const WorkspaceOnboardingWizard: React.FC<Props> = ({ workspace, onComplete, onClose }) => {
  const { user } = useAuth();
  const { updateWorkspace } = useWorkspace();
  const { data: dbTemplates = [] } = useAgentTemplates();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);

  const [state, setStateRaw] = useState<WizardState>(() => {
    const defaultType: WsType = "company";
    return {
      name: workspace.name,
      type: defaultType,
      icon: workspace.icon || "🏢",
      color: workspace.color || "hsl(280, 80%, 50%)",
      industry: workspace.industry || "",
      description: workspace.description || "",
      role: "",
      pendingIntegrations: [],
      selectedAgents: [], // will be populated when templates load
    };
  });

  // Auto-select recommended agents when templates load
  React.useEffect(() => {
    if (dbTemplates.length > 0 && state.selectedAgents.length === 0) {
      const rec = getRecommendedIds(dbTemplates, state.industry || "Outro");
      setStateRaw(prev => ({ ...prev, selectedAgents: rec }));
    }
  }, [dbTemplates]);

  const setState = useCallback((partial: Partial<WizardState>) => {
    setStateRaw(prev => {
      const next = { ...prev, ...partial };
      if (("type" in partial || "industry" in partial) && dbTemplates.length > 0) {
        const rec = getRecommendedIds(dbTemplates, next.industry || "Outro");
        const assistantId = dbTemplates.find(t => t.category === "assistant")?.id;
        const kept = prev.selectedAgents.filter(id => id === assistantId);
        next.selectedAgents = [...new Set([...rec, ...kept])];
      }
      return next;
    });
  }, [dbTemplates]);

  const goNext = () => { setDirection(1); setStep(s => Math.min(s + 1, 3)); };
  const goPrev = () => { setDirection(-1); setStep(s => Math.max(s - 1, 0)); };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const contextSummary = buildContextSummary(state);
      await updateWorkspace(workspace.id, {
        name: state.name || workspace.name,
        icon: state.icon,
        color: state.color,
        description: state.description || undefined,
        industry: state.industry || undefined,
        context_summary: contextSummary || undefined,
        is_personal: state.type === "personal",
        onboarding_completed: true,
        metadata: {
          type: state.type,
          role: state.role,
          pending_integrations: state.pendingIntegrations,
        },
      } as Partial<Workspace>);

      // Create agent COPIES from DB templates (REGRA 1: workspace-scoped)
      const agentsToCreate = dbTemplates.filter(a => state.selectedAgents.includes(a.id));
      if (agentsToCreate.length > 0) {
        const rows = agentsToCreate.map(a => ({
          user_id: user.id,
          workspace_id: workspace.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          color: a.color,
          category: a.category,
          system_prompt: a.system_prompt,
          model: a.model,
          temperature: a.temperature,
          tools_enabled: a.tools_enabled,
          template_id: a.id,
          is_template: false,
          is_active: true,
        }));

        await (supabase as any).from("ai_agents").insert(rows);
      }

      toast.success("Perfil configurado com sucesso! 🎉");
      onComplete();
    } catch (err) {
      console.error("Onboarding error:", err);
      toast.error("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
  };

  const isLastStep = step === 3;
  const canProceed = step === 0 ? !!state.name.trim() : true;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg max-h-[90vh] mx-4 bg-background/95 backdrop-blur-2xl border border-border/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: `${state.color}22` }}>
              {state.icon}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Configurar perfil</h2>
              <p className="text-[11px] text-muted-foreground">{STEPS[step].subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-foreground/10 transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1.5 px-6 pb-4">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  i < step ? "bg-primary text-primary-foreground"
                  : i === step ? "bg-primary/20 text-primary ring-2 ring-primary/30"
                  : "bg-foreground/10 text-muted-foreground/50"
                }`}>
                  {i < step ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                <span className={`text-[10px] font-medium hidden sm:inline ${
                  i === step ? "text-foreground" : "text-muted-foreground/50"
                }`}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px transition-colors ${i < step ? "bg-primary/40" : "bg-foreground/10"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {step === 0 && <StepIdentity state={state} setState={setState} />}
              {step === 1 && <StepContext state={state} setState={setState} />}
              {step === 2 && <StepIntegrations state={state} setState={setState} />}
              {step === 3 && <StepAgents state={state} setState={setState} templates={dbTemplates} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-foreground/5">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={goPrev} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl hover:bg-foreground/5">
                <ChevronLeft className="w-3.5 h-3.5" /> Voltar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isLastStep && (
              <button
                onClick={goNext}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground px-3 py-2 rounded-xl hover:bg-foreground/5 transition-colors"
              >
                Pular
              </button>
            )}
            {isLastStep ? (
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-medium px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm"
              >
                {saving ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Concluir
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canProceed}
                className="flex items-center gap-1 text-xs font-medium px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                Próximo <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

export default WorkspaceOnboardingWizard;
