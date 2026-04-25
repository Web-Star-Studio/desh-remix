import { useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  variant?: "destructive" | "default";
}

const ConfirmDialog = ({
  open,
  onConfirm,
  onCancel,
  title = "Tem certeza?",
  description = "Esta ação não pode ser desfeita.",
  confirmLabel = "Confirmar",
  variant = "destructive",
}: ConfirmDialogProps) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Auto-focus confirm button so Enter works immediately
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-background border border-border rounded-xl shadow-2xl p-5 mx-4 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-lg flex-shrink-0 ${variant === "destructive" ? "bg-destructive/10" : "bg-primary/10"}`}>
                {variant === "destructive" ? (
                  <Trash2 className="w-5 h-5 text-destructive" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-foreground/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                ref={confirmBtnRef}
                onClick={() => { onConfirm(); onCancel(); }}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                  variant === "destructive"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
/** Hook for easy confirm dialog usage */
export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    onConfirm: () => void;
    title?: string;
    description?: string;
    confirmLabel?: string;
    variant?: "destructive" | "default";
  }>({ open: false, onConfirm: () => {} });

  const confirm = useCallback(
    (opts: {
      title?: string;
      description?: string;
      confirmLabel?: string;
      variant?: "destructive" | "default";
    }) =>
      new Promise<boolean>(resolve => {
        setState({
          open: true,
          onConfirm: () => resolve(true),
          ...opts,
        });
      }),
    []
  );

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onConfirm={state.onConfirm}
      onCancel={() => setState(prev => ({ ...prev, open: false }))}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      variant={state.variant}
    />
  );

  return { confirm, dialog };
}

export default ConfirmDialog;
