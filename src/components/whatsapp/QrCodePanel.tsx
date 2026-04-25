import { Loader2, Radio, RefreshCw, XCircle } from "lucide-react";
import type { RealtimeStatus } from "@/hooks/whatsapp/useWhatsappWebSession";

interface Props {
  qrCode: string | null;
  realtimeStatus: RealtimeStatus;
  restarting: boolean;
  loading: boolean;
  onRestart: () => void;
  onDisconnect: () => void;
}

export default function QrCodePanel({ qrCode, realtimeStatus, restarting, loading, onRestart, onDisconnect }: Props) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xs text-muted-foreground text-center">
        Escaneie o QR Code com o WhatsApp no seu celular
      </p>

      <div className="relative">
        {qrCode ? (
          <div className="p-3 bg-card rounded-xl shadow-lg border border-border">
            {(() => {
              if (qrCode.startsWith("data:")) {
                return <img src={qrCode} alt="WhatsApp QR Code" className="w-52 h-52 rounded-lg" />;
              }
              if (/^[A-Za-z0-9+/=]{100,}$/.test(qrCode)) {
                return <img src={`data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" className="w-52 h-52 rounded-lg" />;
              }
              return (
                <pre className="w-52 h-52 text-[7px] font-mono leading-tight overflow-auto break-all whitespace-pre-wrap p-1 bg-background rounded-lg text-foreground">
                  {qrCode}
                </pre>
              );
            })()}
          </div>
        ) : (
          <div className="w-52 h-52 bg-muted rounded-xl border border-border flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground text-center px-4">Aguardando QR…</p>
            <p className="text-[10px] text-muted-foreground text-center px-4 flex items-center gap-1">
              <Radio className={`w-3 h-3 flex-shrink-0 ${realtimeStatus === "live" ? "text-primary animate-pulse" : ""}`} />
              {realtimeStatus === "live" ? "Realtime ativo" : "Conectando ao Realtime…"}
            </p>
          </div>
        )}
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
        </span>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
        <Radio className={`w-3 h-3 ${realtimeStatus === "live" ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
        {realtimeStatus === "live" ? "Atualizando em tempo real" : realtimeStatus === "connecting" ? "Conectando ao Realtime…" : "Erro no Realtime"}
      </p>

      <div className="flex gap-2 w-full">
        <button
          onClick={onRestart}
          disabled={restarting || loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors flex-1 justify-center"
        >
          {restarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Reiniciar
        </button>
        <button
          onClick={onDisconnect}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border text-sm text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors flex-1 justify-center"
        >
          <XCircle className="w-4 h-4" />
          Cancelar
        </button>
      </div>
    </div>
  );
}
