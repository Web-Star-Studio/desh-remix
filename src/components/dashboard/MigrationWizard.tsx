import { useState, useEffect, useCallback } from "react";
import { useWorkspace, type Workspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, ArrowRight, ArrowLeft, Database, Sparkles, ListTodo, StickyNote, Users, FolderOpen, Wallet, FileText, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CategoryInfo {
  key: string;
  table: string;
  label: string;
  icon: React.ElementType;
  emoji: string;
  count: number;
  targetWsId: string;
}

const CATEGORIES: Omit<CategoryInfo, "count" | "targetWsId">[] = [
  { key: "tasks", table: "tasks", label: "Tarefas", icon: ListTodo, emoji: "📋" },
  { key: "user_data", table: "user_data", label: "Notas & Eventos", icon: StickyNote, emoji: "📝" },
  { key: "contacts", table: "contacts", label: "Contatos", icon: Users, emoji: "👥" },
  { key: "finance_transactions", table: "finance_transactions", label: "Transações", icon: Wallet, emoji: "💰" },
  { key: "finance_goals", table: "finance_goals", label: "Metas financeiras", icon: FileText, emoji: "🎯" },
  { key: "finance_recurring", table: "finance_recurring", label: "Recorrências", icon: FileText, emoji: "🔄" },
];

type Step = "scan" | "assign" | "confirm" | "migrating" | "done";

const MigrationWizard = () => {
  const { user } = useAuth();
  const { workspaces } = useWorkspace();
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("scan");
  const [migratingIndex, setMigratingIndex] = useState(-1);
  const [dismissed, setDismissed] = useState(false);

  const loadCounts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        CATEGORIES.map(cat =>
          supabase
            .from(cat.table as any)
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .is("workspace_id", null)
        )
      );

      const defaultWs = workspaces.find(w => w.is_default);
      const cats: CategoryInfo[] = CATEGORIES.map((cat, i) => ({
        ...cat,
        count: results[i].count || 0,
        targetWsId: defaultWs?.id || "",
      }));

      setCategories(cats);
    } catch (err) {
      console.error("Error loading unassigned counts:", err);
    } finally {
      setLoading(false);
    }
  }, [user, workspaces]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const withItems = categories.filter(c => c.count > 0);
  const totalUnassigned = withItems.reduce((acc, c) => acc + c.count, 0);
  const allAssigned = withItems.every(c => c.targetWsId !== "");

  const setTarget = (key: string, wsId: string) => {
    setCategories(prev =>
      prev.map(c => (c.key === key ? { ...c, targetWsId: wsId } : c))
    );
  };

  const setAllTargets = (wsId: string) => {
    setCategories(prev => prev.map(c => (c.count > 0 ? { ...c, targetWsId: wsId } : c)));
  };

  const handleMigrate = async () => {
    if (!user) return;
    setStep("migrating");
    try {
      for (let i = 0; i < withItems.length; i++) {
        const cat = withItems[i];
        if (!cat.targetWsId) continue;
        setMigratingIndex(i);
        const { error } = await supabase
          .from(cat.table as any)
          .update({ workspace_id: cat.targetWsId } as any)
          .eq("user_id", user.id)
          .is("workspace_id", null);
        if (error) console.error(`Error migrating ${cat.table}:`, error);
      }
      toast({ title: "Migração concluída! ✨", description: "Todos os dados foram organizados nos perfis escolhidos." });
      setStep("done");
      loadCounts();
    } catch (err) {
      console.error("Migration error:", err);
      toast({ title: "Erro", description: "Falha na migração.", variant: "destructive" });
      setStep("assign");
    }
  };

  const getWsName = (wsId: string) => {
    const ws = workspaces.find(w => w.id === wsId);
    return ws ? `${ws.icon} ${ws.name}` : "—";
  };

  if (dismissed || loading) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3 h-3 animate-spin" /> Verificando dados...
        </div>
      );
    }
    return null;
  }

  if (totalUnassigned === 0) {
    return step === "done" ? (
      <div className="flex items-center gap-2 text-xs text-primary py-2">
        <CheckCircle2 className="w-3.5 h-3.5" /> Todos os dados estão organizados em perfis!
      </div>
    ) : null;
  }

  return (
    <div className="mt-4 rounded-xl border border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-primary/5 border-b border-primary/10">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Database className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Wizard de Migração</p>
          <p className="text-[10px] text-muted-foreground">
            {totalUnassigned} ite{totalUnassigned !== 1 ? "ns" : "m"} sem perfil
          </p>
        </div>
        {step === "scan" && (
          <button
            onClick={() => setDismissed(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Depois
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* STEP: SCAN */}
        {step === "scan" && (
          <motion.div
            key="scan"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-4 space-y-3"
          >
            <p className="text-xs text-muted-foreground">
              Encontramos dados antigos sem perfil. Vamos organizá-los?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {withItems.map(cat => {
                const Icon = cat.icon;
                return (
                  <div key={cat.key} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-foreground/[0.03]">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-foreground">{cat.count}</span>
                    <span className="text-[10px] text-muted-foreground">{cat.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep("assign")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Organizar agora
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP: ASSIGN */}
        {step === "assign" && (
          <motion.div
            key="assign"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Escolha o destino de cada categoria:</p>
              {workspaces.length > 0 && (
                <select
                  onChange={e => e.target.value && setAllTargets(e.target.value)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-foreground/5 border border-foreground/10 text-muted-foreground"
                  defaultValue=""
                >
                  <option value="" disabled>Aplicar a todos...</option>
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>{ws.icon} {ws.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              {withItems.map(cat => {
                const Icon = cat.icon;
                return (
                  <div key={cat.key} className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-foreground/[0.03] hover:bg-foreground/[0.05] transition-colors">
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{cat.label}</p>
                      <p className="text-[10px] text-muted-foreground">{cat.count} ite{cat.count !== 1 ? "ns" : "m"}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                    <select
                      value={cat.targetWsId}
                      onChange={e => setTarget(cat.key, e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-foreground/5 border border-foreground/10 text-xs text-foreground min-w-[120px]"
                    >
                      <option value="">Selecione...</option>
                      {workspaces.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.icon} {ws.name}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep("scan")}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-foreground/5 hover:bg-foreground/10 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Voltar
              </button>
              <button
                onClick={() => setStep("confirm")}
                disabled={!allAssigned}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Revisar <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP: CONFIRM */}
        {step === "confirm" && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="p-4 space-y-3"
          >
            <p className="text-xs font-medium text-foreground">Confirme a migração:</p>
            <div className="space-y-1.5">
              {withItems.map(cat => (
                <div key={cat.key} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-foreground/[0.03]">
                  <span>{cat.emoji}</span>
                  <span className="font-medium text-foreground">{cat.count} {cat.label.toLowerCase()}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
                  <span className="text-muted-foreground">{getWsName(cat.targetWsId)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setStep("assign")}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-foreground/5 hover:bg-foreground/10 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Alterar
              </button>
              <button
                onClick={handleMigrate}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar migração
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP: MIGRATING */}
        {step === "migrating" && (
          <motion.div
            key="migrating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 space-y-3"
          >
            <p className="text-xs font-medium text-foreground">Migrando dados...</p>
            <div className="space-y-1.5">
              {withItems.map((cat, i) => (
                <div key={cat.key} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-foreground/[0.03]">
                  {i < migratingIndex ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                  ) : i === migratingIndex ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-foreground/20" />
                  )}
                  <span className={i <= migratingIndex ? "text-foreground font-medium" : "text-muted-foreground"}>
                    {cat.label}
                  </span>
                  <span className="text-muted-foreground/60 ml-auto">{cat.count}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* STEP: DONE */}
        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 text-center space-y-2"
          >
            <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
            <p className="text-sm font-semibold text-foreground">Migração concluída!</p>
            <p className="text-xs text-muted-foreground">Todos os seus dados estão organizados nos perfis escolhidos.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MigrationWizard;
