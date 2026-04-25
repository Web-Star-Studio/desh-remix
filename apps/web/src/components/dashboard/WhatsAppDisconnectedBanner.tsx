import { useState } from "react";
import { useSharedWhatsappSession } from "@/contexts/WhatsappSessionContext";
import { useNavigate } from "react-router-dom";
import { WifiOff, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DISMISS_KEY = "desh-wa-banner-dismissed";

const WhatsAppDisconnectedBanner = () => {
  const { session } = useSharedWhatsappSession();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  const { status, sessionId } = session;
  const isDisconnected = status === "DISCONNECTED" || status === "ERROR";
  const isReconnecting = status === "RECONNECTING";

  if ((!isDisconnected && !isReconnecting) || !sessionId || dismissed) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.25 }}
        className={`glass-card border rounded-xl px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-foreground/5 transition-colors ${
          isReconnecting
            ? "bg-yellow-500/10 border-yellow-500/20"
            : "bg-destructive/10 border-destructive/20"
        }`}
        onClick={() => navigate("/settings/whatsapp")}
      >
        <div className={`mt-0.5 ${isReconnecting ? "text-yellow-600 dark:text-yellow-400" : "text-destructive"}`}>
          {isReconnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <WifiOff className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${isReconnecting ? "text-yellow-600 dark:text-yellow-400" : "text-destructive"}`}>
            {isReconnecting ? "Reconectando WhatsApp…" : "Sua conexão WhatsApp foi perdida"}
          </p>
          <p className="text-xs text-foreground/70 mt-0.5">
            {isReconnecting
              ? "Tentando restabelecer a conexão automaticamente."
              : "As mensagens da Pandora não estão sendo entregues. Toque para reconectar."}
          </p>
        </div>
        {!isReconnecting && (
          <button
            onClick={handleDismiss}
            className="focusable text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default WhatsAppDisconnectedBanner;
