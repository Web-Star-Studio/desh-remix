import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Coins } from "lucide-react";
import { useSubscription } from "@/hooks/admin/useSubscription";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

export default function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const { createCheckout } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);

  const { data: packages = [] } = useQuery({
    queryKey: ["credit-packages-modal"],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_packages")
        .select("id, name, credits, price_brl, stripe_price_id")
        .eq("active", true)
        .order("credits", { ascending: true });
      return data || [];
    },
    enabled: open,
  });

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            Créditos Insuficientes
          </DialogTitle>
          <DialogDescription>
            {reason || "Seus créditos acabaram. Compre um pacote para continuar."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <p className="text-xs text-muted-foreground text-center">Pacotes de créditos</p>
          <div className="grid grid-cols-3 gap-2">
            {packages.map((pkg: any) => {
              const hasStripePrice = !!pkg.stripe_price_id;
              return (
                <Button
                  key={pkg.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleBuyPackage(pkg.id)}
                  disabled={!!loading || !hasStripePrice}
                  className="flex flex-col h-auto py-2"
                >
                  <Coins className="w-3.5 h-3.5 mb-1" />
                  <span className="text-xs font-semibold">{pkg.credits.toLocaleString("pt-BR")}</span>
                  <span className="text-[10px] text-muted-foreground">
                    R${pkg.price_brl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
