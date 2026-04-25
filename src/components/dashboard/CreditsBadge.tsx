import { Coins } from "lucide-react";
import { useSubscription } from "@/hooks/admin/useSubscription";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { LOW_BALANCE_THRESHOLD } from "@/constants/credits";
import { useIsMobile } from "@/hooks/use-mobile";
import DeshTooltip from "@/components/ui/DeshTooltip";

export default function CreditsBadge() {
  const { credits } = useSubscription();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (!credits) return null;

  const isLow = credits.balance < LOW_BALANCE_THRESHOLD;
  return (
    <DeshTooltip label="Créditos — ver planos">
      <button
        onClick={() => navigate(ROUTES.PRICING)}
        className={`focusable glass-card h-9 sm:h-10 px-3 rounded-full flex items-center gap-1.5 text-xs font-medium transition-colors hover:bg-foreground/10 ${
          isLow ? "text-destructive" : "text-overlay-muted"
        }`}
      >
        <Coins className="w-3.5 h-3.5" />
        {!isMobile && <span>{credits.balance.toLocaleString("pt-BR")}</span>}
      </button>
    </DeshTooltip>
  );
}
