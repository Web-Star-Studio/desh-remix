import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, Loader2, RefreshCw, CheckCircle2, AlertCircle, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useZernioWhatsApp, WABAPhoneNumber } from "@/hooks/whatsapp/useZernioWhatsApp";
import { toast } from "@/hooks/use-toast";

export default function PhoneNumberManager() {
  const { getPhoneNumbers, purchasePhoneNumber } = useZernioWhatsApp();
  const [numbers, setNumbers] = useState<WABAPhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPhoneNumbers();
      if (mountedRef.current) setNumbers(res.data?.numbers || []);
    } catch (e) {
      console.error("[PhoneNumberManager] loadNumbers error:", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [getPhoneNumbers]);

  useEffect(() => { loadNumbers(); }, [loadNumbers]);

  const handlePurchase = useCallback(async () => {
    setPurchasing(true);
    try {
      const res = await purchasePhoneNumber();
      if (res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" });
      } else if (res.data?.checkoutUrl) {
        window.open(res.data.checkoutUrl, "_blank");
        toast({ title: "Redirecionando para pagamento..." });
      } else {
        toast({ title: "Número provisionado!", description: res.data?.phoneNumber?.phoneNumber });
        loadNumbers();
      }
    } catch (e: any) {
      toast({ title: "Erro ao comprar número", description: e?.message, variant: "destructive" });
    } finally {
      if (mountedRef.current) setPurchasing(false);
    }
  }, [purchasePhoneNumber, loadNumbers]);

  const qualityColor = (q?: string) => {
    if (q === "GREEN") return "text-[hsl(142,70%,45%)]";
    if (q === "YELLOW") return "text-amber-500";
    return "text-destructive";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Phone className="w-5 h-5 text-purple-500" /> Números
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie números de telefone do WhatsApp Business</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={loadNumbers} className="h-8 w-8"><RefreshCw className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={handlePurchase} disabled={purchasing} className="gap-1.5">
            {purchasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
            Comprar Número
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : numbers.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Phone className="w-10 h-10 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">Nenhum número registrado.</p>
          <p className="text-xs text-muted-foreground">Compre um número pré-verificado ou conecte o seu via Credenciais Diretas.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {numbers.map(n => (
            <div key={n.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card/50">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{n.phoneNumber}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {n.displayName && <span className="text-xs text-muted-foreground">{n.displayName}</span>}
                  {n.verifiedName && <span className="text-[10px] text-muted-foreground">✓ {n.verifiedName}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {n.qualityRating && (
                  <span className={`text-[10px] font-medium ${qualityColor(n.qualityRating)}`}>
                    Qualidade: {n.qualityRating}
                  </span>
                )}
                <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
                  n.status === "CONNECTED" ? "text-[hsl(142,70%,45%)] bg-[hsl(142,70%,45%)]/10" : "text-amber-500 bg-amber-500/10"
                }`}>
                  {n.status === "CONNECTED" ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {n.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}