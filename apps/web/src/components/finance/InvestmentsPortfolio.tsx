import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, BarChart3, ChevronRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { AnimatePresence } from "framer-motion";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import InvestmentTransactionsPanel from "./InvestmentTransactionsPanel";
import type { FinancialInvestment } from "@/types/finance";
import { formatCurrency } from "@/components/finance/financeConstants";

const PIE_COLORS = [
  "hsl(220, 60%, 55%)", "hsl(140, 50%, 50%)", "hsl(35, 80%, 55%)",
  "hsl(280, 50%, 55%)", "hsl(0, 0%, 60%)", "hsl(0, 70%, 55%)", "hsl(180, 50%, 50%)",
];

interface InvestmentsPortfolioProps {
  investments: FinancialInvestment[];
  index?: number;
}

const InvestmentsPortfolio = ({ investments, index = 9 }: InvestmentsPortfolioProps) => {
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
  const selectedInv = investments.find(i => i.id === selectedInvId);
  const totalInvestments = investments.reduce((s, i) => s + (i.current_value || 0), 0);
  const totalCostBasis = investments.reduce((s, i) => s + (i.cost_basis || 0), 0);
  const investmentReturn = totalCostBasis > 0 ? ((totalInvestments - totalCostBasis) / totalCostBasis) * 100 : 0;

  const investmentAllocation = useMemo(() => {
    const typeMap = new Map<string, number>();
    for (const inv of investments) {
      const type = inv.type || "Outro";
      typeMap.set(type, (typeMap.get(type) || 0) + (inv.current_value || 0));
    }
    return Array.from(typeMap.entries()).map(([name, value], i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: PIE_COLORS[i % PIE_COLORS.length],
    })).sort((a, b) => b.value - a.value);
  }, [investments]);

  if (investments.length === 0) return null;

  const typeLabels: Record<string, string> = {
    fund: "Fundo", stock: "Ação", fixed_income: "Renda Fixa", etf: "ETF",
    structured_note: "COE", pension: "Previdência", other: "Outro",
  };

  return (
    <AnimatedItem index={index} className="mt-3">
      <GlassCard size="auto" className="max-h-[500px] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <p className="widget-title">Investimentos</p>
            <span className="text-[10px] text-muted-foreground">({investments.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground tabular-nums">
              R$ {formatCurrency(totalInvestments)}
            </span>
            {totalCostBasis > 0 && (
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${investmentReturn >= 0 ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
                {investmentReturn >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(investmentReturn).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {investmentAllocation.length > 1 && (
          <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-foreground/5 border border-foreground/8">
            <div className="w-20 h-20 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={investmentAllocation} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={35} innerRadius={20} paddingAngle={3}>
                    {investmentAllocation.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">Alocação por tipo</p>
              {investmentAllocation.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-foreground/70 flex-1">{item.name}</span>
                  <span className="text-muted-foreground tabular-nums">R$ {formatCurrency(item.value)}</span>
                  <span className="text-muted-foreground tabular-nums w-8 text-right">
                    {totalInvestments > 0 ? Math.round((item.value / totalInvestments) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {investments.map(inv => {
            const returnPct = inv.cost_basis && inv.cost_basis > 0 && inv.current_value
              ? ((inv.current_value - inv.cost_basis) / inv.cost_basis) * 100
              : null;
            return (
              <button
                key={inv.id}
                onClick={() => setSelectedInvId(selectedInvId === inv.id ? null : inv.id)}
                className={`p-3 rounded-xl border transition-colors text-left ${
                  selectedInvId === inv.id
                    ? "border-primary/30 bg-primary/5"
                    : "border-foreground/10 bg-foreground/5 hover:border-foreground/20"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{inv.name || "Investimento"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {inv.ticker && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/8 text-muted-foreground font-mono">{inv.ticker}</span>
                      )}
                      <span className="text-[9px] text-muted-foreground">{typeLabels[inv.type || "other"] || inv.type}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      R$ {formatCurrency(inv.current_value || 0)}
                    </p>
                    {returnPct !== null && (
                      <p className={`text-[10px] font-semibold tabular-nums ${returnPct >= 0 ? "text-green-400" : "text-destructive"}`}>
                        {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  {inv.quantity ? (
                    <p className="text-[9px] text-muted-foreground">
                      {inv.quantity} cotas • Custo: R$ {formatCurrency(inv.cost_basis || 0)}
                    </p>
                  ) : <span />}
                  <span className="text-[9px] text-primary flex items-center gap-0.5">
                    <ChevronRight className="w-2.5 h-2.5" /> Movimentações
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Investment Transactions Panel */}
        <AnimatePresence>
          {selectedInvId && selectedInv && (
            <InvestmentTransactionsPanel
              investmentId={selectedInvId}
              investmentName={selectedInv.name || undefined}
              onClose={() => setSelectedInvId(null)}
            />
          )}
        </AnimatePresence>
      </GlassCard>
    </AnimatedItem>
  );
};

export default InvestmentsPortfolio;
