import { Wifi, WifiOff, CloudOff, RefreshCw, Check } from "lucide-react";
import { useSyncQueue } from "@/hooks/common/useSyncQueue";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const SyncIndicator = () => {
  const { queue, pendingCount, isOnline, flush } = useSyncQueue();
  const [expanded, setExpanded] = useState(false);

  // Don't render anything if online and no pending ops
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 z-50 md:bottom-4 md:left-20">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shadow-lg backdrop-blur-xl transition-colors ${
          !isOnline
            ? "bg-destructive/90 text-destructive-foreground"
            : "bg-primary/90 text-primary-foreground"
        }`}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            Offline
          </>
        ) : (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
          </>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 w-72 rounded-xl bg-card/95 backdrop-blur-xl border border-border shadow-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-foreground">Fila de Sincronização</span>
              {isOnline && pendingCount > 0 && (
                <button
                  onClick={() => flush()}
                  className="text-[10px] text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Sincronizar
                </button>
              )}
            </div>

            {!isOnline && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-foreground/5 rounded-lg p-2">
                <CloudOff className="w-3.5 h-3.5 flex-shrink-0" />
                Suas alterações serão sincronizadas automaticamente ao reconectar.
              </div>
            )}

            {queue.length === 0 ? (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground p-2">
                <Check className="w-3.5 h-3.5" /> Nenhuma operação pendente
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {queue.map(op => (
                  <div key={op.id} className="flex items-center gap-2 p-2 rounded-lg bg-foreground/5 text-[11px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/70 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground/80 truncate">{op.label}</p>
                      <p className="text-muted-foreground text-[9px]">
                        {new Date(op.queuedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {op.retries > 0 && ` • ${op.retries} tentativa(s)`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SyncIndicator;
