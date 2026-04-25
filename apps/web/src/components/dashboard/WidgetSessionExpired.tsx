import { LogIn, RefreshCw } from "lucide-react";
import GlassCard from "./GlassCard";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface WidgetSessionExpiredProps {
  widgetName?: string;
  onRetry?: () => void;
}

const WidgetSessionExpired = ({ widgetName, onRetry }: WidgetSessionExpiredProps) => {
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshSession = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
      onRetry?.();
    } catch {
      navigate("/auth");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <GlassCard className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <LogIn className="w-8 h-8 text-warning/70" />
      <div>
        <p className="text-sm font-medium text-foreground mb-1">
          Sessão expirada
        </p>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          {widgetName ? `O widget "${widgetName}" precisa de autenticação.` : "Reconecte para continuar."}
        </p>
      </div>
      <button
        onClick={handleRefreshSession}
        disabled={refreshing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Reconectando..." : "Reconectar"}
      </button>
    </GlassCard>
  );
};

export default WidgetSessionExpired;
