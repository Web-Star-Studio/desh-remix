import { useMemo } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import type { YearlyMonthSummary } from "@/hooks/finance/useDbFinances";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/components/finance/financeConstants";
interface YearlySummaryProps {
  yearlySummary: YearlyMonthSummary[];
  yearlyTotals: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    avgMonthly: number;
    bestMonth: YearlyMonthSummary;
    worstMonth: YearlyMonthSummary;
  };
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  isLoading: boolean;
}

export default function YearlySummary({ yearlySummary, yearlyTotals, selectedYear, setSelectedYear, isLoading }: YearlySummaryProps) {
  const chartData = useMemo(() => {
    let accumulated = 0;
    return yearlySummary.map(m => {
      accumulated += m.balance;
      return { ...m, accumulated };
    });
  }, [yearlySummary]);

  const hasData = yearlySummary.some(m => m.income > 0 || m.expense > 0);

  if (isLoading) {
    return (
      <GlassCard className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* Year navigator */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full">
          <button onClick={() => setSelectedYear(selectedYear - 1)} className="text-foreground/60 hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-foreground min-w-[60px] text-center">{selectedYear}</span>
          <button
            onClick={() => { if (selectedYear < new Date().getFullYear()) setSelectedYear(selectedYear + 1); }}
            className="text-foreground/60 hover:text-foreground transition-colors disabled:opacity-30"
            disabled={selectedYear >= new Date().getFullYear()}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Totals cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <AnimatedItem index={0}>
          <GlassCard>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita anual</p>
            <p className="text-lg font-bold text-green-400 mt-1">R$ {formatCurrency(yearlyTotals.totalIncome)}</p>
          </GlassCard>
        </AnimatedItem>
        <AnimatedItem index={1}>
          <GlassCard>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Despesa anual</p>
            <p className="text-lg font-bold text-red-400 mt-1">R$ {formatCurrency(yearlyTotals.totalExpense)}</p>
          </GlassCard>
        </AnimatedItem>
        <AnimatedItem index={2}>
          <GlassCard>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo anual</p>
            <p className={`text-lg font-bold mt-1 ${yearlyTotals.balance >= 0 ? "text-foreground" : "text-red-400"}`}>
              R$ {formatCurrency(yearlyTotals.balance)}
            </p>
          </GlassCard>
        </AnimatedItem>
        <AnimatedItem index={3}>
          <GlassCard>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Média mensal</p>
            <p className="text-lg font-bold text-foreground mt-1">R$ {formatCurrency(yearlyTotals.avgMonthly)}</p>
          </GlassCard>
        </AnimatedItem>
      </div>

      {/* Best/Worst month highlight */}
      {hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AnimatedItem index={4}>
            <GlassCard className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Melhor mês</p>
                <p className="text-sm font-bold text-foreground">{yearlyTotals.bestMonth.label}</p>
                <p className="text-[10px] text-green-400">Saldo: R$ {formatCurrency(yearlyTotals.bestMonth.balance)}</p>
              </div>
            </GlassCard>
          </AnimatedItem>
          <AnimatedItem index={5}>
            <GlassCard className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pior mês</p>
                <p className="text-sm font-bold text-foreground">{yearlyTotals.worstMonth.label}</p>
                <p className="text-[10px] text-red-400">Saldo: R$ {formatCurrency(yearlyTotals.worstMonth.balance)}</p>
              </div>
            </GlassCard>
          </AnimatedItem>
        </div>
      )}

      {/* Chart */}
      <AnimatedItem index={6}>
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary/60" />
            <p className="widget-title">Comparativo mensal</p>
          </div>
          {hasData ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = { income: "Receita", expense: "Despesa", accumulated: "Saldo acumulado" };
                      return [`R$ ${formatCurrency(value)}`, labels[name] || name];
                    }}
                  />
                  <Bar dataKey="income" fill="hsl(140, 50%, 50%)" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="expense" fill="hsl(0, 70%, 55%)" radius={[4, 4, 0, 0]} barSize={16} />
                  <Line type="monotone" dataKey="accumulated" stroke="hsl(220, 60%, 55%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(220, 60%, 55%)" }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ background: "hsl(140, 50%, 50%)" }} /> Receitas
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ background: "hsl(0, 70%, 55%)" }} /> Despesas
                </span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ background: "hsl(220, 60%, 55%)" }} /> Saldo acumulado
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-xs text-muted-foreground">Sem transações em {selectedYear}</p>
            </div>
          )}
        </GlassCard>
      </AnimatedItem>

      {/* Table */}
      {hasData && (
        <AnimatedItem index={7}>
          <GlassCard className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Mês</TableHead>
                  <TableHead className="text-xs text-right">Receita</TableHead>
                  <TableHead className="text-xs text-right">Despesa</TableHead>
                  <TableHead className="text-xs text-right">Saldo</TableHead>
                  <TableHead className="text-xs text-right">Variação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearlySummary.map((m, i) => {
                  const prev = i > 0 ? yearlySummary[i - 1] : null;
                  const variation = prev && prev.balance !== 0
                    ? ((m.balance - prev.balance) / Math.abs(prev.balance)) * 100
                    : null;

                  return (
                    <TableRow key={m.month} className={m.income === 0 && m.expense === 0 ? "opacity-40" : ""}>
                      <TableCell className="text-xs font-medium">{m.label}</TableCell>
                      <TableCell className="text-xs text-right text-green-400">R$ {formatCurrency(m.income)}</TableCell>
                      <TableCell className="text-xs text-right text-red-400">R$ {formatCurrency(m.expense)}</TableCell>
                      <TableCell className={`text-xs text-right font-medium ${m.balance >= 0 ? "text-foreground" : "text-red-400"}`}>
                        R$ {formatCurrency(m.balance)}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {variation !== null ? (
                          <span className={`inline-flex items-center gap-0.5 ${variation >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {variation >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(variation).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </GlassCard>
        </AnimatedItem>
      )}
    </div>
  );
}
