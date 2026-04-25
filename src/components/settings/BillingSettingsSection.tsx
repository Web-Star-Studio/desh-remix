import { useNavigate } from "react-router-dom";
import { Coins } from "lucide-react";
import { useSubscription } from "@/hooks/admin/useSubscription";

const BillingSettingsSection = () => {
  const navigate = useNavigate();
  const { credits, openBillingPortal } = useSubscription();

  const creditBalance = credits?.balance ?? 0;
  const isLow = creditBalance < 50;

  return (
    <div className="space-y-4 mt-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary" /> Créditos: {creditBalance.toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-muted-foreground">
            {isLow ? "Créditos baixos" : "Saldo disponível"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openBillingPortal} className="text-xs px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground hover:bg-foreground/10 transition-colors">
            Gerenciar
          </button>
          <button onClick={() => navigate("/pricing")} className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            Comprar créditos
          </button>
        </div>
      </div>
    </div>
  );
};

export default BillingSettingsSection;
