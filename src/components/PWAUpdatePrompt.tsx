import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";

const PWAUpdatePrompt = () => {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener("pwa-update-available", handler);
    return () => window.removeEventListener("pwa-update-available", handler);
  }, []);

  useEffect(() => {
    if (!show) return;
    setCountdown(3);
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [show]);

  const handleUpdate = () => {
    clearInterval(intervalRef.current);
    const updateSW = (window as any).__pwaUpdateSW;
    if (updateSW) updateSW(true);
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm"
        >
          <div className="glass-card border border-primary/20 bg-primary/10 backdrop-blur-xl rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
            <RefreshCw className="w-4 h-4 text-primary flex-shrink-0 animate-spin" />
            <p className="text-xs text-foreground flex-1">
              Atualizando em {countdown}s…
            </p>
            <button
              onClick={handleUpdate}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
            >
              Atualizar agora
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PWAUpdatePrompt;
