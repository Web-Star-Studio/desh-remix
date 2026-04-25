import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LucideIcon } from "lucide-react";

/** Brand colors for each toolkit */
const BRAND_COLORS: Record<string, string> = {
  gmail: "#EA4335",
  googlecalendar: "#4285F4",
  googledrive: "#0F9D58",
  googledocs: "#4285F4",
  googlesheets: "#0F9D58",
  googletasks: "#4285F4",
  googlemeet: "#00897B",
  googlephotos: "#FBBC04",
  twitter: "#1DA1F2",
  linkedin: "#0A66C2",
  slack: "#4A154B",
  telegram: "#0088CC",
  github: "#333333",
  notion: "#000000",
  spotify: "#1DB954",
};

interface Props {
  toolkit: string;
  name: string;
  icon: LucideIcon;
  description: string;
  connected: boolean;
  hasError?: boolean;
  isLoading: boolean;
  disabled: boolean;
  accountEmail?: string | null;
  connectedAt?: string | null;
  globalLoading?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect?: () => void;
}

export const IntegrationServiceCard = memo(function IntegrationServiceCard({
  toolkit, name, icon: Icon, description,
  connected, hasError, isLoading, disabled, globalLoading,
  accountEmail, connectedAt, onConnect, onDisconnect, onReconnect,
}: Props) {
  const brandColor = BRAND_COLORS[toolkit];

  return (
    <div
      className={`relative flex items-center justify-between rounded-xl border p-3.5 transition-all duration-200 hover:bg-foreground/[0.04] ${
        connected && !hasError
          ? "border-emerald-500/30 bg-emerald-500/[0.04]"
          : hasError
          ? "border-destructive/30 bg-destructive/[0.04]"
          : "border-border/30 bg-background/60 backdrop-blur-sm"
      } ${globalLoading ? "opacity-70" : ""}`}
    >
      {globalLoading && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.04] to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      )}
      <div className="flex items-center gap-3 min-w-0">
        <DeshTooltip label={description}>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
            style={{
              backgroundColor: connected && brandColor
                ? `${brandColor}18`
                : "hsl(var(--foreground) / 0.08)",
            }}
          >
            <Icon
              className="h-[18px] w-[18px]"
              style={{ color: connected && brandColor ? brandColor : "hsl(var(--muted-foreground))" }}
            />
          </div>
        </DeshTooltip>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {name}
            </span>
            {connected && !hasError && (
              <Badge className="text-[10px] px-1.5 py-0 gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />
                Conectado
              </Badge>
            )}
            {hasError && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                <AlertTriangle className="h-3 w-3" />
                Erro
              </Badge>
            )}
            {isLoading && !connected && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Conectando...
              </Badge>
            )}
          </div>
          {connected && accountEmail && (
            <p className="text-xs text-primary/80 truncate mt-0.5">
              {accountEmail}
              {connectedAt && (
                <span className="text-muted-foreground"> · {formatDistanceToNow(new Date(connectedAt), { addSuffix: true, locale: ptBR })}</span>
              )}
            </p>
          )}
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-3 shrink-0">
        {hasError && onReconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReconnect}
            disabled={disabled}
            className="text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Reconectar
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={connected ? onDisconnect : onConnect}
          disabled={isLoading || disabled}
          className={`text-xs ${
            connected
              ? "text-destructive/60 hover:text-destructive hover:bg-destructive/10"
              : "text-muted-foreground hover:text-foreground border border-border"
          }`}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : connected ? (
            "Desconectar"
          ) : (
            "Conectar"
          )}
        </Button>
      </div>
    </div>
  );
});
