import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Landmark, PiggyBank, CreditCard, BarChart3 } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";
import { formatCurrency } from "@/components/finance/financeConstants";

interface NetWorthCardProps {
  bankAccounts: Array<{ type: string | null; current_balance: number | null; name: string | null }>;
  totalInvestments: number;
  balance: number; // monthly balance
  index?: number;
}

const NetWorthCard = ({ bankAccounts, totalInvestments, balance, index = 0 }: NetWorthCardProps) => {
  const breakdown = useMemo(() => {
    const checking = bankAccounts.filter(a => a.type === "checking").reduce((s, a) => s + (a.current_balance || 0), 0);
    const savings = bankAccounts.filter(a => a.type === "savings").reduce((s, a) => s + (a.current_balance || 0), 0);
    const creditUsed = bankAccounts.filter(a => a.type === "credit_card").reduce((s, a) => s + Math.abs(a.current_balance || 0), 0);

    const assets = checking + savings + totalInvestments;
    const liabilities = creditUsed;
    const netWorth = assets - liabilities;

    return { checking, savings, creditUsed, assets, liabilities, netWorth };
  }, [bankAccounts, totalInvestments]);

  // Only show if there's actual data
  if (breakdown.assets === 0 && breakdown.liabilities === 0) return null;

  const items = [
    { label: "Conta corrente", value: breakdown.checking, icon: Landmark, color: "text-blue-400", bg: "bg-blue-500/15" },
    { label: "Poupança", value: breakdown.savings, icon: PiggyBank, color: "text-green-400", bg: "bg-green-500/15" },
    { label: "Investimentos", value: totalInvestments, icon: BarChart3, color: "text-violet-400", bg: "bg-violet-500/15" },
    { label: "Cartão de crédito", value: -breakdown.creditUsed, icon: CreditCard, color: "text-rose-400", bg: "bg-rose-500/15" },
  ].filter(i => i.value !== 0);

  const maxVal = Math.max(...items.map(i => Math.abs(i.value)), 1);

  return (
    <AnimatedItem index={index}>
      <GlassCard size="auto" className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
              <Landmark className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="widget-title">Patrimônio Líquido</p>
          </div>
          <div className="text-right">
            <motion.p
              key={breakdown.netWorth}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`text-xl font-bold tabular-nums ${breakdown.netWorth >= 0 ? "text-foreground" : "text-destructive"}`}
            >
              {breakdown.netWorth < 0 ? "-" : ""}R$ {formatCurrency(Math.abs(breakdown.netWorth))}
            </motion.p>
            <div className="flex items-center gap-1 justify-end">
              {balance >= 0 ? (
                <TrendingUp className="w-3 h-3 text-green-400" />
              ) : (
                <TrendingDown className="w-3 h-3 text-destructive" />
              )}
              <span className={`text-[9px] font-semibold ${balance >= 0 ? "text-green-400" : "text-destructive"}`}>
                {balance >= 0 ? "+" : ""}R$ {formatCurrency(balance)} este mês
              </span>
            </div>
          </div>
        </div>

        {/* Stacked bar */}
        <div className="flex h-3 rounded-full overflow-hidden bg-foreground/5 mb-4">
          {items.filter(i => i.value > 0).map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / breakdown.assets) * 100}%` }}
              transition={{ duration: 0.7, delay: idx * 0.1 }}
              className={`h-full first:rounded-l-full last:rounded-r-full ${
                item.label === "Conta corrente" ? "bg-blue-400" :
                item.label === "Poupança" ? "bg-green-400" : "bg-violet-400"
              }`}
            />
          ))}
        </div>

        {/* Breakdown items */}
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-2.5 p-2 rounded-xl bg-foreground/[0.03]">
                <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
                  <p className={`text-sm font-bold tabular-nums ${item.value < 0 ? "text-rose-400" : "text-foreground"}`}>
                    {item.value < 0 ? "-" : ""}R$ {formatCurrency(Math.abs(item.value))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </AnimatedItem>
  );
};

export default NetWorthCard;
