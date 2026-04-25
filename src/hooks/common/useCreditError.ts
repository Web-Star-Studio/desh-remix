import { useEffect, useState, useCallback } from "react";

const CREDIT_ERROR_EVENT = "desh:credit-error";

/** Dispatch from anywhere to trigger the upgrade modal */
export function emitCreditError(reason?: string) {
  window.dispatchEvent(new CustomEvent(CREDIT_ERROR_EVENT, { detail: reason }));
}

/** Returns true if msg looks like a 402 / insufficient credits error */
export function isCreditError(msg: string): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes("402") ||
    lower.includes("insufficient_credits") ||
    lower.includes("créditos insuficientes") ||
    lower.includes("creditos insuficientes")
  );
}

/** Hook to listen for credit-error events and control the UpgradeModal */
export function useCreditErrorListener() {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setReason(typeof detail === "string" ? detail : "Seus créditos acabaram. Adquira mais para continuar usando os recursos de IA.");
      setOpen(true);
    };
    window.addEventListener(CREDIT_ERROR_EVENT, handler);
    return () => window.removeEventListener(CREDIT_ERROR_EVENT, handler);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setReason(undefined);
  }, []);

  return { open, reason, close };
}
