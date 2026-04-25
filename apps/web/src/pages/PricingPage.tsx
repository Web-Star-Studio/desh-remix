import { Check, Coins, History, ShoppingCart } from "lucide-react";
import { useSubscription } from "@/hooks/admin/useSubscription";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageLayout from "@/components/dashboard/PageLayout";
import PageHeader from "@/components/dashboard/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CREDIT_TABLE } from "@/constants/credits";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price_brl: number;
  stripe_price_id: string | null;
  trial_eligible: boolean;
  unit_price: number;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const { credits, createCheckout } = useSubscription();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Custom credits state
  const [customQty, setCustomQty] = useState(100);
  const [refPkgId, setRefPkgId] = useState<string>("");

  const { data: packages = [] } = useQuery({
    queryKey: ["credit-packages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_packages")
        .select("id, name, credits, price_brl, stripe_price_id, trial_eligible, unit_price")
        .eq("active", true)
        .order("credits", { ascending: true });
      return (data || []) as CreditPackage[];
    },
  });

  useEffect(() => {
    if (packages.length > 0 && !refPkgId) setRefPkgId(packages[0].id);
  }, [packages, refPkgId]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("credit_transactions")
      .select("action, amount, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setTransactions(data || []));
  }, [user]);

  const handleBuyPackage = async (packageId: string) => {
    setLoading(packageId);
    try {
      await createCheckout("credits", packageId);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };


  const handleCustomCredits = async () => {
    if (!refPkgId || customQty < 100 || customQty % 100 !== 0) return;
    setLoading("custom");
    try {
      await createCheckout("custom_credits", undefined, customQty, refPkgId);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d), "dd MMM, HH:mm", { locale: ptBR }); }
    catch { return d; }
  };

  const refPkg = packages.find(p => p.id === refPkgId);
  const customTotal = refPkg ? (refPkg.price_brl / refPkg.credits) * customQty : 0;
  

  const creditBalance = credits?.balance ?? 0;

  return (
    <PageLayout>
      <PageHeader title="Créditos" />

      <div className="max-w-4xl mx-auto px-4 pb-8 space-y-8">
        {/* Current balance */}
        {credits && (
          <div className="glass-card rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5" /> Saldo atual
              </span>
              <span className="text-2xl font-bold font-mono text-foreground">
                {creditBalance.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Gasto: {credits.total_spent.toLocaleString("pt-BR")}</span>
              <span>Recebido: {credits.total_earned.toLocaleString("pt-BR")}</span>
            </div>
          </div>
        )}

        {/* Credit packages */}
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
                  <p className="text-[10px] text-muted-foreground">R${unitPrice.toFixed(4)}/crédito</p>
                  {discount > 0 && <span className="text-xs text-primary font-medium mt-1">{discount}% off</span>}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => handleBuyPackage(pkg.id)}
                    disabled={!!loading || !hasStripePrice}
                  >
                    {!hasStripePrice ? "Indisponível" : loading === pkg.id ? "..." : "Comprar"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom credits */}
        {packages.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" /> Compra Avulsa
            </h3>
            <div className="glass-card rounded-xl p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Compre créditos avulsos de 100 em 100, na proporção de valor do pacote escolhido.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs text-muted-foreground">Quantidade (múltiplo de 100)</label>
                  <Input
                    type="number"
                    min={100}
                    step={100}
                    value={customQty}
                    onChange={(e) => {
                      const v = Math.max(100, Math.round(parseInt(e.target.value) / 100) * 100 || 100);
                      setCustomQty(v);
                    }}
                  />
                </div>
                <div className="space-y-1.5 flex-1">
                  <label className="text-xs text-muted-foreground">Faixa de preço</label>
                  <Select value={refPkgId} onValueChange={setRefPkgId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                  <p className="text-[10px] text-muted-foreground">{customQty} créditos</p>
                </div>
              </div>
              <Button
                onClick={handleCustomCredits}
                disabled={!!loading || customQty < 100 || !refPkgId}
                className="w-full sm:w-auto"
              >
                {loading === "custom" ? "Redirecionando..." : "Comprar créditos avulsos"}
              </Button>
            </div>
          </div>
        )}

        {/* Credit usage table */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Consumo de Créditos por Ação</h3>
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
        {transactions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-primary" /> Histórico de Créditos
            </h3>
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
          </div>
        )}
      </div>
    </PageLayout>
  );
}
