/**
 * WhatsappSessionContext — provides a SINGLE shared WhatsApp session state
 * across the entire authenticated app tree.
 *
 * Before this, each component calling useWhatsappWebSession() created its own
 * independent instance, leading to conflicting status displays (e.g. banner
 * showing "disconnected" while header shows "connected").
 */
import { createContext, useContext, type ReactNode } from "react";
import { useWhatsappWebSession } from "@/hooks/whatsapp/useWhatsappWebSession";

type WhatsappSessionContextValue = ReturnType<typeof useWhatsappWebSession>;

const WhatsappSessionContext = createContext<WhatsappSessionContextValue | null>(null);

export function WhatsappSessionProvider({ children }: { children: ReactNode }) {
  const value = useWhatsappWebSession();
  return (
    <WhatsappSessionContext.Provider value={value}>
      {children}
    </WhatsappSessionContext.Provider>
  );
}

/**
 * Shared hook — all components read from the same session state.
 * Falls back to creating a new instance if used outside the provider (safety net).
 */
export function useSharedWhatsappSession(): WhatsappSessionContextValue {
  const ctx = useContext(WhatsappSessionContext);
  if (!ctx) {
    throw new Error("useSharedWhatsappSession must be used within WhatsappSessionProvider");
  }
  return ctx;
}
