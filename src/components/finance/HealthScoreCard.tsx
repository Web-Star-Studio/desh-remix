import { motion } from "framer-motion";
import { Zap, CheckCircle2, AlertCircle } from "lucide-react";
import GlassCard from "@/components/dashboard/GlassCard";
import AnimatedItem from "@/components/dashboard/AnimatedItem";

interface HealthScoreCardProps {
  savingsRate: number;
  budgets: Array<{ category: string; monthly_limit: number }>;
  categoryBreakdown: Record<string, number>;
  expenseChange: number | null;
  index?: number;
}

const HealthScoreCard = ({ savingsRate, budgets, categoryBreakdown, expenseChange, index = 2.5 }: HealthScoreCardProps) => {
  const savingsScore = Math.min(Math.max(savingsRate, 0), 100) * 0.4;
  const budgetAdherence = budgets.length > 0
    ? budgets.filter(b => b.monthly_limit > 0).reduce((acc, b) => {
        const spent = categoryBreakdown[b.category] || 0;
        return acc + (spent <= b.monthly_limit ? 1 : 0);
      }, 0) / Math.max(budgets.filter(b => b.monthly_limit > 0).length, 1) * 100
    : 50;
  const budgetScore = budgetAdherence * 0.3;
  const trendScore = expenseChange !== null
    ? (expenseChange <= 0 ? 30 : Math.max(30 - expenseChange * 0.5, 0))
    : 15;
  const healthScore = Math.round(savingsScore + budgetScore + trendScore);
  const scoreColor = healthScore >= 70 ? "text-green-400" : healthScore >= 40 ? "text-amber-400" : "text-destructive";
  const scoreLabel = healthScore >= 70 ? "Excelente" : healthScore >= 50 ? "Bom" : healthScore >= 30 ? "Regular" : "Atenção";
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (healthScore / 100) * circumference;

  return (
    <AnimatedItem index={index}>
      <GlassCard size="auto" className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-green-500/15 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-green-400" />
          </div>
          <p className="widget-title">Saúde Financeira</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--foreground) / 0.08)" strokeWidth="8" />
              <motion.circle
                cx="50" cy="50" r="40" fill="none"
                stroke={healthScore >= 70 ? "hsl(140,50%,50%)" : healthScore >= 40 ? "hsl(35,80%,55%)" : "hsl(0,70%,55%)"}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{healthScore}</span>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">/ 100</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${scoreColor}`}>{scoreLabel}</span>
              {healthScore >= 70 && <CheckCircle2 className="w-4 h-4 text-green-400" />}
              {healthScore < 40 && <AlertCircle className="w-4 h-4 text-destructive" />}
            </div>
            <div className="space-y-1.5">
              {[
                { label: "Poupança", value: Math.round(savingsScore / 0.4), weight: "40%" },
                { label: "Orçamento", value: Math.round(budgetAdherence), weight: "30%" },
                { label: "Tendência", value: Math.round(trendScore / 0.3), weight: "30%" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground w-16">{item.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={{ duration: 0.8 }}
                      className={`h-full rounded-full ${item.value >= 70 ? "bg-green-400" : item.value >= 40 ? "bg-amber-400" : "bg-destructive"}`}
                    />
                  </div>
                  <span className="text-[8px] text-muted-foreground tabular-nums w-6 text-right">{item.weight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </GlassCard>
    </AnimatedItem>
  );
};

export default HealthScoreCard;
