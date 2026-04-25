import PageLayout from "@/components/dashboard/PageLayout";
import { Ticket } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import { CreditCard, Receipt, FileText, User, ExternalLink, Download, Shield, Loader2, Coins, History, Bell, ShoppingCart, Gift, TrendingUp, TrendingDown, Zap, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubscription } from "@/hooks/admin/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";

// Coupon redemption state


interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: number;
  period_start: number;
  period_end: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  description: string;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_brl: number;
  stripe_price_id: string | null;
  trial_eligible?: boolean;
}

interface BillingPrefs {
  alert_enabled: boolean;
  alert_threshold: number;
  auto_purchase_enabled: boolean;
  auto_purchase_threshold: number;
  auto_purchase_package_id: string | null;
}

const CREDIT_TABLE = [
  { action: "Mensagem AI Chat", credits: 0.7 },
  { action: "Resumo/Análise AI", credits: 1 },
  { action: "Planejamento de Tarefas AI", credits: 0.5 },
  { action: "Composição de Email AI", credits: 0.8 },
  { action: "Busca Web", credits: 1.5 },
  { action: "Sincronização Open Banking", credits: 2 },
  { action: "Envio WhatsApp via API", credits: 0.3 },
  { action: "Exportação de Dados", credits: 0.5 },
  { action: "Resumo de Conversas WhatsApp", credits: 1 },
  { action: "Week Planner AI", credits: 0.8 },
];

const BillingPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { credits, createCheckout, openBillingPortal } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Custom credits
  const [customQty, setCustomQty] = useState(100);
  const [refPkgId, setRefPkgId] = useState<string>("");

  // Coupon redemption
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [activeCoupon, setActiveCoupon] = useState<{ code: string; value: number; type: string } | null>(null);

  // ── Billing Details queries ──
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["billing-overview", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("billing", { body: { type: "details", action: "overview" } });
      if (error) return null;
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ["billing-invoices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("billing", { body: { type: "details", action: "invoices" } });
      if (error) return { invoices: [] };
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["credit-packages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_packages")
        .select("id, name, credits, price_brl, stripe_price_id, trial_eligible")
        .eq("active", true)
        .order("credits", { ascending: true });
      return (data || []) as CreditPackage[];
    },
  });

  useEffect(() => {
    if (packages.length > 0 && !refPkgId) setRefPkgId(packages[0].id);
  }, [packages, refPkgId]);

  // ── Transactions with pagination & filter ──
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txPage, setTxPage] = useState(0);
  const [txTotal, setTxTotal] = useState(0);
  const [txFilter, setTxFilter] = useState<"all" | "earned" | "spent">("all");
  const TX_PER_PAGE = 20;

  useEffect(() => {
    if (!user) return;
    const from = txPage * TX_PER_PAGE;
    let query = supabase
      .from("credit_transactions")
      .select("action, amount, description, created_at, metadata", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (txFilter === "earned") query = query.gt("amount", 0);
    if (txFilter === "spent") query = query.lt("amount", 0);

    query.range(from, from + TX_PER_PAGE - 1)
      .then(({ data, count }) => {
        setTransactions(data || []);
        setTxTotal(count || 0);
      });
  }, [user, txPage, txFilter]);

  // consumption stats placeholder - defined after creditBalance

  // ── Billing Preferences ──
  const { data: billingPrefs } = useQuery({
    queryKey: ["billing-prefs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("billing_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      return data as BillingPrefs | null;
    },
    enabled: !!user,
  });

  const [prefsForm, setPrefsForm] = useState<BillingPrefs>({
    alert_enabled: false,
    alert_threshold: 50,
    auto_purchase_enabled: false,
    auto_purchase_threshold: 30,
    auto_purchase_package_id: null,
  });

  useEffect(() => {
    if (billingPrefs) setPrefsForm({ ...billingPrefs });
  }, [billingPrefs]);

  const savePrefsMutation = useMutation({
    mutationFn: async (prefs: BillingPrefs) => {
      const { error } = await supabase
        .from("billing_preferences")
        .upsert({ user_id: user!.id, ...prefs }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preferências salvas!");
      queryClient.invalidateQueries({ queryKey: ["billing-prefs"] });
    },
    onError: () => toast.error("Erro ao salvar preferências"),
  });

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing", { body: { type: "details", action: "portal" } });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch {
      toast.error("Não foi possível abrir o portal de pagamentos");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleBuyPackage = async (packageId: string) => {
    setCheckoutLoading(packageId);
    try {
      await createCheckout("credits", packageId, undefined, undefined, activeCoupon?.type === "percent" ? activeCoupon.code : undefined);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao iniciar checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };


  const handleCustomCredits = async () => {
    if (!refPkgId || customQty < 100 || customQty % 100 !== 0) return;
    setCheckoutLoading("custom");
    try {
      await createCheckout("custom_credits", undefined, customQty, refPkgId, activeCoupon?.type === "percent" ? activeCoupon.code : undefined);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao iniciar checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const { data, error } = await supabase.rpc("redeem_coupon", { _code: couponCode.trim() } as any);
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        if (result.type === "percent") {
          setActiveCoupon({ code: result.code, value: result.value, type: "percent" });
          toast.success(`Cupom ${result.value}% ativado! O desconto será aplicado na sua próxima compra.`);
        } else {
          toast.success(`Cupom resgatado! +${result.value} créditos`);
        }
        setCouponCode("");
        queryClient.invalidateQueries({ queryKey: ["billing-overview"] });
        queryClient.invalidateQueries({ queryKey: ["credits"] });
      } else {
        const msgs: Record<string, string> = {
          coupon_not_found: "Cupom não encontrado",
          coupon_inactive: "Cupom inativo",
          coupon_expired: "Cupom expirado",
          coupon_max_uses_reached: "Cupom esgotado",
          already_redeemed: "Você já resgatou este cupom",
        };
        toast.error(msgs[result?.error] || "Erro ao resgatar cupom");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao resgatar cupom");
    } finally {
      setCouponLoading(false);
    }
  };

  const paymentMethods: PaymentMethod[] = overview?.payment_methods || [];
  const invoices: Invoice[] = invoicesData?.invoices || [];
  const customer = overview?.customer;
  const upcomingInvoice = overview?.upcoming_invoice;

  const formatCurrency = (amount: number, currency = "brl") =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);

  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMM, HH:mm", { locale: ptBR }); }
    catch { return d; }
  };

  const creditBalance = credits?.balance ?? 0;

  // ── Consumption stats ──
  const [consumptionStats, setConsumptionStats] = useState({ dailyCost: 0, estimatedDays: null as number | null, totalSpent7d: 0 });
  useEffect(() => {
    if (!user) return;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    supabase
      .from("credit_transactions")
      .select("amount, created_at")
      .eq("user_id", user.id)
      .lt("amount", 0)
      .gte("created_at", sevenDaysAgo)
      .then(({ data }) => {
        const spent7d = (data || []).reduce((s, tx) => s + Math.abs(tx.amount), 0);
        const daily = spent7d / 7;
        setConsumptionStats({
          dailyCost: daily,
          estimatedDays: daily > 0 ? Math.floor(creditBalance / daily) : null,
          totalSpent7d: spent7d,
        });
      });
  }, [user, creditBalance]);

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      paid: { label: "Pago", cls: "bg-green-500/20 text-green-400 border-green-500/30" },
      open: { label: "Aberta", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
      draft: { label: "Rascunho", cls: "bg-muted/30 text-muted-foreground border-border/30" },
      void: { label: "Anulada", cls: "bg-destructive/20 text-destructive border-destructive/30" },
      uncollectible: { label: "Inadimplente", cls: "bg-destructive/20 text-destructive border-destructive/30" },
    };
    const s = map[status] || { label: status, cls: "bg-muted/30 text-muted-foreground border-border/30" };
    return <Badge variant="outline" className={`${s.cls} text-[10px] font-semibold`}>{s.label}</Badge>;
  };

  const brandIcon = (brand: string) => {
    const icons: Record<string, string> = { visa: "💳 Visa", mastercard: "💳 Mastercard", amex: "💳 Amex", elo: "💳 Elo" };
    return icons[brand] || `💳 ${brand}`;
  };

  const refPkg = packages.find(p => p.id === refPkgId);
  const customTotal = refPkg ? (refPkg.price_brl / refPkg.credits) * customQty : 0;
  

  return (
    <PageLayout maxWidth="5xl">
      <PageHeader
        title="Faturamento"
        icon={<Receipt className="w-7 h-7 text-white drop-shadow" />}
        subtitle="Gerencie seus créditos, métodos de pagamento e faturas"
      />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="glass-card border border-border/30 bg-background/60 p-1 gap-1 overflow-x-auto no-scrollbar w-full justify-start sm:justify-center">
          <TabsTrigger value="overview" className="data-[state=active]:bg-foreground/10 text-xs sm:text-sm shrink-0 press-scale">Visão Geral</TabsTrigger>
          <TabsTrigger value="credits" className="data-[state=active]:bg-foreground/10 text-xs sm:text-sm shrink-0 press-scale">Créditos</TabsTrigger>
          <TabsTrigger value="payment" className="data-[state=active]:bg-foreground/10 text-xs sm:text-sm shrink-0 press-scale">Pagamento</TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-foreground/10 text-xs sm:text-sm shrink-0 press-scale">Faturas</TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-foreground/10 text-xs sm:text-sm shrink-0 press-scale">Alertas</TabsTrigger>
          <TabsTrigger value="data" className="data-[state=active]:bg-foreground/10 text-xs sm:text-sm shrink-0 press-scale">Dados</TabsTrigger>
        </TabsList>

        {/* ── Visão Geral ── */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={<Coins className="w-4 h-4 text-primary" />} label="Créditos" value={creditBalance.toLocaleString("pt-BR")} sub="saldo disponível" />
            <KpiCard
              icon={<Clock className="w-4 h-4 text-primary" />}
              label="Próxima Cobrança"
              value={upcomingInvoice ? formatCurrency(upcomingInvoice.amount_due, upcomingInvoice.currency) : "—"}
              sub={upcomingInvoice?.next_payment_attempt ? format(new Date(upcomingInvoice.next_payment_attempt * 1000), "dd/MM/yyyy") : undefined}
            />
            <KpiCard icon={<TrendingDown className="w-4 h-4 text-destructive" />} label="Total Gasto" value={credits?.total_spent?.toLocaleString("pt-BR") ?? "0"} sub="créditos consumidos" />
            <KpiCard icon={<Zap className="w-4 h-4 text-primary" />} label="Custo/Dia" value={consumptionStats.dailyCost.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} sub="últimos 7 dias" />
          </div>

          {/* Credit progress bar */}
          {credits && (
            <div className="glass-card rounded-xl p-4 border border-border/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> Saldo de Créditos</span>
                <span className={`text-sm font-bold font-mono ${creditBalance <= 50 ? "text-destructive" : "text-foreground"}`}>{creditBalance.toLocaleString("pt-BR")}</span>
              </div>
              <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${creditBalance <= 50 ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, (creditBalance / (credits.total_earned || 500)) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{credits.total_spent?.toLocaleString("pt-BR") ?? 0} gastos</span>
                {consumptionStats.estimatedDays !== null && (
                  <span className={`flex items-center gap-1 font-medium ${consumptionStats.estimatedDays < 7 ? "text-destructive" : "text-foreground"}`}>
                    <TrendingUp className="w-3 h-3" /> ~{consumptionStats.estimatedDays} dias restantes
                  </span>
                )}
              </div>
            </div>
          )}

          {creditBalance <= 0 && (
            <div className="glass-card rounded-xl p-4 border border-destructive/30 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-destructive">Sem créditos</p>
                <p className="text-xs text-muted-foreground">Compre um pacote para continuar usando o DESH</p>
              </div>
              <Button size="sm" variant="destructive" onClick={() => handleBuyPackage(packages[0]?.id)} disabled={!packages[0]}>
                Comprar créditos
              </Button>
            </div>
          )}


          {/* Coupon redemption */}
          <div className="glass-card rounded-xl p-4 border border-border/30">
            <div className="flex items-center gap-3">
              <Ticket className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Tem um cupom?</p>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Digite o código"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    className="max-w-[200px] text-xs uppercase"
                    onKeyDown={e => e.key === "Enter" && handleRedeemCoupon()}
                  />
                  <Button size="sm" onClick={handleRedeemCoupon} disabled={couponLoading || !couponCode.trim()}>
                    {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Resgatar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Créditos ── */}
        <TabsContent value="credits" className="space-y-6">
          {/* Credit balance */}
          {credits && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5" /> Saldo
                </span>
                <span className="text-2xl font-bold font-mono text-foreground">{creditBalance.toLocaleString("pt-BR")}</span>
              </div>
            </div>
          )}

          {/* Active coupon banner */}
          {activeCoupon && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20">
              <Gift className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Cupom {activeCoupon.code} ({activeCoupon.value}% off) será aplicado na próxima compra</span>
              <button onClick={() => setActiveCoupon(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}

          {/* Packages */}
          {packages.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" /> Pacotes de Créditos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {packages.map((pkg, idx) => {
                  const hasStripePrice = !!pkg.stripe_price_id;
                  const basePrice = packages[0]?.price_brl ? (packages[0].price_brl / packages[0].credits) : 0;
                  const unitPrice = pkg.price_brl / pkg.credits;
                  const discount = idx > 0 && basePrice > 0 ? Math.round((1 - unitPrice / basePrice) * 100) : 0;
                  return (
                    <div key={pkg.id} className="glass-card rounded-xl p-5 flex flex-col items-center text-center">
                      <p className="text-2xl font-bold text-foreground">{pkg.credits.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-muted-foreground">créditos</p>
                      <p className="text-lg font-semibold text-foreground mt-2">
                        R${pkg.price_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      {activeCoupon?.type === "percent" && (
                        <span className="text-xs text-primary font-semibold mt-1">-{activeCoupon.value}% com cupom</span>
                      )}
                      {discount > 0 && !activeCoupon && <span className="text-xs text-primary font-medium mt-1">{discount}% off</span>}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => handleBuyPackage(pkg.id)}
                        disabled={!!checkoutLoading || !hasStripePrice}
                      >
                        {!hasStripePrice ? "Indisponível" : checkoutLoading === pkg.id ? "..." : "Comprar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom credits */}
          {packages.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" /> Compra Avulsa
              </h3>
              <div className="glass-card rounded-xl p-5 space-y-4">
                <p className="text-xs text-muted-foreground">De 100 em 100 créditos, na proporção do pacote escolhido.</p>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="space-y-1.5 flex-1">
                    <label className="text-xs text-muted-foreground">Quantidade</label>
                    <Input
                      type="number"
                      min={100}
                      step={100}
                      value={customQty}
                      onChange={(e) => setCustomQty(Math.max(100, Math.round(parseInt(e.target.value) / 100) * 100 || 100))}
                    />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <label className="text-xs text-muted-foreground">Faixa de preço</label>
                    <Select value={refPkgId} onValueChange={setRefPkgId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {packages.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — R${(p.price_brl / p.credits).toFixed(4)}/créd
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-right sm:min-w-[120px]">
                    <p className="text-lg font-bold text-foreground">
                      R${customTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <Button onClick={handleCustomCredits} disabled={!!checkoutLoading || customQty < 100 || !refPkgId}>
                  {checkoutLoading === "custom" ? "Redirecionando..." : "Comprar avulso"}
                </Button>
              </div>
            </div>
          )}

          {/* Credit usage table */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Consumo por Ação</h3>
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground font-medium">Ação</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">Créditos</th>
                  </tr>
                </thead>
                <tbody>
                  {CREDIT_TABLE.map(row => (
                    <tr key={row.action} className="border-b border-border/50 last:border-0">
                      <td className="p-3 text-foreground">{row.action}</td>
                      <td className="p-3 text-right font-mono text-foreground">{row.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Credit history */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-primary" /> Histórico
                <span className="text-xs text-muted-foreground font-normal">{txTotal} transações</span>
              </h3>
              <div className="flex gap-1 bg-foreground/5 rounded-lg p-0.5">
                {(["all", "earned", "spent"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => { setTxFilter(f); setTxPage(0); }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                      txFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "all" ? "Todos" : f === "earned" ? "Recebidos" : "Gastos"}
                  </button>
                ))}
              </div>
            </div>
            {transactions.length === 0 ? (
              <div className="glass-card rounded-xl py-10 flex flex-col items-center justify-center text-muted-foreground">
                <History className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma transação encontrada</p>
              </div>
            ) : (
              <>
                <div className="glass-card rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-muted-foreground font-medium">Data</th>
                        <th className="text-left p-3 text-muted-foreground font-medium">Descrição</th>
                        <th className="text-right p-3 text-muted-foreground font-medium">Créditos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">{formatDate(tx.created_at)}</td>
                          <td className="p-3 text-foreground text-xs">{tx.description || tx.action.replace(/_/g, " ")}</td>
                          <td className={`p-3 text-right font-mono font-semibold text-xs ${tx.amount > 0 ? "text-green-600" : "text-destructive"}`}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {txTotal > TX_PER_PAGE && (
                  <div className="flex items-center justify-between mt-3">
                    <Button variant="outline" size="sm" disabled={txPage === 0} onClick={() => setTxPage(p => p - 1)}>Anterior</Button>
                    <span className="text-xs text-muted-foreground">Página {txPage + 1} de {Math.ceil(txTotal / TX_PER_PAGE)}</span>
                    <Button variant="outline" size="sm" disabled={(txPage + 1) * TX_PER_PAGE >= txTotal} onClick={() => setTxPage(p => p + 1)}>Próxima</Button>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Pagamento ── */}
        <TabsContent value="payment" className="space-y-4">
          <div className="glass-card rounded-xl p-5 border border-border/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" /> Métodos de Pagamento
              </h3>
              <Button size="sm" variant="outline" onClick={handlePortal} disabled={portalLoading} className="gap-1.5 text-xs">
                {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Gerenciar no Portal
              </Button>
            </div>

            {overviewLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : paymentMethods.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum método de pagamento cadastrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {paymentMethods.map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between p-3 rounded-lg bg-foreground/5 border border-border/20">
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{brandIcon(pm.brand)}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">•••• {pm.last4}</p>
                        <p className="text-xs text-muted-foreground">Expira {String(pm.exp_month).padStart(2, "0")}/{pm.exp_year}</p>
                      </div>
                    </div>
                    {pm.is_default && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">Padrão</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Faturas ── */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="glass-card rounded-xl border border-border/30 overflow-hidden">
            <div className="p-4 border-b border-border/20 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" /> Histórico de Faturas
              </h3>
              <p className="text-xs text-muted-foreground">{invoices.length} fatura{invoices.length !== 1 ? "s" : ""}</p>
            </div>

            {invoicesLoading ? (
              <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando faturas...
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma fatura encontrada</p>
              </div>
            ) : (
              <div className="divide-y divide-border/10">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between px-4 py-3 hover:bg-foreground/3 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{inv.number || inv.id.slice(0, 12)}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(inv.created * 1000), "dd MMM yyyy", { locale: ptBR })}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">{formatCurrency(inv.amount_due, inv.currency)}</p>
                        {statusBadge(inv.status)}
                      </div>
                      <div className="flex gap-1">
                        {inv.hosted_invoice_url && (
                          <Button size="icon" variant="ghost" className="w-8 h-8" asChild>
                            <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
                          </Button>
                        )}
                        {inv.invoice_pdf && (
                          <Button size="icon" variant="ghost" className="w-8 h-8" aria-label="Baixar fatura" asChild>
                            <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer"><Download className="w-3.5 h-3.5" /></a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Alertas ── */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="glass-card rounded-xl p-5 border border-border/30 space-y-6">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Alerta de Crédito Baixo</h3>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="alert-enabled" className="text-sm text-foreground">Ativar alerta</Label>
              <Switch id="alert-enabled" checked={prefsForm.alert_enabled} onCheckedChange={(v) => setPrefsForm(p => ({ ...p, alert_enabled: v }))} />
            </div>
            {prefsForm.alert_enabled && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Saldo mínimo para alerta</Label>
                <Input type="number" min={1} value={prefsForm.alert_threshold} onChange={(e) => setPrefsForm(p => ({ ...p, alert_threshold: parseInt(e.target.value) || 0 }))} className="max-w-[200px]" />
              </div>
            )}
          </div>

          <div className="glass-card rounded-xl p-5 border border-border/30 space-y-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Compra Automática de Créditos</h3>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-enabled" className="text-sm text-foreground">Ativar compra automática</Label>
              <Switch id="auto-enabled" checked={prefsForm.auto_purchase_enabled} onCheckedChange={(v) => setPrefsForm(p => ({ ...p, auto_purchase_enabled: v }))} />
            </div>
            {prefsForm.auto_purchase_enabled && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Saldo que dispara a compra</Label>
                  <Input type="number" min={1} value={prefsForm.auto_purchase_threshold} onChange={(e) => setPrefsForm(p => ({ ...p, auto_purchase_threshold: parseInt(e.target.value) || 0 }))} className="max-w-[200px]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Pacote a ser comprado</Label>
                  <Select value={prefsForm.auto_purchase_package_id || ""} onValueChange={(v) => setPrefsForm(p => ({ ...p, auto_purchase_package_id: v || null }))}>
                    <SelectTrigger className="max-w-[300px]"><SelectValue placeholder="Selecione um pacote" /></SelectTrigger>
                    <SelectContent>
                      {packages.map(pkg => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.credits.toLocaleString("pt-BR")} créditos — R${pkg.price_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <Button onClick={() => savePrefsMutation.mutate(prefsForm)} disabled={savePrefsMutation.isPending} className="gap-2">
            {savePrefsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Salvar Preferências
          </Button>
        </TabsContent>

        {/* ── Dados ── */}
        <TabsContent value="data" className="space-y-4">
          <div className="glass-card rounded-xl p-5 border border-border/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" /> Dados de Cobrança
              </h3>
              <Button size="sm" variant="outline" onClick={handlePortal} disabled={portalLoading} className="gap-1.5 text-xs">
                {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                Editar no Portal
              </Button>
            </div>

            {overviewLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : customer ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField label="Nome" value={customer.name} />
                <InfoField label="E-mail de cobrança" value={customer.email} />
                <InfoField label="Telefone" value={customer.phone} />
                <InfoField
                  label="Endereço"
                  value={customer.address ? [customer.address.line1, customer.address.line2, customer.address.city, customer.address.state, customer.address.postal_code, customer.address.country].filter(Boolean).join(", ") : null}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum dado de cobrança cadastrado</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

const KpiCard = ({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) => (
  <div className="glass-card rounded-xl p-4 border border-border/30 space-y-1">
    <div className="flex items-center gap-1.5">
      {icon}
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
    <p className="text-lg font-bold text-foreground">{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
  </div>
);

const InfoField = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div>
    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
    <p className="text-sm text-foreground mt-0.5">{value || "—"}</p>
  </div>
);

export default BillingPage;
