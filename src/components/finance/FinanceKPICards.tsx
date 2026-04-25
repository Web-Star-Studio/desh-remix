import { memo } from "react";
import { motion } from "framer-motion";
import { Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Percent, PiggyBank } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/components/finance/financeConstants";
const formatCompact = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return formatCurrency(value);
};

interface FinanceKPICardsProps {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  savingsRate: number;
  incomeChange: number | null;
  expenseChange: number | null;
  incomeCount: number;
  expenseCount: number;
  dailyTrend: Array<{ day: string; receita: number; despesa: number }>;
}

const KPIMiniCard = memo(({ label, value, prefix, suffix, accent, sub }: {
  label: string; value: string; prefix?: string; suffix?: string;
  accent: "green" | "red" | "blue" | "amber";
  sub?: React.ReactNode;
}) => {
  const accentMap = {
    green: "border-green-500/20",
    red: "border-red-500/20",
    blue: "border-primary/20",
    amber: "border-amber-500/20",
  };
  return (
    <div className={`glass-card rounded-xl border ${accentMap[accent]} p-2.5`}>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <p className="text-sm font-bold tabular-nums text-foreground mt-0.5">
        {prefix}{value}{suffix}
      </p>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
});
KPIMiniCard.displayName = "KPIMiniCard";

const ChangeIndicator = memo(({ change, invertColors }: { change: number | null; invertColors?: boolean }) => {
  if (change === null) return null;
  const isGood = invertColors ? change <= 0 : change >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold ${isGood ? "text-green-400" : "text-destructive"}`}>
      {change >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {change > 0 ? "+" : ""}{change.toFixed(0)}%
    </span>
  );
});
ChangeIndicator.displayName = "ChangeIndicator";

const FinanceKPICards = ({
  balance, totalIncome, totalExpense, savingsRate,
  incomeChange, expenseChange, incomeCount, expenseCount, dailyTrend,
}: FinanceKPICardsProps) => {
  const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;
  const ratioColor = expenseRatio > 100 ? "text-destructive" : expenseRatio > 80 ? "text-amber-400" : "text-green-400";
  const barColor = expenseRatio > 100 ? "bg-destructive" : expenseRatio > 80 ? "bg-amber-400" : "bg-green-400";

  return (
    <div className="mb-4 space-y-3">
      {/* Main row: Balance + Income + Expense */}
      <div className="grid grid-cols-3 gap-2">
        {/* Balance — hero card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-xl p-3 relative overflow-hidden"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Saldo</span>
          </div>
          <motion.p
            key={balance}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-lg sm:text-xl font-bold tabular-nums leading-tight ${balance >= 0 ? "text-foreground" : "text-destructive"}`}
          >
            {balance < 0 ? "-" : ""}R$ {formatCompact(Math.abs(balance))}
          </motion.p>
          {totalIncome > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[8px] text-muted-foreground mb-0.5">
                <span>Uso da receita</span>
                <span className={ratioColor}>{Math.round(expenseRatio)}%</span>
              </div>
              <div className="w-full h-1 rounded-full bg-foreground/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(expenseRatio, 100)}%` }}
                  transition={{ duration: 0.7 }}
                  className={`h-full rounded-full ${barColor}`}
                />
              </div>
            </div>
          )}
        </motion.div>

        {/* Income */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card rounded-xl p-3 relative overflow-hidden"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Receitas</span>
          </div>
          <motion.p key={totalIncome} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-lg sm:text-xl font-bold text-green-400 tabular-nums leading-tight">
            R$ {formatCompact(totalIncome)}
          </motion.p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] text-muted-foreground">{incomeCount} entrada{incomeCount !== 1 ? "s" : ""}</span>
            <ChangeIndicator change={incomeChange} />
          </div>
          {dailyTrend.some(d => d.receita > 0) && (
            <div className="mt-1.5 h-7 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend}>
                  <defs>
                    <linearGradient id="incSparkGradV2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(140,50%,50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(140,50%,50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="receita" stroke="hsl(140,50%,50%)" fill="url(#incSparkGradV2)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        {/* Expense */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-3 relative overflow-hidden"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Despesas</span>
          </div>
          <motion.p key={totalExpense} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-lg sm:text-xl font-bold text-destructive tabular-nums leading-tight">
            R$ {formatCompact(totalExpense)}
          </motion.p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] text-muted-foreground">{expenseCount} saída{expenseCount !== 1 ? "s" : ""}</span>
            <ChangeIndicator change={expenseChange} invertColors />
          </div>
          {dailyTrend.some(d => d.despesa > 0) && (
            <div className="mt-1.5 h-7 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend}>
                  <defs>
                    <linearGradient id="expSparkGradV2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(0,70%,55%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(0,70%,55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="despesa" stroke="hsl(0,70%,55%)" fill="url(#expSparkGradV2)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPIMiniCard
          label="Taxa de poupança"
          value={savingsRate.toFixed(0)}
          suffix="%"
          accent={savingsRate >= 20 ? "green" : savingsRate >= 10 ? "amber" : "red"}
          sub={<span className="text-[8px] text-muted-foreground">{savingsRate >= 20 ? "Excelente" : savingsRate >= 10 ? "Razoável" : "Atenção"}</span>}
        />
        <KPIMiniCard
          label="Média diária gasto"
          value={`R$ ${formatCompact(totalExpense / Math.max(dailyTrend.filter(d => d.despesa > 0).length, 1))}`}
          accent="blue"
          sub={<span className="text-[8px] text-muted-foreground">/dia</span>}
        />
        <KPIMiniCard
          label="Receita vs Despesa"
          value={totalIncome > 0 ? `${Math.round(expenseRatio)}%` : "—"}
          accent={expenseRatio <= 80 ? "green" : expenseRatio <= 100 ? "amber" : "red"}
          sub={<span className="text-[8px] text-muted-foreground">da receita usada</span>}
        />
        <KPIMiniCard
          label="Transações"
          value={`${incomeCount + expenseCount}`}
          accent="blue"
          sub={
            <span className="text-[8px] text-muted-foreground">
              {incomeCount} ↑ · {expenseCount} ↓
            </span>
          }
        />
      </div>
    </div>
  );
};

export default memo(FinanceKPICards);
