import { useState, useEffect, useMemo } from "react";
import AgentSkillsSelect from "./AgentSkillsSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, RotateCcw, Sparkles } from "lucide-react";
import { useAgentTemplates } from "@/components/ai/AgentTemplateLibrary";
import type { AIAgent } from "@/hooks/ai/useAIAgents";

/* ═══════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════ */

const MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", desc: "Rápido e eficiente para tarefas do dia a dia" },
  { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro", desc: "Melhor raciocínio e análise complexa" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Bom equilíbrio entre velocidade e qualidade" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Máximo desempenho com contexto grande" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano", desc: "Ultra rápido, ideal para tarefas simples" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", desc: "Versátil com bom custo-benefício" },
  { value: "openai/gpt-5", label: "GPT-5", desc: "Alta precisão para tarefas complexas" },
  { value: "openai/gpt-5.2", label: "GPT-5.2", desc: "Máximo raciocínio e resolução de problemas" },
];

const ICONS = ["🤖", "💻", "✍️", "📊", "🧠", "🎨", "🔬", "📚", "🚀", "💡", "🎯", "🛡️", "🌟", "💰", "🤝", "📣", "💬", "📋", "🖥️", "⚖️", "👥"];
const COLORS = [
  "hsl(35, 80%, 50%)", "hsl(220, 80%, 50%)", "hsl(150, 60%, 40%)",
  "hsl(280, 70%, 50%)", "hsl(0, 70%, 50%)", "hsl(45, 90%, 50%)",
  "hsl(180, 60%, 40%)", "hsl(330, 70%, 50%)", "hsl(30, 90%, 50%)",
  "hsl(340, 80%, 50%)", "hsl(200, 80%, 50%)", "hsl(315, 70%, 50%)",
];

const TOOL_GROUPS: { label: string; tools: { id: string; label: string }[] }[] = [
  {
    label: "Tarefas & Agenda",
    tools: [
      { id: "create_task", label: "Criar tarefa" },
      { id: "list_tasks", label: "Listar tarefas" },
      { id: "create_event", label: "Criar evento" },
      { id: "list_events", label: "Listar eventos" },
      { id: "set_reminder", label: "Lembrete" },
    ],
  },
  {
    label: "Email",
    tools: [
      { id: "send_email", label: "Enviar email" },
      { id: "search_emails", label: "Buscar emails" },
      { id: "draft_reply", label: "Rascunho resposta" },
    ],
  },
  {
    label: "Contatos & WhatsApp",
    tools: [
      { id: "search_contacts", label: "Buscar contatos" },
      { id: "create_contact", label: "Criar contato" },
      { id: "send_whatsapp", label: "Enviar WhatsApp" },
    ],
  },
  {
    label: "Finanças",
    tools: [
      { id: "list_transactions", label: "Transações" },
      { id: "finance_summary", label: "Resumo financeiro" },
      { id: "budget_check", label: "Checar orçamento" },
    ],
  },
  {
    label: "Pesquisa & Memória",
    tools: [
      { id: "web_search", label: "Pesquisa web" },
      { id: "deep_research", label: "Pesquisa profunda" },
      { id: "search_files", label: "Buscar arquivos" },
      { id: "memory_save", label: "Salvar memória" },
      { id: "memory_recall", label: "Recordar memória" },
    ],
  },
  {
    label: "Outros",
    tools: [
      { id: "analytics_summary", label: "Resumo analytics" },
    ],
  },
];

const CATEGORIES = [
  { value: "assistant", label: "Assistente" },
  { value: "finance", label: "Finanças" },
  { value: "sales", label: "Comercial" },
  { value: "marketing", label: "Marketing" },
  { value: "support", label: "Atendimento" },
  { value: "manager", label: "Gestão" },
  { value: "dev", label: "Desenvolvimento" },
  { value: "writer", label: "Redação" },
  { value: "analyst", label: "Análise" },
  { value: "consultant", label: "Estratégia" },
  { value: "legal", label: "Jurídico" },
  { value: "hr", label: "RH" },
];

/* ═══════════════════════════════════════════════════
   PRESETS (for quick new agent creation)
   ═══════════════════════════════════════════════════ */

interface AgentPreset {
  name: string;
  icon: string;
  description: string;
  system_prompt: string;
  model: string;
  temperature: number;
  color: string;
}

const PRESETS: AgentPreset[] = [
  {
    name: "Assistente de Código",
    icon: "💻",
    description: "Especialista em programação e debugging",
    system_prompt: "Você é um programador sênior expert. Responda sempre com código limpo, bem comentado e explicações técnicas claras.",
    model: "google/gemini-3-flash-preview",
    temperature: 0.3,
    color: "hsl(220, 80%, 50%)",
  },
  {
    name: "Redator Criativo",
    icon: "✍️",
    description: "Criação de textos, posts e conteúdo",
    system_prompt: "Você é um redator criativo e versátil. Produza textos envolventes, persuasivos e bem estruturados.",
    model: "google/gemini-3-flash-preview",
    temperature: 0.8,
    color: "hsl(35, 80%, 50%)",
  },
];

/* ═══════════════════════════════════════════════════
   EXTENDED AGENT INTERFACE (with new fields)
   ═══════════════════════════════════════════════════ */

interface ExtendedAgent extends AIAgent {
  category?: string | null;
  tools_enabled?: string[] | null;
  is_active?: boolean | null;
  template_id?: string | null;
}

interface AgentFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (agent: Record<string, any>) => void;
  initial?: Partial<ExtendedAgent>;
}

const AgentForm = ({ open, onClose, onSave, initial }: AgentFormProps) => {
  const { data: templates = [] } = useAgentTemplates();

  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt || "");
  const [icon, setIcon] = useState(initial?.icon || "🤖");
  const [color, setColor] = useState(initial?.color || "hsl(35, 80%, 50%)");
  const [model, setModel] = useState(initial?.model || "google/gemini-3-flash-preview");
  const [temperature, setTemperature] = useState(initial?.temperature ?? 0.7);
  const [category, setCategory] = useState(initial?.category || "");
  const [toolsEnabled, setToolsEnabled] = useState<string[]>(initial?.tools_enabled || []);
  const [isActive, setIsActive] = useState(initial?.is_active !== false);
  const [skillIds, setSkillIds] = useState<string[]>(initial?.skills || []);
  const [showPresets, setShowPresets] = useState(!initial?.id);

  const templateSource = useMemo(() => {
    if (!initial?.template_id) return null;
    return templates.find(t => t.id === initial.template_id) || null;
  }, [initial?.template_id, templates]);

  useEffect(() => {
    setName(initial?.name || "");
    setDescription(initial?.description || "");
    setSystemPrompt(initial?.system_prompt || "");
    setIcon(initial?.icon || "🤖");
    setColor(initial?.color || "hsl(35, 80%, 50%)");
    setModel(initial?.model || "google/gemini-3-flash-preview");
    setTemperature(initial?.temperature ?? 0.7);
    setCategory(initial?.category || "");
    setToolsEnabled(initial?.tools_enabled || []);
    setIsActive(initial?.is_active !== false);
    setSkillIds(initial?.skills || []);
    setShowPresets(!initial?.id);
  }, [initial, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    // Validate max 5 skills
    const finalSkills = skillIds.slice(0, 5);
    onSave({
      name,
      description,
      system_prompt: systemPrompt,
      icon,
      color,
      model,
      temperature,
      category: category || null,
      tools_enabled: toolsEnabled.length > 0 ? toolsEnabled : null,
      skills: finalSkills.length > 0 ? finalSkills : null,
      is_active: isActive,
    });
    onClose();
  };

  const handleRestoreTemplate = () => {
    if (!templateSource) return;
    setName(templateSource.name);
    setDescription(templateSource.description || "");
    setSystemPrompt(templateSource.system_prompt || "");
    setIcon(templateSource.icon || "🤖");
    setColor(templateSource.color || "hsl(35, 80%, 50%)");
    setModel(templateSource.model);
    setTemperature(templateSource.temperature);
    setCategory(templateSource.category || "");
    setToolsEnabled(templateSource.tools_enabled || []);
  };

  const applyPreset = (preset: AgentPreset) => {
    setName(preset.name);
    setDescription(preset.description);
    setSystemPrompt(preset.system_prompt);
    setIcon(preset.icon);
    setColor(preset.color);
    setModel(preset.model);
    setTemperature(preset.temperature);
    setShowPresets(false);
  };

  const toggleTool = (toolId: string) => {
    setToolsEnabled(prev =>
      prev.includes(toolId) ? prev.filter(t => t !== toolId) : [...prev, toolId]
    );
  };

  const tempLabel = temperature <= 0.3 ? "Preciso" : temperature <= 0.6 ? "Equilibrado" : temperature <= 0.8 ? "Criativo" : "Aleatório";
  const selectedModel = MODELS.find(m => m.value === model);
  const estimatedTokens = Math.ceil((systemPrompt.length) / 4);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto overflow-x-visible">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{initial?.id ? "Editar Agente" : "Novo Agente"}</DialogTitle>
            {initial?.id && (
              <div className="flex items-center gap-2">
                <Label htmlFor="agent-active" className="text-xs text-muted-foreground">Ativo</Label>
                <Switch id="agent-active" checked={isActive} onCheckedChange={setIsActive} />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Template badge */}
        {templateSource && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[11px] text-muted-foreground">
                Baseado em <strong className="text-foreground">{templateSource.name}</strong>
              </span>
            </div>
            <button
              onClick={handleRestoreTemplate}
              className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Restaurar padrão
            </button>
          </div>
        )}

        {/* Presets */}
        {showPresets && !initial?.id && (
          <div className="space-y-2 mb-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Começar com um modelo pronto:</p>
              <button onClick={() => setShowPresets(false)} className="text-xs text-primary hover:underline">Criar do zero</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(preset => (
                <button key={preset.name} onClick={() => applyPreset(preset)}
                  className="text-left p-3 rounded-xl border border-border/30 bg-muted/30 hover:bg-muted/50 transition-colors space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{preset.icon}</span>
                    <span className="text-xs font-medium text-foreground">{preset.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Icon picker */}
          <div>
            <Label className="text-xs text-muted-foreground">Ícone</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {ICONS.map(i => (
                <button key={i} onClick={() => setIcon(i)}
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${icon === i ? "ring-2 ring-primary scale-110" : "hover:bg-accent"}`}>{i}</button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="agent-name">Nome</Label>
            <Input id="agent-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Assistente de Código" />
          </div>

          {/* Color picker */}
          <div>
            <Label className="text-xs text-muted-foreground">Cor</Label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-primary scale-110" : ""}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="z-[9999]" position="popper" sideOffset={4}>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="agent-desc">Descrição</Label>
            <Input id="agent-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Uma breve descrição do agente" />
          </div>

          {/* System Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="agent-prompt">System Prompt</Label>
              <span className="text-xs text-muted-foreground">{systemPrompt.length} chars · ~{estimatedTokens} tokens</span>
            </div>
            <Textarea id="agent-prompt" value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Instruções personalizadas para o agente..."
              rows={5} />
          </div>

          {/* Model */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Label>Modelo</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">Cada modelo tem características diferentes de velocidade, custo e capacidade.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9999]" position="popper" sideOffset={4} align="start">
                {MODELS.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    <div className="flex flex-col">
                      <span>{m.label}</span>
                      <span className="text-xs text-muted-foreground">{m.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedModel && (
              <p className="text-xs text-muted-foreground mt-1">💡 {selectedModel.desc}</p>
            )}
          </div>

          {/* Temperature */}
          <div>
            <Label>Temperatura: {temperature.toFixed(1)} <span className="text-muted-foreground text-xs">({tempLabel})</span></Label>
            <Slider value={[temperature]} onValueChange={([v]) => setTemperature(v)} min={0} max={1} step={0.1} className="mt-2" />
          </div>

          {/* Skills */}
          <AgentSkillsSelect
            selectedSkillIds={skillIds}
            onChange={setSkillIds}
          />

          {/* Tools */}
          <div>
            <Label className="mb-2 block">Tools habilitados</Label>
            <div className="space-y-3">
              {TOOL_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{group.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tools.map(tool => {
                      const enabled = toolsEnabled.includes(tool.id);
                      return (
                        <button
                          key={tool.id}
                          onClick={() => toggleTool(tool.id)}
                          className={`text-[11px] px-2 py-1 rounded-lg border transition-all ${
                            enabled
                              ? "border-primary/40 bg-primary/10 text-primary font-medium"
                              : "border-border/30 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          {tool.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentForm;
