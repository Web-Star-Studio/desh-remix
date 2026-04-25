import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { Plus, Zap, Play, History, Search, X, ChevronDown, ArrowRight, ChevronRight, Sparkles, LayoutTemplate, FlaskConical, ToggleLeft, ToggleRight, Info, Download, Upload, Shield, Wand2, TrendingUp, Clock, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import WidgetEmptyState from "@/components/dashboard/WidgetEmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useAutomations, TRIGGER_TYPES, ACTION_TYPES, TEMPLATES, exportRulesAsJson, parseImportedRules, type AutomationRule } from "@/hooks/automation/useAutomations";
import { useAutomationEngine } from "@/hooks/automation/useAutomationEngine";
import AutomationRuleCard from "@/components/automations/AutomationRuleCard";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import pandoraAvatar from "@/assets/pandora-avatar.png";

// Lazy-loaded heavy components
const AutomationAIChat = lazy(() => import("@/components/automations/AutomationAIChat"));
const TriggerConfigForm = lazy(() => import("@/components/automations/AutomationConfigForms").then(m => ({ default: m.TriggerConfigForm })));
const ActionConfigForm = lazy(() => import("@/components/automations/AutomationConfigForms").then(m => ({ default: m.ActionConfigForm })));

const FormFallback = () => <div className="py-2 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

type StatusFilter = "all" | "active" | "paused";

const AutomationsPage = () => {
  const { rules, logs, isLoading, createRule, createMultipleRules, updateRule, deleteRule, toggleRule, duplicateRule } = useAutomations();
  const { executeAction } = useAutomationEngine();
  const [showCreate, setShowCreate] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [search, setSearch] = useState("");
  const [filterTrigger, setFilterTrigger] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<string | null>(null);
  const [logStatusFilter, setLogStatusFilter] = useState<"all" | "success" | "error">("all");
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 20;
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [showAiChat, setShowAiChat] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  // Auto-collapse templates when user has rules
  useEffect(() => {
    if (rules.length > 0 && !isLoading) setTemplatesOpen(false);
  }, [rules.length, isLoading]);

  // Create/Edit form state
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<string>(TRIGGER_TYPES[0].value);
  const [actionType, setActionType] = useState<string>(ACTION_TYPES[0].value);
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [actionConfig, setActionConfig] = useState<Record<string, any>>({});

  const resetForm = useCallback(() => {
    setName(""); setTriggerType(TRIGGER_TYPES[0].value); setActionType(ACTION_TYPES[0].value); setTriggerConfig({}); setActionConfig({});
  }, []);

  const handleCreate = useCallback(() => {
    if (!name.trim()) { toast.error("Dê um nome para sua automação"); return; }
    if (editingRule) {
      updateRule.mutate({ id: editingRule.id, name: name.trim(), trigger_type: triggerType, trigger_config: triggerConfig, action_type: actionType, action_config: actionConfig });
    } else {
      createRule.mutate({ name: name.trim(), enabled: true, trigger_type: triggerType, trigger_config: triggerConfig, action_type: actionType, action_config: actionConfig });
    }
    setShowCreate(false);
    setEditingRule(null);
    resetForm();
  }, [name, editingRule, triggerType, triggerConfig, actionType, actionConfig, updateRule, createRule, resetForm]);

  const startEdit = useCallback((rule: AutomationRule) => {
    setEditingRule(rule); setName(rule.name); setTriggerType(rule.trigger_type); setActionType(rule.action_type);
    setTriggerConfig(rule.trigger_config || {}); setActionConfig(rule.action_config || {}); setShowCreate(true);
  }, []);

  const applyTemplate = useCallback((tpl: typeof TEMPLATES[number]) => {
    setEditingRule(null); setName(tpl.name); setTriggerType(tpl.trigger_type); setTriggerConfig(tpl.trigger_config);
    setActionType(tpl.action_type); setActionConfig(tpl.action_config); setShowCreate(true);
  }, []);

  const handleTestRule = useCallback(async (rule: AutomationRule) => {
    setTestingId(rule.id);
    try {
      const sampleData: Record<string, any> = {
        contact_name: "João Silva", contact_id: "test", score: "25", days_since: "14",
        sender: "teste@exemplo.com", subject: "Assunto de teste", title: "Item de teste",
        name: "Teste Automação", amount: "1500", description: "Transação simulada",
        date: new Date().toLocaleDateString("pt-BR"), habit_name: "Leitura", check_hour: "20", days_overdue: "3",
      };
      const result = await executeAction(rule, sampleData, false);
      if (result?.success) toast.success("Execução real OK", { description: result.message });
      else toast.error("Falha na execução", { description: result?.message });
    } catch { toast.error("Erro ao executar automação"); }
    finally { setTestingId(null); }
  }, [executeAction]);

  const handleBulkToggle = useCallback((enabled: boolean) => {
    const toToggle = filteredRules.filter(r => r.enabled !== enabled);
    if (toToggle.length === 0) return;
    for (const r of toToggle) toggleRule.mutate({ id: r.id, enabled });
    toast.success(`${toToggle.length} automação(ões) ${enabled ? "ativada(s)" : "pausada(s)"}`);
  }, [toggleRule]);

  const handleExport = useCallback(() => {
    const json = exportRulesAsJson(rules);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `automacoes-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rules.length} automação(ões) exportada(s)`);
  }, [rules]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = parseImportedRules(ev.target?.result as string);
        if (imported.length === 0) { toast.error("Nenhuma automação encontrada no arquivo"); return; }
        createMultipleRules.mutate(imported);
      } catch (err) { toast.error("Erro ao importar", { description: String(err) }); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [createMultipleRules]);

  // AI handlers
  const handleAiSave = useCallback((automation: any, enabled: boolean) => {
    createRule.mutate({ name: automation.name || "Automação via IA", enabled, trigger_type: automation.trigger_type, trigger_config: automation.trigger_config || {}, action_type: automation.action_type, action_config: automation.action_config || {} });
  }, [createRule]);

  const handleAiEdit = useCallback((automation: any) => {
    setEditingRule(null); setName(automation.name || ""); setTriggerType(automation.trigger_type);
    setTriggerConfig(automation.trigger_config || {}); setActionType(automation.action_type);
    setActionConfig(automation.action_config || {}); setShowCreate(true); setShowAiChat(false);
  }, []);

  const TEMPLATE_CATEGORIES = useMemo(() => [
    { value: "all", label: "Todos" }, { value: "pandora", label: "🤖 Pandora IA" }, { value: "crm", label: "CRM" }, { value: "produtividade", label: "Produtividade" },
    { value: "email", label: "Email" }, { value: "financas", label: "Finanças" }, { value: "habitos", label: "Hábitos" },
    { value: "rotina", label: "Rotina" }, { value: "whatsapp", label: "WhatsApp" },
  ], []);

  const filteredTemplates = useMemo(() => templateCategory === "all" ? TEMPLATES : TEMPLATES.filter((t: any) => t.category === templateCategory), [templateCategory]);
  const triggerInfo = useCallback((type: string) => TRIGGER_TYPES.find(t => t.value === type), []);
  const actionInfo = useCallback((type: string) => ACTION_TYPES.find(a => a.value === type), []);

  // Stats
  const stats = useMemo(() => {
    const totalExecs = rules.reduce((s, r) => s + r.execution_count, 0);
    const successLogs = logs.filter(l => l.status === "success").length;
    const errorLogs = logs.filter(l => l.status === "error").length;
    const successRate = logs.length > 0 ? Math.round((successLogs / logs.length) * 100) : 100;
    const activeRules = rules.filter(r => r.enabled).length;
    const pausedRules = rules.length - activeRules;
    const lastExec = rules.reduce<string | null>((latest, r) => (!r.last_executed_at ? latest : !latest || r.last_executed_at > latest ? r.last_executed_at : latest), null);
    return { totalExecs, successRate, activeRules, pausedRules, errorLogs, lastExec };
  }, [rules, logs]);

  const filteredRules = useMemo(() => {
    let result = rules;
    if (search) { const q = search.toLowerCase(); result = result.filter(r => r.name.toLowerCase().includes(q) || r.trigger_type.includes(q) || r.action_type.includes(q)); }
    if (filterTrigger) result = result.filter(r => r.trigger_type === filterTrigger);
    if (filterStatus === "active") result = result.filter(r => r.enabled);
    else if (filterStatus === "paused") result = result.filter(r => !r.enabled);
    return [...result].sort((a, b) => { if (a.enabled !== b.enabled) return a.enabled ? -1 : 1; return (b.last_executed_at || b.created_at).localeCompare(a.last_executed_at || a.created_at); });
  }, [rules, search, filterTrigger, filterStatus]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (logFilter) result = result.filter(l => l.rule_id === logFilter);
    if (logStatusFilter !== "all") result = result.filter(l => l.status === logStatusFilter);
    return result;
  }, [logs, logFilter, logStatusFilter]);
  const totalLogPages = Math.ceil(filteredLogs.length / LOG_PAGE_SIZE);
  const paginatedLogs = useMemo(() => filteredLogs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE), [filteredLogs, logPage]);

  const showCreateRef = useRef(showCreate);
  showCreateRef.current = showCreate;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); setEditingRule(null); resetForm(); setShowCreate(true); }
      if (e.key === "/" && !showCreateRef.current) { e.preventDefault(); document.getElementById("auto-search")?.focus(); }
      if (e.key === "Escape" && showCreateRef.current) { setShowCreate(false); setEditingRule(null); resetForm(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [resetForm]);

  const selectClasses = "w-full px-3 py-2 rounded-xl bg-muted/50 border border-border/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <PageLayout maxWidth="full">
      <PageHeader
        title="Automações"
        icon={<Zap className="w-6 h-6 text-primary drop-shadow" />}
        subtitle={rules.length > 0 ? `${stats.activeRules} ativa(s) de ${rules.length}${stats.lastExec ? ` • última execução ${formatDistanceToNow(new Date(stats.lastExec), { addSuffix: true, locale: ptBR })}` : ""}` : undefined}
        actions={
          <div className="flex gap-1 sm:gap-2 flex-wrap justify-end">
            {rules.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleExport} className="text-white/70 hover:text-white hover:bg-white/15 backdrop-blur-sm press-scale px-2 sm:px-3">
                      <Download className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Exportar automações (JSON)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => importRef.current?.click()} className="text-white/70 hover:text-white hover:bg-white/15 backdrop-blur-sm press-scale px-2 sm:px-3">
                      <Upload className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Importar automações (JSON)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <Button variant="ghost" size="sm" onClick={() => setShowLogs(!showLogs)} className="text-white/70 hover:text-white hover:bg-white/15 backdrop-blur-sm press-scale px-2 sm:px-3">
              <History className="w-4 h-4" /> <span className="hidden sm:inline">Log</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAiChat(!showAiChat)} className="text-white/70 hover:text-white hover:bg-white/15 backdrop-blur-sm press-scale px-2 sm:px-3">
              <Wand2 className="w-4 h-4" /> <span className="hidden sm:inline">IA</span>
            </Button>
            <Button size="sm" onClick={() => { setEditingRule(null); resetForm(); setShowCreate(!showCreate); }} className="press-scale">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nova</span>
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {/* Stats strip */}
        {rules.length > 0 && (
          <AnimatedItem index={0}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Ativas", value: stats.activeRules, sub: `de ${rules.length}`, icon: <Play className="w-4 h-4" />, color: "text-primary", bg: "bg-primary/10" },
                { label: "Execuções", value: stats.totalExecs, sub: stats.lastExec ? `última ${formatDistanceToNow(new Date(stats.lastExec), { addSuffix: true, locale: ptBR })}` : "nenhuma", icon: <Zap className="w-4 h-4" />, color: "text-amber-500", bg: "bg-amber-500/10" },
                { label: "Taxa sucesso", value: `${stats.successRate}%`, sub: `${logs.length} log(s)`, icon: <Shield className="w-4 h-4" />, color: "text-green-500", bg: "bg-green-500/10" },
                { label: "Erros", value: stats.errorLogs, sub: stats.errorLogs > 0 ? "verificar logs" : "tudo ok", icon: <X className="w-4 h-4" />, color: stats.errorLogs > 0 ? "text-destructive" : "text-muted-foreground", bg: stats.errorLogs > 0 ? "bg-destructive/10" : "bg-muted/30" },
              ].map((s, i) => (
                <GlassCard key={i} size="auto">
                  <div className="flex items-center gap-3 py-1.5">
                    <div className={`p-2 rounded-xl ${s.bg}`}><span className={s.color}>{s.icon}</span></div>
                    <div>
                      <p className="text-xl font-bold text-foreground leading-tight">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground/50 truncate">{s.sub}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </AnimatedItem>
        )}

        {/* Search & Filter bar */}
        {rules.length > 2 && !showCreate && (
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input id="auto-search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar automações... ( / )" className="pl-9 rounded-xl bg-muted/50 border-border/30" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["all", "active", "paused"] as StatusFilter[]).map(s => {
                const labels: Record<StatusFilter, string> = { all: "Todas", active: `Ativas (${stats.activeRules})`, paused: `Pausadas (${stats.pausedRules})` };
                return (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1.5 rounded-full text-xs transition-colors ${filterStatus === s ? "bg-primary/20 text-primary font-medium" : "bg-muted/50 text-muted-foreground hover:bg-muted/70"}`}>
                    {labels[s]}
                  </button>
                );
              })}
              <span className="w-px h-5 bg-border/30 mx-0.5 self-center" />
              {TRIGGER_TYPES.filter(t => rules.some(r => r.trigger_type === t.value)).map(t => (
                <button key={t.value} onClick={() => setFilterTrigger(filterTrigger === t.value ? null : t.value)}
                  className={`px-2.5 py-1.5 rounded-full text-xs transition-colors ${filterTrigger === t.value ? "bg-primary/20 text-primary font-medium" : "bg-muted/50 text-muted-foreground hover:bg-muted/70"}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {filteredRules.length > 1 && (
              <TooltipProvider>
                <div className="flex gap-1 ml-auto">
                  <Tooltip><TooltipTrigger asChild>
                    <button onClick={() => handleBulkToggle(true)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"><ToggleRight className="w-4 h-4" /></button>
                  </TooltipTrigger><TooltipContent>Ativar todas</TooltipContent></Tooltip>
                  <Tooltip><TooltipTrigger asChild>
                    <button onClick={() => handleBulkToggle(false)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-destructive transition-colors"><ToggleLeft className="w-4 h-4" /></button>
                  </TooltipTrigger><TooltipContent>Pausar todas</TooltipContent></Tooltip>
                </div>
              </TooltipProvider>
            )}
          </div>
        )}

        {/* AI Chat Panel */}
        <AnimatePresence>
          {showAiChat && (
            <Suspense fallback={<FormFallback />}>
              <AutomationAIChat
                onClose={() => setShowAiChat(false)}
                onSave={handleAiSave}
                onEdit={handleAiEdit}
              />
            </Suspense>
          )}
        </AnimatePresence>

        {/* Empty state — enhanced with AI CTA */}
        {!isLoading && rules.length === 0 && !showCreate && !showAiChat && (
          <AnimatedItem index={0}>
            <GlassCard size="auto">
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Automatize sua rotina</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Crie regras que executam ações automaticamente quando eventos acontecem — emails, tarefas, contatos, finanças e mais.
                  </p>
                </div>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={() => setShowAiChat(true)} className="gap-2">
                    <img src={pandoraAvatar} alt="" className="w-4 h-4 rounded-full" />
                    Criar com a Pandora
                  </Button>
                  <Button variant="secondary" onClick={() => { setEditingRule(null); resetForm(); setShowCreate(true); }} className="gap-2">
                    <Plus className="w-4 h-4" /> Criar manualmente
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground/60">ou escolha um template abaixo ↓</p>
              </div>
            </GlassCard>
          </AnimatedItem>
        )}

        {/* Templates - collapsible */}
        {!showCreate && !showAiChat && (
          <AnimatedItem index={rules.length === 0 ? 1 : 0}>
            <GlassCard size="auto">
              <button onClick={() => setTemplatesOpen(!templatesOpen)} className="w-full flex items-center gap-2 text-left">
                <LayoutTemplate className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground flex-1">Templates prontos</p>
                <span className="text-xs text-muted-foreground mr-1">{TEMPLATES.length} disponíveis</span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${templatesOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {templatesOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <p className="text-xs text-muted-foreground mt-1 mb-2">Comece com uma automação pré-configurada</p>
                    <div className="flex gap-1 flex-wrap mb-3">
                      {TEMPLATE_CATEGORIES.map(cat => (
                        <button key={cat.value} onClick={() => setTemplateCategory(cat.value)}
                          className={`px-2 py-1 rounded-full text-[11px] transition-colors ${templateCategory === cat.value ? "bg-primary/20 text-primary font-medium" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"}`}>
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    <div className={`grid gap-2 ${rules.length > 0 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-2"}`}>
                      {filteredTemplates.map((tpl, i) => (
                        <button key={i} onClick={() => applyTemplate(tpl)}
                          className="flex items-center gap-3 p-3 rounded-xl transition-all text-left group/tpl hover:scale-[1.01] bg-muted/40 hover:bg-muted/60 border border-border/20">
                          <span className="text-lg">{triggerInfo(tpl.trigger_type)?.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{tpl.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              {triggerInfo(tpl.trigger_type)?.label}
                              <ArrowRight className="w-3 h-3 inline-block opacity-50" />
                              {actionInfo(tpl.action_type)?.label}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover/tpl:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          </AnimatedItem>
        )}

        {/* Create/Edit form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <GlassCard size="auto">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{editingRule ? "Editar Automação" : "Nova Automação"}</p>
                </div>
                <div className="space-y-4">
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da automação"
                    className="rounded-xl bg-muted/50 border-border/30" autoFocus />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Trigger */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-bold">1</span>
                        Quando...
                      </p>
                      <select value={triggerType} onChange={e => { setTriggerType(e.target.value); setTriggerConfig({}); }} className={selectClasses}>
                        {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label} — {t.desc}</option>)}
                      </select>
                      <Suspense fallback={<FormFallback />}>
                        <TriggerConfigForm triggerType={triggerType} triggerConfig={triggerConfig} setTriggerConfig={setTriggerConfig} selectClasses={selectClasses} />
                      </Suspense>
                    </div>

                    {/* Action */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">2</span>
                        Então...
                      </p>
                      <select value={actionType} onChange={e => { setActionType(e.target.value); setActionConfig({}); }} className={selectClasses}>
                        {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.icon} {a.label} — {a.desc}</option>)}
                      </select>
                      <Suspense fallback={<FormFallback />}>
                        <ActionConfigForm actionType={actionType} actionConfig={actionConfig} setActionConfig={setActionConfig} selectClasses={selectClasses} />
                      </Suspense>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/10">
                    <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground/70">Variáveis disponíveis:</span>{" "}
                      {"{{greeting}}, {{user_name}}, {{date}}, {{tasks_today}}, {{events_today}}, {{habits_pending}}, {{finance_summary}}, {{task_count}}, {{event_count}}, {{contact_name}}, {{score}}, {{days_since}}, {{sender}}, {{subject}}, {{title}}, {{amount}}, {{description}}, {{habit_name}}, {{days_overdue}}, {{message}}"}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border/20">
                    <Button onClick={handleCreate} disabled={!name.trim() || createRule.isPending || updateRule.isPending}>
                      {editingRule ? "Salvar alterações" : "Criar automação"}
                    </Button>
                    <Button variant="ghost" onClick={() => { setShowCreate(false); setEditingRule(null); resetForm(); }}>Cancelar</Button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rules list */}
        {isLoading ? (
          <GlassCard size="auto">
            <div className="space-y-3 py-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-3 w-2/5" /></div>
                  <Skeleton className="w-10 h-5 rounded-full" />
                </div>
              ))}
            </div>
          </GlassCard>
        ) : filteredRules.length > 0 ? (
          <AnimatedItem index={1}>
            <GlassCard size="auto">
              <p className="text-sm font-semibold text-foreground mb-3">
                Suas automações {search || filterTrigger || filterStatus !== "all" ? `(${filteredRules.length} de ${rules.length})` : ""}
              </p>
              <div className="space-y-2">
                {filteredRules.map(rule => (
                  <AutomationRuleCard
                    key={rule.id}
                    rule={rule}
                    onToggle={() => toggleRule.mutate({ id: rule.id, enabled: !rule.enabled })}
                    onDelete={() => {
                      if (deletingId === rule.id) { deleteRule.mutate(rule.id); setDeletingId(null); }
                      else { setDeletingId(rule.id); setTimeout(() => setDeletingId(null), 3000); }
                    }}
                    onEdit={() => startEdit(rule)}
                    onDuplicate={() => duplicateRule.mutate(rule)}
                    onViewLogs={() => { setLogFilter(rule.id); setShowLogs(true); }}
                    onTest={() => handleTestRule(rule)}
                    isTesting={testingId === rule.id}
                    isDeleting={deletingId === rule.id}
                  />
                ))}
              </div>
            </GlassCard>
          </AnimatedItem>
        ) : rules.length > 0 && (search || filterTrigger || filterStatus !== "all") ? (
          <AnimatedItem index={1}>
            <GlassCard size="auto">
              <WidgetEmptyState icon={Search} title="Nenhum resultado" description="Tente outro filtro ou termo de busca" />
            </GlassCard>
          </AnimatedItem>
        ) : null}

        {/* Logs */}
        <AnimatePresence>
          {showLogs && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <GlassCard size="auto">
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground flex-1">Log de execuções {logFilter ? "(filtrado)" : ""}</p>
                  <div className="flex gap-1">
                    {(["all", "success", "error"] as const).map(s => (
                      <button key={s} onClick={() => { setLogStatusFilter(s); setLogPage(1); }}
                        className={`px-2 py-1 rounded-full text-[10px] transition-colors ${logStatusFilter === s ? "bg-primary/20 text-primary font-medium" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"}`}>
                        {s === "all" ? "Todos" : s === "success" ? "✓ Ok" : "✕ Erro"}
                      </button>
                    ))}
                  </div>
                  {logFilter && <button onClick={() => { setLogFilter(null); setLogPage(1); }} className="text-xs text-primary hover:underline flex items-center gap-1"><X className="w-3 h-3" /> Limpar filtro</button>}
                  <button onClick={() => setShowLogs(false)} className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground" aria-label="Fechar logs"><X className="w-4 h-4" /></button>
                </div>
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <History className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground font-medium">Nenhum log encontrado</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {logStatusFilter !== "all" ? "Tente outro filtro de status" : "As automações ainda não foram executadas"}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                      {paginatedLogs.map(log => {
                        const rule = rules.find(r => r.id === log.rule_id);
                        const isExpanded = expandedLogId === log.id;
                        return (
                          <div key={log.id}>
                            <button onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors text-xs text-left">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === "success" ? "bg-green-500" : "bg-destructive"}`} />
                              <span className="text-foreground/70 truncate flex-1">{rule?.name || "Regra removida"}</span>
                              {(log.action_result as any)?.detail && (
                                <span className="text-muted-foreground/50 truncate max-w-[150px] hidden sm:inline">{(log.action_result as any).detail}</span>
                              )}
                              <span className="text-muted-foreground flex-shrink-0">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}</span>
                              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <div className="ml-4 p-2.5 mt-1 rounded-xl bg-background/50 border border-border/20 text-xs space-y-1.5">
                                    <div><span className="text-muted-foreground font-medium">Status: </span><span className={log.status === "success" ? "text-green-500" : "text-destructive"}>{log.status}</span></div>
                                    {(log.action_result as any)?.detail && <div><span className="text-muted-foreground font-medium">Detalhe: </span><span className="text-foreground/70">{(log.action_result as any).detail}</span></div>}
                                    {Object.keys(log.trigger_data || {}).length > 0 && (
                                      <div><span className="text-muted-foreground font-medium">Dados do gatilho:</span><pre className="mt-1 text-foreground/60 whitespace-pre-wrap break-all bg-muted/30 rounded-lg p-2">{JSON.stringify(log.trigger_data, null, 2)}</pre></div>
                                    )}
                                    {Object.keys(log.action_result || {}).length > 0 && (
                                      <div><span className="text-muted-foreground font-medium">Resultado:</span><pre className="mt-1 text-foreground/60 whitespace-pre-wrap break-all bg-muted/30 rounded-lg p-2">{JSON.stringify(log.action_result, null, 2)}</pre></div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                    {totalLogPages > 1 && (
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/20">
                        <p className="text-[10px] text-muted-foreground">{filteredLogs.length} log(s) • Página {logPage}/{totalLogPages}</p>
                        <div className="flex gap-1">
                          <button onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logPage <= 1}
                            className="px-2 py-1 rounded-lg text-xs bg-muted/50 text-muted-foreground hover:bg-muted/70 disabled:opacity-30">Anterior</button>
                          <button onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))} disabled={logPage >= totalLogPages}
                            className="px-2 py-1 rounded-lg text-xs bg-muted/50 text-muted-foreground hover:bg-muted/70 disabled:opacity-30">Próxima</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-muted-foreground text-center mt-2">Ctrl+N nova automação • / buscar • Esc cancelar</p>
      </div>
    </PageLayout>
  );
};

export default AutomationsPage;
