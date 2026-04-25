import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode, Loader2, Wifi, WifiOff, Radio, RefreshCw, XCircle, CheckCircle2, ArrowRightLeft,
} from "lucide-react";
import GlassCard from "./GlassCard";
import { useSharedWhatsappSession } from "@/contexts/WhatsappSessionContext";
import { useAdminRole } from "@/hooks/admin/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import { callWhatsappProxy } from "@/lib/whatsappProxy";
import ConnectorStatusBanner from "@/components/whatsapp/ConnectorStatusBanner";
import QrCodePanel from "@/components/whatsapp/QrCodePanel";
import { SendTestMessage, CreateInstanceButton } from "@/components/whatsapp/AdminTestPanel";
import DebugModal from "@/components/whatsapp/DebugModal";
import TransferWhatsAppDialog from "@/components/whatsapp/TransferWhatsAppDialog";

export default function WhatsAppWebConnector() {
  const { session, loading, realtimeStatus, reconnectAttempt, createSession, disconnect, sendMessage, effectiveWorkspaceId } = useSharedWhatsappSession();
  const { isAdmin } = useAdminRole();
  const [restarting, setRestarting] = useState(false);
  const [autoHealing, setAutoHealing] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const autoHealTriedRef = useRef(false);

  const isIdle = session.status === "idle";
  const isConnecting = session.status === "connecting";
  const isQrPending = session.status === "QR_PENDING";
  const isConnected = session.status === "CONNECTED";
  const isError = session.status === "ERROR";
  const isDisconnected = session.status === "DISCONNECTED";
  const isReconnecting = session.status === "RECONNECTING";

  // Auto-heal: when QR_PENDING with a stale QR (>2 min), trigger a /status probe
  useEffect(() => {
    if (!isQrPending || autoHealTriedRef.current) return;
    // Wait 2 min after mount to see if QR is stale
    const timer = setTimeout(async () => {
      if (autoHealTriedRef.current) return;
      autoHealTriedRef.current = true;
      setAutoHealing(true);
      try {
        const statusData = await callWhatsappProxy("GET", "/status", undefined, effectiveWorkspaceId, 12_000);
        if ((statusData.status as string) === "CONNECTED") {
          // Force heal by triggering createSession which will re-check
          await createSession();
        }
      } catch { /* ignore */ }
      finally { setAutoHealing(false); }
    }, 5_000); // Check after 5s (QR already stale from previous session)
    return () => clearTimeout(timer);
  }, [isQrPending, effectiveWorkspaceId, createSession]);

  // Reset auto-heal flag when status changes away from QR_PENDING
  useEffect(() => {
    if (!isQrPending) {
      autoHealTriedRef.current = false;
    }
  }, [isQrPending]);

  const pillCls = isConnected
    ? "bg-primary/15 text-primary border-primary/30"
    : isReconnecting
    ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
    : isQrPending || isConnecting
    ? "bg-accent/30 text-accent-foreground border-accent/40"
    : isError
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : "bg-muted text-muted-foreground border-border";

  async function handleRestart() {
    setRestarting(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        Authorization: `Bearer ${authSession?.access_token}`,
      };
      if (effectiveWorkspaceId) headers["x-workspace-id"] = effectiveWorkspaceId;
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-web-proxy/restart`, {
        method: "POST",
        headers,
      });
      await createSession();
    } catch { /* ignore */ }
    finally { setRestarting(false); }
  }

  return (
    <GlassCard size="auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
          <QrCode className="w-4 h-4 text-accent-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="widget-title text-sm">WhatsApp Web</p>
          <p className="text-[10px] text-muted-foreground">Instância pessoal</p>
        </div>
        <span title={`Realtime: ${realtimeStatus}`}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium flex-shrink-0 border ${
            realtimeStatus === "live" ? "bg-primary/15 text-primary border-primary/30"
            : realtimeStatus === "connecting" ? "bg-accent/20 text-accent-foreground border-accent/30"
            : realtimeStatus === "error" ? "bg-destructive/15 text-destructive border-destructive/30"
            : "bg-muted text-muted-foreground border-border"
          }`}>
          <Radio className={`w-2.5 h-2.5 ${realtimeStatus === "live" ? "animate-pulse" : ""}`} />
          RT
        </span>
        {isAdmin && <DebugModal />}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 border ${pillCls}`}>
          {isConnected && <><Wifi className="w-2.5 h-2.5" /> Conectado</>}
          {isReconnecting && <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Reconectando ({reconnectAttempt}/3)</>}
          {(isQrPending || isConnecting) && <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Conectando</>}
          {isError && <><WifiOff className="w-2.5 h-2.5" /> Erro</>}
          {(isIdle || isDisconnected) && <><WifiOff className="w-2.5 h-2.5" /> Desconectado</>}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {/* RECONNECTING */}
        {isReconnecting && (
          <motion.div key="reconnecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <ConnectorStatusBanner session={session} reconnectAttempt={reconnectAttempt} />
            <button onClick={disconnect} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border text-sm text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors w-full justify-center">
              <XCircle className="w-4 h-4" /> Cancelar
            </button>
          </motion.div>
        )}

        {/* IDLE / DISCONNECTED */}
        {(isIdle || isDisconnected) && (
          <motion.div key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-2">
            <button onClick={createSession} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 w-full justify-center">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando…</> : <><QrCode className="w-4 h-4" /> Conectar via QR Code</>}
            </button>
            {isDisconnected && (
              <button onClick={() => setShowTransfer(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors w-full justify-center">
                <ArrowRightLeft className="w-3.5 h-3.5" /> Transferir para outro workspace
              </button>
            )}
            {isAdmin && <CreateInstanceButton onCreateSession={createSession} />}
          </motion.div>
        )}

        {/* CONNECTING */}
        {isConnecting && (
          <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-6">
            <ConnectorStatusBanner session={session} reconnectAttempt={reconnectAttempt} />
          </motion.div>
        )}

        {/* QR_PENDING */}
        {isQrPending && (
          <motion.div key="qr" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-3">
            {autoHealing ? (
              <div className="flex items-center gap-2 justify-center py-4 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando conexão...
              </div>
            ) : (
              <QrCodePanel qrCode={session.qrCode} realtimeStatus={realtimeStatus} restarting={restarting} loading={loading} onRestart={handleRestart} onDisconnect={disconnect} />
            )}
            <button
              onClick={async () => {
                setAutoHealing(true);
                try {
                  const statusData = await callWhatsappProxy("GET", "/status", undefined, effectiveWorkspaceId, 12_000);
                  if ((statusData.status as string) === "CONNECTED") {
                    await createSession();
                  }
                } catch { /* ignore */ }
                finally { setAutoHealing(false); }
              }}
              disabled={autoHealing}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/20 border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors w-full justify-center"
            >
              <CheckCircle2 className="w-4 h-4" />
              Verificar conexão
            </button>
          </motion.div>
        )}

        {/* CONNECTED */}
        {isConnected && (
          <motion.div key="connected" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
            <ConnectorStatusBanner session={session} reconnectAttempt={reconnectAttempt} />
            {isAdmin && <SendTestMessage sendMessage={sendMessage} />}
            
            <div className="flex gap-2">
              <button onClick={() => setShowTransfer(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground/5 border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors flex-1 justify-center">
                <ArrowRightLeft className="w-4 h-4" /> Transferir
              </button>
              <button onClick={disconnect} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground/5 border border-border text-sm text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors flex-1 justify-center">
                <WifiOff className="w-4 h-4" /> Desconectar
              </button>
            </div>
          </motion.div>
        )}

        {/* ERROR */}
        {isError && (
          <motion.div key="error" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-3">
            <ConnectorStatusBanner session={session} reconnectAttempt={reconnectAttempt} />
            <button onClick={createSession} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 w-full justify-center">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Tentar novamente
            </button>
            {isAdmin && <CreateInstanceButton onCreateSession={createSession} />}
          </motion.div>
        )}
      </AnimatePresence>

      <TransferWhatsAppDialog
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        currentWorkspaceId={effectiveWorkspaceId}
        onTransferred={() => window.location.reload()}
      />
    </GlassCard>
  );
}
