import React, { useState, useCallback, useMemo } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import GlassCard from "./GlassCard";
import WidgetTitle from "./WidgetTitle";
import WidgetEmptyState from "./WidgetEmptyState";
import { Target, Plus, X, Trash2, ExternalLink, Eye, EyeOff, TrendingUp, TrendingDown, CalendarClock, Sparkles, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDbFinances } from "@/hooks/finance/useDbFinances";
import { usePersistedWidget } from "@/hooks/ui/usePersistedWidget";
import { toast } from "sonner";

const QUICK_AMOUNTS = [100, 500, 1000];

/* ── Smart helpers ── */
function estimateCompletionDays(current: number, target: number, createdWeeksAgo: number): number | null {
  if (current >= target) return 0;
  if (current <= 0 || createdWeeksAgo <= 0) return null;
  const weeklyRate = current / createdWeeksAgo;
  if (weeklyRate <= 0) return null;
  const remaining = target - current;
  return Math.ceil((remaining / weeklyRate) * 7);
}

function getPaceLabel(pct: number, weeksActive: number): { label: string; color: string } {
  if (pct >= 100) return { label: "Concluída ✓", color: "text-primary" };
  if (weeksActive <= 0) return { label: "Recém-criada", color: "text-muted-foreground" };
  const expectedPctPerWeek = 100 / Math.max(weeksActive * 2, 4); // relaxed expectation
  const actualPctPerWeek = pct / weeksActive;
  if (actualPctPerWeek >= expectedPctPerWeek * 1.2) return { label: "Acima do ritmo", color: "text-primary" };
  if (actualPctPerWeek >= expectedPctPerWeek * 0.6) return { label: "No ritmo", color: "text-muted-foreground" };
  return { label: "Abaixo do ritmo", color: "text-destructive" };
}

function weeksAgo(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, diff / (7 * 24 * 60 * 60 * 1000));
}

const FinanceGoalsWidget = () => {
  const navigate = useNavigate();
  const { goals, addGoal, updateGoalAmount, deleteGoal, isLoading, transactions } = useDbFinances();
  const { data: contentHidden, save: saveContentHidden } = usePersistedWidget<boolean>({ key: "finance-goals-hidden", defaultValue: false });

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newCurrent, setNewCurrent] = useState("");
  const [customAmountId, setCustomAmountId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  const handleAdd = async () => {
    if (!newName.trim() || !newTarget) return;
    await addGoal(newName.trim(), parseFloat(newTarget), parseFloat(newCurrent) || 0);
    setNewName(""); setNewTarget(""); setNewCurrent(""); setAdding(false);
    toast.success("Meta criada!");
  };

  const handleQuickAdd = useCallback(async (id: string, amount: number) => {
    await updateGoalAmount(id, amount);
  }, [updateGoalAmount]);

  const handleCustomDeposit = useCallback(async (id: string) => {
    const val = parseFloat(customAmount);
    if (!val || val === 0) return;
    await updateGoalAmount(id, val);
    setCustomAmountId(null);
    setCustomAmount("");
  }, [customAmount, updateGoalAmount]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteGoal(id);
    toast.success("Meta excluída");
  }, [deleteGoal]);

  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const totalCurrent = goals.reduce((s, g) => s + g.current, 0);
  const totalPct = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  /* ── Smart insights ── */
  const monthSavings = useMemo(() => {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const income = transactions.filter(t => t.type === "income" && t.date >= monthStart).reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === "expense" && t.date >= monthStart).reduce((s, t) => s + Number(t.amount), 0);
    return income - expense;
  }, [transactions]);

  const suggestedDeposit = useMemo(() => {
    if (monthSavings <= 0 || goals.length === 0) return null;
    const activeGoals = goals.filter(g => g.current < g.target);
    if (activeGoals.length === 0) return null;
    return Math.round(monthSavings * 0.3 / activeGoals.length);
  }, [monthSavings, goals]);

  /* ── Popup content ── */
  const popupBody = (
    <div className="space-y-4">
      {/* Summary */}
      <div className="p-4 rounded-xl bg-foreground/5">
        <p className="text-xs text-muted-foreground mb-1">Total economizado</p>
        <p className="text-2xl font-bold text-foreground">
          R$ {totalCurrent.toLocaleString("pt-BR")}
          <span className="text-sm font-normal text-muted-foreground"> / {totalTarget.toLocaleString("pt-BR")}</span>
        </p>
        <div className="w-full bg-foreground/10 rounded-full h-2.5 mt-2">
          <div className="bg-primary h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(totalPct, 100)}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{Math.round(totalPct)}% do total</p>
      </div>

      {/* Smart tip */}
      {suggestedDeposit && suggestedDeposit > 0 && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-foreground">Sugestão inteligente</p>
            <p className="text-[11px] text-muted-foreground">
              Com base no seu saldo mensal (R$ {monthSavings.toLocaleString("pt-BR")}), sugerimos depositar ~R$ {suggestedDeposit.toLocaleString("pt-BR")} por meta ativa.
            </p>
          </div>
        </div>
      )}

      {/* Goal cards */}
      {goals.map(g => {
        const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
        const completed = pct >= 100;
        const barColor = completed ? "hsl(var(--destructive))" : g.color;
        const estDays = estimateCompletionDays(g.current, g.target, weeksAgo((g as any).created_at || new Date().toISOString()));
        const pace = getPaceLabel(pct, weeksAgo((g as any).created_at || new Date().toISOString()));

        return (
          <div key={g.id} className="p-4 rounded-xl bg-foreground/5 group">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">{g.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{Math.round(pct)}%</span>
                <button onClick={() => handleDelete(g.id)} className="opacity-0 group-hover:opacity-100 text-destructive/60 hover:text-destructive transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="w-full bg-foreground/10 rounded-full h-2 mb-2">
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
            </div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex gap-2 flex-wrap">
                {QUICK_AMOUNTS.map(amt => (
                  <button key={amt} onClick={() => handleQuickAdd(g.id, amt)} disabled={completed}
                    className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30">
                    +R${amt}
                  </button>
                ))}
                <button onClick={() => handleQuickAdd(g.id, -100)} disabled={g.current <= 0}
                  className="text-xs px-2 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-30">
                  <Minus className="w-3 h-3 inline" />R$100
                </button>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                R$ {g.current.toLocaleString("pt-BR")} / {g.target.toLocaleString("pt-BR")}
              </span>
            </div>
            {/* Smart indicators */}
            <div className="flex items-center gap-3 text-[10px]">
              <span className={pace.color}>
                {pct >= 50 ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
                {pace.label}
              </span>
              {estDays !== null && estDays > 0 && (
                <span className="text-muted-foreground">
                  <CalendarClock className="w-3 h-3 inline mr-0.5" />
                  ~{estDays < 30 ? `${estDays}d` : `${Math.round(estDays / 30)}m`} restantes
                </span>
              )}
            </div>
          </div>
        );
      })}

      {goals.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma meta criada. Use o botão + no widget.</p>
      )}
    </div>
  );

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <WidgetTitle label="Metas" icon={<Target className="w-3.5 h-3.5 text-emerald-400" />} popupIcon={<Target className="w-5 h-5 text-primary" />} popupContent={popupBody} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); saveContentHidden(!contentHidden); }} className="text-muted-foreground hover:text-primary transition-colors p-1" title={contentHidden ? "Mostrar" : "Esconder"}>
            {contentHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setAdding(!adding); }} className="text-primary hover:scale-110 transition-transform p-1">
            {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
          <DeshTooltip label="Ver tudo">
            <button onClick={(e) => { e.stopPropagation(); navigate("/finances"); }} className="text-muted-foreground hover:text-primary transition-colors p-1">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </DeshTooltip>
        </div>
      </div>

      {contentHidden ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground/60 italic">Conteúdo oculto</p>
        </div>
      ) : (
        <>
          {/* Overall progress */}
          {goals.length > 0 && (
            <div className="mb-3 shrink-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Total economizado</span>
                <span className="font-semibold text-foreground">
                  R$ {totalCurrent.toLocaleString("pt-BR")} / {totalTarget.toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="w-full bg-foreground/10 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(totalPct, 100)}%` }} />
              </div>
            </div>
          )}

          {/* Add form */}
          {adding && (
            <div className="mb-3 p-2.5 rounded-lg bg-foreground/5 space-y-2 shrink-0">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome da meta..."
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" autoFocus />
              <div className="flex gap-2">
                <input value={newTarget} onChange={e => setNewTarget(e.target.value)} placeholder="Valor alvo (R$)" type="number"
                  className="flex-1 bg-foreground/5 rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                <input value={newCurrent} onChange={e => setNewCurrent(e.target.value)} placeholder="Já economizou" type="number"
                  className="flex-1 bg-foreground/5 rounded px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
              </div>
              <button onClick={handleAdd} disabled={!newName.trim() || !newTarget}
                className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-40">
                Adicionar
              </button>
            </div>
          )}

          {/* Goals list */}
          <div className="space-y-2.5 flex-1 overflow-y-auto min-h-0 scrollbar-thin">
            {goals.length === 0 && !adding && !isLoading && (
              <WidgetEmptyState icon={Target} title="Sem metas" description="Crie metas financeiras para acompanhar" />
            )}
            {goals.map(g => {
              const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
              const completed = pct >= 100;
              const barColor = completed ? "hsl(var(--destructive))" : g.color;
              return (
                <div key={g.id} className="group">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-foreground/80 truncate flex-1">{g.name}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{Math.round(pct)}%</span>
                      <button onClick={() => handleDelete(g.id)} className="opacity-0 group-hover:opacity-100 text-destructive/50 hover:text-destructive transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="w-full bg-foreground/10 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <div className="flex gap-1 items-center">
                      <button onClick={() => handleQuickAdd(g.id, 100)} disabled={completed}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30">
                        +R$100
                      </button>
                      <button onClick={() => handleQuickAdd(g.id, 500)} disabled={completed}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30">
                        +R$500
                      </button>
                      {customAmountId === g.id ? (
                        <div className="flex items-center gap-0.5">
                          <input value={customAmount} onChange={e => setCustomAmount(e.target.value)} type="number" placeholder="R$"
                            className="w-14 bg-foreground/5 rounded px-1 py-0.5 text-[9px] text-foreground outline-none" autoFocus
                            onKeyDown={e => e.key === "Enter" && handleCustomDeposit(g.id)} />
                          <button onClick={() => handleCustomDeposit(g.id)} className="text-[9px] text-primary font-medium">OK</button>
                          <button onClick={() => { setCustomAmountId(null); setCustomAmount(""); }} className="text-[9px] text-muted-foreground">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setCustomAmountId(g.id)} disabled={completed}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground hover:bg-foreground/10 transition-colors disabled:opacity-30">
                          Outro
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      R$ {g.current.toLocaleString("pt-BR")} / {g.target.toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </GlassCard>
  );
};

export default React.memo(FinanceGoalsWidget);
