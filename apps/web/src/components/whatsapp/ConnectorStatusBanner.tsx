import { CheckCircle2, RefreshCw, XCircle, Loader2, WifiOff } from "lucide-react";
import type { WhatsappWebSession, WhatsappWebStatus } from "@/hooks/whatsapp/useWhatsappWebSession";

function formatUptime(connectedAt: string | null): string {
  if (!connectedAt) return "";
  const diff = Date.now() - new Date(connectedAt).getTime();
  const totalSecs = Math.floor(diff / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}min`;
  return `${totalSecs}s`;
}

interface Props {
  session: WhatsappWebSession;
  reconnectAttempt: number;
}

export default function ConnectorStatusBanner({ session, reconnectAttempt }: Props) {
  const s = session.status;

  if (s === "CONNECTED") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary">WhatsApp conectado</p>
          <p className="text-[10px] text-muted-foreground">
            {session.lastConnectedAt
              ? `Uptime: ${formatUptime(session.lastConnectedAt)}`
              : "WhatsApp Web · instância pessoal"}
          </p>
        </div>
      </div>
    );
  }

  if (s === "RECONNECTING") {
    return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0 text-foreground" />
      <div>
        <p className="text-sm font-semibold text-foreground">Reconectando…</p>
        <p className="text-[10px] text-muted-foreground">
          Tentativa {reconnectAttempt} de 3 · backoff exponencial
        </p>
      </div>
      </div>
    );
  }

  if (s === "ERROR") {
    const isGateway = session.lastError?.includes("Gateway timeout") || session.lastError === "Failed to fetch";
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
        <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-destructive">
            {isGateway ? "Gateway indisponível" : "Erro de conexão"}
          </p>
          {session.lastError && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {session.lastError === "Failed to fetch"
                ? "O servidor WhatsApp não está respondendo. Tente novamente em alguns segundos."
                : session.lastError}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (s === "connecting") {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/10 border border-accent/20">
        <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
        <p className="text-sm text-muted-foreground">Conectando ao WhatsApp Web…</p>
      </div>
    );
  }

  return null;
}
