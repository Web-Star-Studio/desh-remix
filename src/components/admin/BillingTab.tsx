import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Coins, CreditCard, TrendingUp, Users, DollarSign,
  Activity, RefreshCw, ArrowDown, ArrowUp, Sparkles, Clock,
  Download, BarChart3, UserMinus, Flame, Package, Plus,
  Trash2, Edit2, Save, X, AlertTriangle, Target, CalendarDays,
  Crown, Zap, Timer, Link2, Loader2, CheckCircle2, XCircle
} from "lucide-react";
import AdminGrantCreditsModal from "./AdminGrantCreditsModal";
import CouponsSection from "./CouponsSection";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { exportToCsv } from "@/lib/exportCsv";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_brl: number;
  active: boolean;
  stripe_price_id: string | null;
  unit_price: number | null;
  trial_eligible: boolean;
}

interface TopUser {
  user_id: string;
  display_name: string | null;
  total_spent: number;
  balance: number;
  plan: string;
  status: string;
}

interface WeeklySignup {
  week: string;
  signups: number;
  converted_pro: number;
}

interface BillingStats {
  total_subscriptions: number;
  active_trials: number;
  expired_trials: number;
  active_pro: number;
  canceled_pro: number;
  total_credits_in_circulation: number;
  total_credits_earned: number;
  total_credits_spent: number;
  mrr_estimate: number;
  credit_purchases_count: number;
  arpu: number;
  churn_rate: number;
  credits_consumed_today: number;
  credits_consumed_week: number;
  credits_consumed_month: number;
  daily_revenue_trend: { day: string; credits_consumed: number }[];
  top_actions: { action: string; count: number; total_credits: number }[];
  recent_transactions: { action: string; amount: number; description: string; created_at: string; user_name: string | null }[];
  subscriptions_by_status: { plan: string; status: string; count: number }[];
  avg_ltv: number;
  trials_expiring_soon: number;
  total_credit_purchase_revenue: number;
  top_users_by_consumption: TopUser[];
  weekly_signups: WeeklySignup[];
  avg_trial_to_pro_days: number;
  credit_packages: CreditPackage[];
}

export default function BillingTab() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPkg, setEditingPkg] = useState<string | null>(null);
  const [newPkg, setNewPkg] = useState<{ name: string; credits: string; price: string } | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: "", credits: "", price: "" });
  const [syncing, setSyncing] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<{ id: string; email: string; display_name: string | null }[]>([]);
  const [txSearch, setTxSearch] = useState("");
  const [txPage, setTxPage] = useState(1);
  const TX_PER_PAGE = 15;

  // Fetch users for grant modal
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("admin_list_users");
      if (data) setAdminUsers((data as any[]).map(u => ({ id: u.id, email: u.email, display_name: u.display_name })));
    })();
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_get_billing_stats");
      if (!error && data) {
        const raw = data as any;
        setStats({
          total_subscriptions: raw.total_subscriptions ?? 0,
          active_trials: raw.active_trials ?? 0,
          expired_trials: raw.expired_trials ?? 0,
          active_pro: raw.active_pro ?? 0,
          canceled_pro: raw.canceled_pro ?? 0,
          total_credits_in_circulation: raw.total_credits_in_circulation ?? 0,
          total_credits_earned: raw.total_credits_earned ?? 0,
          total_credits_spent: raw.total_credits_spent ?? 0,
          mrr_estimate: raw.mrr_estimate ?? 0,
          credit_purchases_count: raw.credit_purchases_count ?? 0,
          arpu: raw.arpu ?? 0,
          churn_rate: raw.churn_rate ?? 0,
          credits_consumed_today: raw.credits_consumed_today ?? 0,
          credits_consumed_week: raw.credits_consumed_week ?? 0,
          credits_consumed_month: raw.credits_consumed_month ?? 0,
          daily_revenue_trend: raw.daily_revenue_trend ?? [],
          top_actions: raw.top_actions ?? [],
          recent_transactions: raw.recent_transactions ?? [],
          subscriptions_by_status: raw.subscriptions_by_status ?? [],
          avg_ltv: raw.avg_ltv ?? 0,
          trials_expiring_soon: raw.trials_expiring_soon ?? 0,
          total_credit_purchase_revenue: raw.total_credit_purchase_revenue ?? 0,
          top_users_by_consumption: raw.top_users_by_consumption ?? [],
          weekly_signups: (raw.weekly_signups ?? []).map((w: any) => ({
            ...w,
            converted_pro: w.converted_pro ?? 0,
          })),
          avg_trial_to_pro_days: raw.avg_trial_to_pro_days ?? 0,
          credit_packages: raw.credit_packages ?? [],
        });
      }
    } catch (e) {
      console.error("Failed to fetch billing stats:", e);
    }
    setLoading(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
    toast({ title: "Atualizado", description: "Dados financeiros atualizados." });
  }, [fetchStats]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Package CRUD ──
  const handleCreatePackage = async () => {
    if (!newPkg) return;
    const { error } = await supabase.from("credit_packages").insert({
      name: newPkg.name,
      credits: parseFloat(newPkg.credits),
      price_brl: parseFloat(newPkg.price),
      active: true,
    } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setNewPkg(null);
    toast({ title: "Pacote criado" });
    fetchStats();
  };

  const handleUpdatePackage = async (id: string) => {
    const credits = parseFloat(pkgForm.credits);
    const price = parseFloat(pkgForm.price);
    const unit_price = credits > 0 ? parseFloat((price / credits).toFixed(4)) : 0;

    try {
      // Update DB + Stripe via edge function
      const { data, error } = await supabase.functions.invoke("billing", {
        body: {
          type: "details",
          action: "update_package",
          package_id: id,
          name: pkgForm.name,
          credits,
          price_brl: price,
          unit_price,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setEditingPkg(null);
      toast({
        title: "Pacote atualizado",
        description: data?.stripe_synced ? "Sincronizado com Stripe ✓" : "Salvo no banco de dados",
      });
      fetchStats();
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message || "Erro ao atualizar", variant: "destructive" });
    }
  };

  const handleTogglePackage = async (id: string, active: boolean) => {
    await supabase.from("credit_packages").update({ active } as any).eq("id", id);
    fetchStats();
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm("Remover este pacote permanentemente?")) return;
    await supabase.from("credit_packages").delete().eq("id", id);
    toast({ title: "Pacote removido" });
    fetchStats();
  };

  const handleSyncStripe = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing", {
        body: { type: "details", action: "sync_packages" },
      });
      if (error) throw error;
      const results = data?.results || [];
      const created = results.filter((r: any) => r.status === "created").length;
      const existing = results.filter((r: any) => r.status === "exists").length;
      const errors = results.filter((r: any) => r.status === "error").length;
      
      toast({ 
        title: "Sincronização concluída", 
        description: `${created} criados, ${existing} existentes${errors > 0 ? `, ${errors} erros` : ""}` 
      });
      fetchStats();
    } catch (e: any) {
      toast({ title: "Erro na sincronização", description: e?.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return <p className="text-center text-muted-foreground py-10">Erro ao carregar dados financeiros.</p>;

  const formatCredits = (n: number) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const formatBRL = (centavos: number) => `R$${(centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const formatBRLRaw = (reais: number) => `R$${Number(reais).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMM, HH:mm", { locale: ptBR }); }
    catch { return d; }
  };

  const conversionRate = stats.total_subscriptions > 0
    ? ((stats.credit_purchases_count / stats.total_subscriptions) * 100).toFixed(1)
    : "0";

  const exportTransactions = () => {
    exportToCsv("transacoes-credito",
      ["Data", "Usuário", "Ação", "Descrição", "Créditos"],
      stats.recent_transactions.map(tx => [
        tx.created_at, tx.user_name || "—", tx.action, tx.description || "—", String(tx.amount),
      ])
    );
    toast({ title: "Exportado", description: `${stats.recent_transactions.length} transações exportadas` });
  };

  const chartData = stats.daily_revenue_trend.map(d => ({
    day: format(new Date(d.day), "dd/MM", { locale: ptBR }),
    credits: d.credits_consumed,
  }));

  const cohortData = stats.weekly_signups.map(w => ({
    week: format(new Date(w.week), "dd/MM", { locale: ptBR }),
    signups: w.signups,
    pro: w.converted_pro,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Painel Financeiro
        </h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {/* Alerts */}
      {(stats.trials_expiring_soon > 0 || stats.churn_rate > 20) && (
        <div className="space-y-2">
          {stats.trials_expiring_soon > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium">
                {stats.trials_expiring_soon} trial(s) expirando nos próximos 3 dias — oportunidade de conversão!
              </span>
            </div>
          )}
          {stats.churn_rate > 20 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-medium">
                Churn em {stats.churn_rate}% — acima do limite saudável (20%). Ação recomendada.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={DollarSign} label="MRR Estimado" value={formatBRL(stats.mrr_estimate)} accent />
        <KPICard icon={Coins} label="Compras de Crédito" value={String(stats.credit_purchases_count)} />
        <KPICard icon={Clock} label="Trials Ativos" value={String(stats.active_trials)} />
        <KPICard icon={TrendingUp} label="Conversão" value={`${conversionRate}%`} />
      </div>

      {/* Advanced metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Target} label="LTV Médio (créditos)" value={formatCredits(stats.avg_ltv)} />
        <KPICard icon={Timer} label="Dias até Compra" value={`${stats.avg_trial_to_pro_days}d`} />
        <KPICard icon={UserMinus} label="Churn" value={`${stats.churn_rate}%`} danger={stats.churn_rate > 20} />
        <KPICard icon={Zap} label="Trials Expirando (3d)" value={String(stats.trials_expiring_soon)} danger={stats.trials_expiring_soon > 0} />
      </div>

      {/* Credits KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Coins} label="Créditos em Circulação" value={formatCredits(stats.total_credits_in_circulation)} />
        <KPICard icon={Flame} label="Consumo Hoje" value={formatCredits(stats.credits_consumed_today)} />
        <KPICard icon={Activity} label="Consumo 7 dias" value={formatCredits(stats.credits_consumed_week)} />
        <KPICard icon={CalendarDays} label="Consumo Mês" value={formatCredits(stats.credits_consumed_month)} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={ArrowUp} label="Total Emitidos" value={formatCredits(stats.total_credits_earned)} />
        <KPICard icon={ArrowDown} label="Total Consumidos" value={formatCredits(stats.total_credits_spent)} />
        <KPICard icon={DollarSign} label="Receita Total" value={formatBRLRaw(stats.total_credit_purchase_revenue)} accent />
        <KPICard icon={BarChart3} label="ARPU (créditos)" value={formatCredits(stats.arpu)} />
      </div>

      {/* Charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily consumption */}
        {chartData.length > 1 && (
          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Consumo Diário (30 dias)
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => [formatCredits(v), "Créditos"]}
                  />
                  <Area type="monotone" dataKey="credits" stroke="hsl(var(--primary))" fill="url(#creditGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Weekly signups cohort */}
        {cohortData.length > 0 && (
          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Cohort Semanal (Signups vs Compradores)
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cohortData}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  />
                  <Bar dataKey="signups" name="Signups" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.4} />
                  <Bar dataKey="pro" name="Compradores" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Subscriptions breakdown & Top actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Assinaturas por Status
          </h3>
          {stats.subscriptions_by_status.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma assinatura ainda.</p>
          ) : (
            <div className="space-y-2">
              {stats.subscriptions_by_status.map((s, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-foreground/[0.02]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary">{s.plan.toUpperCase()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      s.status === "active" ? "bg-green-500/15 text-green-600"
                        : s.status === "canceled" ? "bg-destructive/15 text-destructive"
                        : s.status === "expired" ? "bg-orange-500/15 text-orange-600"
                        : "bg-foreground/5 text-muted-foreground"
                    }`}>{s.status}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Top Ações por Créditos
          </h3>
          {stats.top_actions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum consumo registrado.</p>
          ) : (
            <div className="space-y-2">
              {stats.top_actions.map((a, i) => {
                const maxCredits = stats.top_actions[0]?.total_credits || 1;
                const pct = Math.round((a.total_credits / maxCredits) * 100);
                return (
                  <div key={i} className="relative">
                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-foreground/[0.02] relative z-10">
                      <span className="text-xs text-foreground font-medium truncate">{a.action.replace(/_/g, " ")}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground">{a.count}x</span>
                        <span className="text-xs font-mono font-semibold text-foreground">{formatCredits(a.total_credits)}</span>
                      </div>
                    </div>
                    <div className="absolute inset-y-0 left-0 bg-primary/5 rounded-xl" style={{ width: `${pct}%` }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top users */}
      {stats.top_users_by_consumption.length > 0 && (
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Top 10 Usuários por Consumo
            </h3>
            <button
              onClick={() => setGrantOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Coins className="w-3.5 h-3.5" /> Adicionar Créditos
            </button>
          </div>
          <div className="space-y-2">
            {stats.top_users_by_consumption.map((u, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-xl bg-foreground/[0.02]">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground font-mono w-4">#{i + 1}</span>
                  <span className="text-xs text-foreground font-medium">{u.display_name || "Sem nome"}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary">{u.plan?.toUpperCase() || "—"}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">saldo: <strong className="text-foreground">{formatCredits(u.balance)}</strong></span>
                  <span className="font-mono font-semibold text-foreground">{formatCredits(u.total_spent)} gastos</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Credit Packages Management */}
      <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" /> Pacotes de Crédito
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncStripe}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 text-accent-foreground text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
              title="Sincronizar pacotes com Stripe (criar produtos/preços automaticamente)"
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              {syncing ? "Sincronizando..." : "Sync Stripe"}
            </button>
            {!newPkg && (
              <button
                onClick={() => setNewPkg({ name: "", credits: "", price: "" })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Pacote
              </button>
            )}
          </div>
        </div>

        {/* New package form */}
        {newPkg && (
          <div className="flex items-center gap-2 mb-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <input
              className="flex-1 px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground"
              placeholder="Nome"
              value={newPkg.name}
              onChange={e => setNewPkg({ ...newPkg, name: e.target.value })}
            />
            <input
              className="w-24 px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground"
              placeholder="Créditos"
              type="number"
              value={newPkg.credits}
              onChange={e => setNewPkg({ ...newPkg, credits: e.target.value })}
            />
            <input
              className="w-28 px-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground"
              placeholder="Preço (R$)"
              type="number"
              step="0.01"
              value={newPkg.price}
              onChange={e => setNewPkg({ ...newPkg, price: e.target.value })}
            />
            <button onClick={handleCreatePackage} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-80">
              <Save className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setNewPkg(null)} className="p-1.5 rounded-lg bg-muted hover:bg-muted/80">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

        <div className="space-y-2">
          {stats.credit_packages.map(pkg => (
            <div key={pkg.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
              pkg.active ? "bg-foreground/[0.02] border-border/50" : "bg-destructive/[0.03] border-destructive/20 opacity-60"
            }`}>
              {editingPkg === pkg.id ? (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      className="flex-1 px-2 py-1 rounded-lg bg-background border border-border text-xs text-foreground"
                      value={pkgForm.name}
                      onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })}
                    />
                    <input
                      className="w-20 px-2 py-1 rounded-lg bg-background border border-border text-xs text-foreground"
                      type="number"
                      value={pkgForm.credits}
                      onChange={e => setPkgForm({ ...pkgForm, credits: e.target.value })}
                    />
                    <input
                      className="w-24 px-2 py-1 rounded-lg bg-background border border-border text-xs text-foreground"
                      type="number"
                      step="0.01"
                      value={pkgForm.price}
                      onChange={e => setPkgForm({ ...pkgForm, price: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleUpdatePackage(pkg.id)} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-80">
                      <Save className="w-3 h-3" />
                    </button>
                    <button onClick={() => setEditingPkg(null)} className="p-1.5 rounded-lg bg-muted hover:bg-muted/80">
                      <X className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-foreground">{pkg.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {formatCredits(pkg.credits)} créditos
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {formatBRLRaw(pkg.price_brl)}
                    </span>
                    {pkg.unit_price != null && (
                      <span className="text-[9px] text-muted-foreground">
                        ({formatBRLRaw(pkg.unit_price)}/cr)
                      </span>
                    )}
                    {pkg.trial_eligible && (
                      <Badge variant="outline" className="text-[9px] gap-1 bg-cyan-500/10 text-cyan-600 border-cyan-500/30">
                        Trial
                      </Badge>
                    )}
                    {pkg.stripe_price_id ? (
                      <Badge variant="outline" className="text-[9px] gap-1 bg-green-500/10 text-green-600 border-green-500/30">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Stripe
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                        <XCircle className="w-2.5 h-2.5" /> Sem Stripe
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={pkg.active}
                      onCheckedChange={(v) => handleTogglePackage(pkg.id, v)}
                    />
                    <button
                      onClick={() => {
                        setEditingPkg(pkg.id);
                        setPkgForm({ name: pkg.name, credits: String(pkg.credits), price: String(pkg.price_brl) });
                      }}
                      className="p-1.5 rounded-lg hover:bg-foreground/5 transition-colors"
                    >
                      <Edit2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeletePackage(pkg.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-destructive/60" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {stats.credit_packages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum pacote cadastrado.</p>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      {(() => {
        const filteredTx = txSearch
          ? stats.recent_transactions.filter(tx => {
              const s = txSearch.toLowerCase();
              return (tx.user_name || "").toLowerCase().includes(s) ||
                tx.action.toLowerCase().includes(s) ||
                (tx.description || "").toLowerCase().includes(s);
            })
          : stats.recent_transactions;
        const totalTxPages = Math.max(1, Math.ceil(filteredTx.length / TX_PER_PAGE));
        const safeTxPage = Math.min(txPage, totalTxPages);
        const paginatedTx = filteredTx.slice((safeTxPage - 1) * TX_PER_PAGE, safeTxPage * TX_PER_PAGE);

        return (
          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border/50 flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Coins className="w-4 h-4 text-primary" /> Últimas Transações de Crédito
                <span className="text-[10px] text-muted-foreground font-normal">({filteredTx.length})</span>
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    value={txSearch}
                    onChange={e => { setTxSearch(e.target.value); setTxPage(1); }}
                    placeholder="Buscar transações..."
                    className="pl-3 pr-3 py-1.5 rounded-lg bg-background border border-border text-xs text-foreground w-48 outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <button
                  onClick={exportTransactions}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-foreground/[0.02]">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Data</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Usuário</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Ação</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Descrição</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Créditos</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTx.map((tx, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-foreground/[0.02] transition-colors">
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{formatDate(tx.created_at)}</td>
                      <td className="py-3 px-4 text-foreground">{tx.user_name || "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                          tx.amount > 0 ? "bg-green-500/10 text-green-600" : "bg-primary/10 text-primary"
                        }`}>
                          {tx.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate">{tx.description || "—"}</td>
                      <td className={`py-3 px-4 text-right font-mono font-semibold ${
                        tx.amount > 0 ? "text-green-600" : "text-destructive"
                      }`}>
                        {tx.amount > 0 ? "+" : ""}{formatCredits(tx.amount)}
                      </td>
                    </tr>
                  ))}
                  {paginatedTx.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        {txSearch ? "Nenhuma transação encontrada." : "Nenhuma transação registrada."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalTxPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground">Página {safeTxPage} de {totalTxPages}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setTxPage(p => Math.max(1, p - 1))}
                    disabled={safeTxPage <= 1}
                    className="px-2.5 py-1 rounded-lg bg-foreground/5 text-xs text-foreground hover:bg-foreground/10 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                    disabled={safeTxPage >= totalTxPages}
                    className="px-2.5 py-1 rounded-lg bg-foreground/5 text-xs text-foreground hover:bg-foreground/10 disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      {/* Coupons section */}
      <CouponsSection />

      {/* Grant credits modal */}
      <AdminGrantCreditsModal
        open={grantOpen}
        onOpenChange={setGrantOpen}
        users={adminUsers}
        onSuccess={fetchStats}
      />
    </div>
  );
}

const KPICard = ({ icon: Icon, label, value, accent, danger }: { icon: React.ElementType; label: string; value: string; accent?: boolean; danger?: boolean }) => (
  <div className={`rounded-2xl p-4 border transition-colors ${
    accent ? "bg-primary/10 border-primary/20"
    : danger ? "bg-destructive/10 border-destructive/20"
    : "bg-card/80 border-border/50"
  }`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon className={`w-3.5 h-3.5 ${accent ? "text-primary" : danger ? "text-destructive" : "text-muted-foreground"}`} />
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
    <p className={`text-xl font-bold ${accent ? "text-primary" : danger ? "text-destructive" : "text-foreground"}`}>{value}</p>
  </div>
);
