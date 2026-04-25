import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, RotateCw } from "lucide-react";

type PWARegisterErrorDetail = {
  message?: string;
  retry?: () => Promise<void> | void;
};

const PWARegisterErrorBanner = () => {
  const [error, setError] = useState<PWARegisterErrorDetail | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PWARegisterErrorDetail>).detail || {};
      setError(detail);
      setRetrying(false);
    };
    window.addEventListener("pwa-register-error", handler as EventListener);
    return () => window.removeEventListener("pwa-register-error", handler as EventListener);
  }, []);

  const handleRetry = async () => {
    if (!error?.retry) return;
    setRetrying(true);
    try {
      await error.retry();
      setError(null);
    } catch (err) {
      console.error("[PWA] Retry failed:", err);
      setRetrying(false);
    }
  };

  const handleDismiss = () => setError(null);

  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md"
        >
          <div className="glass-card border border-destructive/30 bg-destructive/10 backdrop-blur-xl rounded-xl px-4 py-3 flex items-start gap-3 shadow-lg">
            <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">
                Falha ao preparar o app offline
              </p>
              <p className="text-[11px] text-foreground/70 mt-0.5 line-clamp-2">
                {error.message || "Não foi possível registrar o serviço de atualização."}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleRetry}
                disabled={retrying || !error.retry}
                className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors whitespace-nowrap flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCw className={`w-3 h-3 ${retrying ? "animate-spin" : ""}`} />
                {retrying ? "Tentando…" : "Tentar novamente"}
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-foreground/50 hover:text-foreground/80 transition-colors"
                aria-label="Dispensar"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWARegisterErrorBanner;
