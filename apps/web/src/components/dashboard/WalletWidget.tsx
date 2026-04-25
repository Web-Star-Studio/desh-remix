import React, { useMemo, useEffect, useState } from "react";
import { Wallet, Landmark, CreditCard, TrendingUp, ArrowUpRight, ArrowDownRight, ChevronRight, Sparkles, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "./GlassCard";
import WidgetTitle from "./WidgetTitle";
import { useDbFinances } from "@/hooks/finance/useDbFinances";
import { useAuth } from "@/contexts/AuthContext";
import { usePersistedWidget } from "@/hooks/ui/usePersistedWidget";
import { supabase } from "@/integrations/supabase/client";
import type { FinancialAccount } from "@/types/finance";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ACCOUNT_ICON: Record<string, typeof Landmark> = {
  checking: Landmark,
  savings: Landmark,
  credit_card: CreditCard,
  investment: TrendingUp,
  loan: Landmark,
  other: Landmark,
};

const ACCOUNT_ACCENT: Record<string, string> = {
  checking: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/15",
  savings: "from-sky-500/20 to-sky-500/5 border-sky-500/15",
  credit_card: "from-rose-500/20 to-rose-500/5 border-rose-500/15",
  investment: "from-violet-500/20 to-violet-500/5 border-violet-500/15",
  loan: "from-amber-500/20 to-amber-500/5 border-amber-500/15",
  other: "from-foreground/10 to-foreground/5 border-foreground/10",
};

const WalletWidget = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { transactions, totalIncome, totalExpense, balance, isLoading } = useDbFinances();
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const { data: contentHidden, save: saveContentHidden } = usePersistedWidget<boolean>({
    key: "wallet-hidden",
    defaultValue: false,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("financial_accounts")
        .select("id, name, type, current_balance, institution_name, currency")
        .eq("user_id", user.id)
        .order("institution_name");
      if (data) setAccounts(data as FinancialAccount[]);
    })();
  }, [user]);

  const totalBalance = useMemo(() => {
    if (accounts.length > 0) return accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0);
    return balance;
  }, [accounts, balance]);

  const recentTxs = useMemo(() => transactions.slice(0, 5), [transactions]);

  const incomeRatio = useMemo(() => {
    const total = totalIncome + totalExpense;
    return total > 0 ? (totalIncome / total) * 100 : 50;
  }, [totalIncome, totalExpense]);

  const balanceTrend = balance >= 0 ? "positive" : "negative";

  // Popup expanded content
  const popupContent = (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      {/* Hero balance */}
      <div className="relative rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/10 p-5 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.08),transparent_60%)]" />
        <p className="text-xs text-muted-foreground mb-1 relative">Saldo total</p>
        <p className={`text-2xl font-bold tabular-nums relative ${totalBalance >= 0 ? "text-foreground" : "text-destructive"}`}>
          {fmt(totalBalance)}
        </p>
        <div className="flex justify-center gap-6 mt-3 relative">
          <span className="text-emerald-500 flex items-center gap-1 text-xs font-medium"><ArrowUpRight className="w-3.5 h-3.5" />{fmt(totalIncome)}</span>
          <span className="text-destructive flex items-center gap-1 text-xs font-medium"><ArrowDownRight className="w-3.5 h-3.5" />{fmt(totalExpense)}</span>
        </div>
      </div>

      {accounts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2.5 uppercase tracking-wider">Contas</p>
          <div className="space-y-2">
            {accounts.map((a) => {
              const Icon = ACCOUNT_ICON[a.type ?? "other"] ?? Landmark;
              const accent = ACCOUNT_ACCENT[a.type ?? "other"] ?? ACCOUNT_ACCENT.other;
              return (
                <div key={a.id} className={`flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r border ${accent}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-background/60 flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-foreground/60" />
                    </div>
                    <span className="text-xs font-medium truncate">{a.name || a.institution_name || "Conta"}</span>
                  </div>
                  <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${(a.current_balance ?? 0) < 0 ? "text-destructive" : "text-emerald-500"}`}>
                    {fmt(a.current_balance ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2.5 uppercase tracking-wider">Últimas transações</p>
        <div className="space-y-1">
          {transactions.slice(0, 15).map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-foreground/[0.04] transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-xs truncate font-medium">{t.description}</p>
                <p className="text-[10px] text-muted-foreground">{t.category} · {new Date(t.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
              </div>
              <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${t.type === "income" ? "text-emerald-500" : "text-destructive"}`}>
                {t.type === "income" ? "+" : "-"}{fmt(Number(t.amount))}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balanço mensal</p>
        <div className="h-2.5 rounded-full bg-destructive/15 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${incomeRatio}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Saldo: <span className={balance >= 0 ? "text-emerald-500 font-semibold" : "text-destructive font-semibold"}>{fmt(balance)}</span>
        </p>
      </div>

      <button
        onClick={() => navigate("/finances")}
        className="w-full text-xs text-primary hover:underline text-center py-1.5 font-medium"
      >
        Ver detalhes completos →
      </button>
    </div>
  );

  return (
    <GlassCard size="standard" className="justify-between overflow-hidden">
      {/* Subtle radial glow */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle,hsl(var(--primary)/0.06),transparent_70%)] pointer-events-none" />

      <div className="flex items-center justify-between mb-1.5 relative">
        <WidgetTitle label="Carteira" icon={<Wallet className="w-3.5 h-3.5" />} popupContent={popupContent} popupIcon={<Wallet className="w-5 h-5" />} />
        <div className="flex items-center gap-1">
          <button onClick={() => saveContentHidden(!contentHidden)} className="text-muted-foreground hover:text-primary transition-colors" title={contentHidden ? "Mostrar conteúdo" : "Esconder conteúdo"}>
            {contentHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => navigate("/finances")} className="text-muted-foreground hover:text-primary transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {contentHidden ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground/60 italic">Conteúdo oculto</p>
        </div>
      ) : (
        <>
          {/* Balance hero */}
          <div className="mb-3 relative">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Saldo total</p>
            <motion.p
              className={`text-xl font-bold tabular-nums tracking-tight ${totalBalance >= 0 ? "text-foreground" : "text-destructive"}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {isLoading ? "..." : fmt(totalBalance)}
            </motion.p>
            {!isLoading && (
              <div className={`inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                balanceTrend === "positive"
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/15"
                  : "bg-destructive/10 text-destructive border border-destructive/15"
              }`}>
                {balanceTrend === "positive" ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                {balanceTrend === "positive" ? "Positivo" : "Negativo"}
              </div>
            )}
          </div>

          {/* Accounts or monthly bar */}
          {accounts.length > 0 ? (
            <div className="space-y-1.5 mb-2.5 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              {accounts.slice(0, 3).map((a, i) => {
                const Icon = ACCOUNT_ICON[a.type ?? "other"] ?? Landmark;
                const accent = ACCOUNT_ACCENT[a.type ?? "other"] ?? ACCOUNT_ACCENT.other;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={`flex items-center justify-between gap-1.5 py-1.5 px-2 rounded-lg bg-gradient-to-r border ${accent}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <div className="w-5 h-5 rounded-md bg-background/50 flex items-center justify-center">
                        <Icon className="w-2.5 h-2.5 text-foreground/60" />
                      </div>
                      <span className="text-[11px] font-medium truncate">{a.name || a.institution_name}</span>
                    </div>
                    <span className={`text-[11px] font-semibold tabular-nums whitespace-nowrap ${(a.current_balance ?? 0) < 0 ? "text-destructive" : "text-emerald-500"}`}>
                      {fmt(a.current_balance ?? 0)}
                    </span>
                  </motion.div>
                );
              })}
              {accounts.length > 3 && (
                <p className="text-[10px] text-muted-foreground pl-1">+{accounts.length - 3} contas</p>
              )}
            </div>
          ) : (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] mb-1.5">
                <span className="text-emerald-500 flex items-center gap-0.5 font-medium"><ArrowUpRight className="w-2.5 h-2.5" />{fmt(totalIncome)}</span>
                <span className="text-destructive flex items-center gap-0.5 font-medium"><ArrowDownRight className="w-2.5 h-2.5" />{fmt(totalExpense)}</span>
              </div>
              <div className="h-2 rounded-full bg-destructive/12 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${incomeRatio}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {/* Recent transactions */}
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Últimos gastos
            </p>
            {recentTxs.length === 0 && !isLoading && (
              <p className="text-[10px] text-muted-foreground/60 italic">Nenhuma transação este mês</p>
            )}
            <div className="space-y-0.5">
              {recentTxs.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between gap-1.5 py-1 px-1.5 rounded-lg hover:bg-foreground/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <div className={`w-1 h-4 rounded-full shrink-0 ${t.type === "income" ? "bg-emerald-500" : "bg-destructive/60"}`} />
                    <span className="text-[11px] truncate">{t.description}</span>
                  </div>
                  <span className={`text-[11px] font-semibold tabular-nums whitespace-nowrap ${t.type === "income" ? "text-emerald-500" : "text-destructive"}`}>
                    {t.type === "income" ? "+" : "-"}{fmt(Number(t.amount))}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}
    </GlassCard>
  );
};

export default React.memo(WalletWidget);
