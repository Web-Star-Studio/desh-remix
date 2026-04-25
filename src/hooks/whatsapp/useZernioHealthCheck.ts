/**
 * useZernioHealthCheck — runs ONCE at app startup (after auth) to verify the
 * server-side Zernio integration is configured. If `LATE_API_KEY` is missing
 * or rejected by Zernio, surfaces a clear, persistent toast so admins notice
 * before users hit a failed send.
 *
 * Why a hook (not a context): this check is cheap and only relevant for users
 * who can interact with WhatsApp Business. Mount it in the root layout once.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { verifyZernioCredentials } from "@/services/zernio/client";

const TOAST_ID = "zernio-credentials-warning";

export function useZernioHealthCheck() {
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    let cancelled = false;

    (async () => {
      // Only check for authenticated users — anon visitors don't need Zernio.
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;

      const health = await verifyZernioCredentials();
      if (cancelled || health.ok === true) return;

      const isMissing = health.code === "missing_api_key";
      const isInvalid = health.code === "invalid_api_key";

      if (isMissing) {
        toast.error("Integração Zernio não configurada", {
          id: TOAST_ID,
          description:
            "A chave LATE_API_KEY não está nos secrets do servidor. Adicione-a em Lovable Cloud → Secrets para habilitar envios via WhatsApp Business.",
          duration: 12_000,
        });
      } else if (isInvalid) {
        toast.error("Chave Zernio inválida ou expirada", {
          id: TOAST_ID,
          description:
            "A LATE_API_KEY foi rejeitada pela Zernio. Gere uma nova em zernio.com e atualize o secret.",
          duration: 12_000,
        });
      } else {
        // Network / proxy issues at startup are NOT shown — they may be transient
        // and would create noise. The pre-flight in `useSendWhatsAppMessage`
        // will surface them if they persist when the user tries to send.
        console.warn("[zernio-health] non-credential error at startup:", health);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
