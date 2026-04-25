import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, X, Trash2, Target } from "lucide-react";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import GlassCard from "@/components/dashboard/GlassCard";
import MoveToWorkspace from "@/components/dashboard/MoveToWorkspace";
import InvestmentsPortfolio from "@/components/finance/InvestmentsPortfolio";
import CreditCardBillsCard from "@/components/finance/CreditCardBillsCard";
import LoansCard from "@/components/finance/LoansCard";
import { formatCurrency } from "@/components/finance/financeConstants";

interface InvestmentsTabProps {
  investments: any[];
  obAccounts: any[];
  loans: any[];
  goals: any[];
  onAddGoal: (name: string, target: number, current: number) => Promise<void>;
  onUpdateGoalAmount: (id: string, amount: number) => void;
  onDeleteGoal: (id: string) => void;
  isWidgetEnabled: (id: string) => boolean;
}

const InvestmentsTab = ({
  investments, obAccounts, loans, goals,
  onAddGoal, onUpdateGoalAmount, onDeleteGoal,
  isWidgetEnabled,
}: InvestmentsTabProps) => {
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalCurrent, setGoalCurrent] = useState("");

  const handleAddGoal = async () => {
    if (!goalName.trim() || !goalTarget) return;
    await onAddGoal(goalName.trim(), parseFloat(goalTarget), parseFloat(goalCurrent) || 0);
    setGoalName(""); setGoalTarget(""); setGoalCurrent("");
    setShowAddGoal(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-3"
    >
      {/* Investments Portfolio */}
      {isWidgetEnabled("inv_portfolio") && (
        <InvestmentsPortfolio investments={investments} />
      )}

      {/* Credit Card Bills */}
      {isWidgetEnabled("inv_portfolio") && (
        <CreditCardBillsCard accounts={obAccounts} />
      )}

      {/* Loans */}
      {isWidgetEnabled("inv_loans") && (
        <LoansCard loans={loans} />
      )}

      {/* Goals */}
      {isWidgetEnabled("inv_goals") && (
        <AnimatedItem index={3}>
          <GlassCard size="auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="widget-title">Metas financeiras</p>
              </div>
              <button onClick={() => setShowAddGoal(!showAddGoal)} className="text-primary hover:scale-110 transition-transform">
                {showAddGoal ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
            {showAddGoal && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="overflow-hidden">
                <div className="mb-3 p-3 rounded-xl bg-foreground/5 border border-foreground/10 space-y-2">
                  <input value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="Nome da meta..."
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" autoFocus />
                  <div className="flex gap-2">
                    <input value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="Alvo (R$)" type="number"
                      className="flex-1 bg-foreground/5 rounded-lg px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                    <input value={goalCurrent} onChange={e => setGoalCurrent(e.target.value)} placeholder="Atual" type="number"
                      className="flex-1 bg-foreground/5 rounded-lg px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none" />
                  </div>
                  <button onClick={handleAddGoal} className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors">
                    Criar meta
                  </button>
                </div>
              </motion.div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[400px] overflow-y-auto scrollbar-thin pr-0.5">
              {goals.map(goal => {
                const pct = goal.target ? Math.min(Math.round((goal.current / goal.target) * 100), 100) : 0;
                const isDone = pct >= 100;
                const isNearDone = pct >= 80 && pct < 100;
                const remaining = Math.max(0, Number(goal.target) - Number(goal.current));
                return (
                  <div key={goal.id} className="group p-2.5 rounded-xl bg-foreground/[0.03] border border-foreground/8 hover:border-foreground/15 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{goal.name}</p>
                        {isDone && <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/20 text-green-400 font-bold flex-shrink-0">✓</span>}
                        {isNearDone && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold flex-shrink-0">🔥</span>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={`text-[10px] font-bold tabular-nums ${isDone ? "text-green-400" : isNearDone ? "text-amber-400" : "text-muted-foreground"}`}>{pct}%</span>
                        <MoveToWorkspace table="finance_goals" itemId={goal.id} currentWorkspaceId={goal.workspace_id} />
                        <button onClick={() => onDeleteGoal(goal.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden mb-1">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }}
                        className="h-full rounded-full" style={{ background: isDone ? "hsl(140,50%,50%)" : goal.color || "hsl(var(--primary))" }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground tabular-nums">R$ {formatCurrency(Number(goal.current))} / R$ {formatCurrency(Number(goal.target))}</span>
                      {!isDone && remaining > 0 && <span className="text-[8px] text-muted-foreground">Faltam R$ {formatCurrency(remaining)}</span>}
                    </div>
                    {!isDone && (
                      <div className="flex gap-1 mt-1.5">
                        {[100, 500, 1000].map(amt => (
                          <button key={amt} onClick={() => onUpdateGoalAmount(goal.id, amt)}
                            className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-semibold">
                            +R${amt >= 1000 ? "1k" : amt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {goals.length === 0 && !showAddGoal && (
                <div className="flex flex-col items-center justify-center py-8 text-center col-span-full">
                  <Target className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma meta criada</p>
                </div>
              )}
            </div>
          </GlassCard>
        </AnimatedItem>
      )}
    </motion.div>
  );
};

export default InvestmentsTab;
