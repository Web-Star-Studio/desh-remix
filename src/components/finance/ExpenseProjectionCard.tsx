import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { formatCurrency } from "@/components/finance/financeConstants";
interface ExpenseProjectionCardProps {
  selectedMonth: string;
  totalIncome: number;
  totalExpense: number;
  index?: number;
}

const ExpenseProjectionCard = ({ selectedMonth, totalIncome, totalExpense, index = 3.2 }: ExpenseProjectionCardProps) => {
  const [year, month] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const daysPassed = year === today.getFullYear() && month === today.getMonth() + 1
    ? today.getDate() : daysInMonth;
  const projectedExpense = daysPassed > 0 ? (totalExpense / daysPassed) * daysInMonth : 0;
  const projectedIncome = daysPassed > 0 ? (totalIncome / daysPassed) * daysInMonth : 0;
  const projectedBalance = projectedIncome - projectedExpense;
  const remainingBudget = totalIncome - totalExpense;
  const dailyRemaining = remainingBudget > 0 && daysInMonth - daysPassed > 0
    ? remainingBudget / (daysInMonth - daysPassed) : 0;

  return (
    <AnimatedItem index={index} className="mb-4">
      <GlassCard size="auto">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-amber-400/15 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="widget-title">Projeção mensal</p>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded-xl bg-foreground/5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Despesas proj.</p>
              <p className="text-lg font-bold text-destructive tabular-nums">R$ {formatCurrency(projectedExpense)}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-foreground/5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Saldo proj.</p>
              <p className={`text-lg font-bold tabular-nums ${projectedBalance >= 0 ? "text-green-400" : "text-destructive"}`}>
                R$ {formatCurrency(Math.abs(projectedBalance))}
              </p>
            </div>
          </div>
          {daysPassed < daysInMonth && remainingBudget > 0 && (
            <div className="p-2.5 rounded-xl bg-green-500/5 border border-green-500/10">
              <p className="text-[10px] text-green-400/80">
                💡 Você pode gastar <span className="font-bold text-green-400">R$ {formatCurrency(dailyRemaining)}/dia</span> nos próximos {daysInMonth - daysPassed} dias para fechar no positivo.
              </p>
            </div>
          )}
          <div className="w-full h-1.5 rounded-full bg-foreground/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((daysPassed / daysInMonth) * 100, 100)}%` }}
              transition={{ duration: 0.7 }}
              className="h-full rounded-full bg-primary"
            />
          </div>
          <p className="text-[9px] text-muted-foreground text-center">
            Dia {daysPassed}/{daysInMonth} ({Math.round((daysPassed / daysInMonth) * 100)}% do mês)
          </p>
        </div>
      </GlassCard>
    </AnimatedItem>
  );
};

export default ExpenseProjectionCard;
