import { useMemo, memo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowRight, BarChart3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { formatCurrency } from "@/components/finance/financeConstants";
const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface CashflowComparisonChartProps {
  currentIncome: number;
  currentExpense: number;
  prevIncome: number | null;
  prevExpense: number | null;
  selectedMonth: string;
  dailyTrend: Array<{ day: string; receita: number; despesa: number }>;
  index?: number;
}

const CashflowComparisonChart = ({
  currentIncome, currentExpense, prevIncome, prevExpense, selectedMonth, dailyTrend, index = 3,
}: CashflowComparisonChartProps) => {
  const [year, month] = selectedMonth.split("-").map(Number);
  const prevMonthLabel = MONTH_NAMES_SHORT[(month - 2 + 12) % 12];
  const currMonthLabel = MONTH_NAMES_SHORT[month - 1];

  const comparisonData = useMemo(() => {
    if (prevIncome === null || prevExpense === null) return null;
    return [
      { name: prevMonthLabel, receita: prevIncome, despesa: prevExpense },
      { name: currMonthLabel, receita: currentIncome, despesa: currentExpense },
    ];
  }, [prevIncome, prevExpense, currentIncome, currentExpense, prevMonthLabel, currMonthLabel]);

  const cumulativeData = useMemo(() => {
    let cumIncome = 0;
    let cumExpense = 0;
    return dailyTrend.map((d: any) => {
      cumIncome += d.receita;
      cumExpense += d.despesa;
      return { day: d.day, receita: cumIncome, despesa: cumExpense, saldo: cumIncome - cumExpense };
    });
  }, [dailyTrend]);

  if (!comparisonData && cumulativeData.length === 0) return null;

  const incomeChange = prevIncome && prevIncome > 0
    ? ((currentIncome - prevIncome) / prevIncome) * 100 : null;
  const expenseChange = prevExpense && prevExpense > 0
    ? ((currentExpense - prevExpense) / prevExpense) * 100 : null;

  return (
    <AnimatedItem index={index}>
      <GlassCard size="auto" className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
            <p className="widget-title">Comparativo</p>
          </div>
          {comparisonData && (
            <span className="text-[9px] text-muted-foreground">{prevMonthLabel} → {currMonthLabel}</span>
          )}
        </div>

        {comparisonData && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-2.5 rounded-lg bg-foreground/[0.03] border border-foreground/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Receitas</span>
                {incomeChange !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${incomeChange >= 0 ? "text-green-400" : "text-destructive"}`}>
                    {incomeChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {incomeChange > 0 ? "+" : ""}{incomeChange.toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[9px] text-muted-foreground/60 line-through tabular-nums">
                  R$ {formatCurrency(prevIncome!)}
                </span>
                <span className="text-xs font-bold text-green-400 tabular-nums">
                  R$ {formatCurrency(currentIncome)}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-foreground/[0.03] border border-foreground/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Despesas</span>
                {expenseChange !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${expenseChange <= 0 ? "text-green-400" : "text-destructive"}`}>
                    {expenseChange <= 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
                    {expenseChange > 0 ? "+" : ""}{expenseChange.toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[9px] text-muted-foreground/60 line-through tabular-nums">
                  R$ {formatCurrency(prevExpense!)}
                </span>
                <span className="text-xs font-bold text-destructive tabular-nums">
                  R$ {formatCurrency(currentExpense)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Cumulative area chart */}
        {cumulativeData.length > 1 && (
          <div>
            <p className="text-[8px] text-muted-foreground uppercase tracking-widest mb-1.5 font-medium">Evolução acumulada</p>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeData}>
                  <defs>
                    <linearGradient id="cumIncGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(140,50%,50%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(140,50%,50%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cumExpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0,70%,55%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(0,70%,55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 10, padding: "6px 10px" }}
                    formatter={(val: number, name: string) => [`R$ ${formatCurrency(val)}`, name === "receita" ? "Receitas" : name === "despesa" ? "Despesas" : "Saldo"]}
                  />
                  <Area type="monotone" dataKey="receita" stroke="hsl(140,50%,50%)" fill="url(#cumIncGrad)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="despesa" stroke="hsl(0,70%,55%)" fill="url(#cumExpGrad)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-1">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: "hsl(140,50%,50%)" }} />
                <span className="text-[8px] text-muted-foreground">Receitas</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: "hsl(0,70%,55%)" }} />
                <span className="text-[8px] text-muted-foreground">Despesas</span>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </AnimatedItem>
  );
};

export default memo(CashflowComparisonChart);
