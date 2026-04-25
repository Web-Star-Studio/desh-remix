import { AlertTriangle, Coins } from "lucide-react";
import { useSubscription } from "@/hooks/admin/useSubscription";
import { useNavigate } from "react-router-dom";
import { LOW_BALANCE_THRESHOLD } from "@/constants/credits";

export default function SubscriptionBanner() {
  const { credits } = useSubscription();
  const navigate = useNavigate();

  if (!credits) return null;

  // No credits at all
  if (credits.balance <= 0) {
    return (
      <div className="mx-4 mt-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Sem créditos</p>
          <p className="text-xs text-muted-foreground">Compre um pacote de créditos para continuar usando o DESH.</p>
        </div>
        <button
          onClick={() => navigate("/pricing")}
          className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex-shrink-0"
        >
          Comprar
        </button>
      </div>
    );
  }

  // Low credits
  if (credits.balance < LOW_BALANCE_THRESHOLD) {
    return (
      <div className="mx-4 mt-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3">
        <Coins className="w-5 h-5 text-orange-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Créditos baixos: {credits.balance.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">Compre mais créditos para continuar usando IA e recursos.</p>
        </div>
        <button
          onClick={() => navigate("/pricing")}
          className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex-shrink-0"
        >
          Comprar
        </button>
      </div>
    );
  }

  return null;
}
