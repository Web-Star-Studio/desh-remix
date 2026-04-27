/**
 * useZernioHealthCheck — workspace-scoped health probe. Runs once per active
 * workspace after auth and surfaces a persistent toast if the server-side
 * Zernio integration isn't configured (ZERNIO_API_KEY missing or invalid).
 *
 * Why per-workspace and not global: the new apps/api routes are
 * workspace-scoped. The probe hits `/workspaces/:id/zernio/health`, which is
 * cheap and confirms both the API key and network in one round-trip.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { verifyZernioCredentials } from "@/services/zernio/client";

const TOAST_ID = "zernio-credentials-warning";

export function useZernioHealthCheck() {
  const { activeWorkspaceId } = useWorkspace();
  const checkedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    if (checkedFor.current === activeWorkspaceId) return;
    checkedFor.current = activeWorkspaceId;

    let cancelled = false;
    (async () => {
      const health = await verifyZernioCredentials(activeWorkspaceId);
      if (cancelled || health.ok === true) return;

      if (health.code === "not_configured") {
        toast.error("Integração Zernio não configurada", {
          id: TOAST_ID,
          description:
            "ZERNIO_API_KEY não está nos secrets do servidor. Adicione-a em apps/api/.env para habilitar envios via WhatsApp Business.",
          duration: 12_000,
        });
      } else if (health.code === "unauthorized" || health.code === "forbidden") {
        toast.error("Chave Zernio rejeitada", {
          id: TOAST_ID,
          description:
            "A ZERNIO_API_KEY foi rejeitada pela Zernio. Gere uma nova em zernio.com/dashboard/api-keys e atualize o secret.",
          duration: 12_000,
        });
      } else {
        // Network / 5xx at startup are NOT shown — likely transient, would
        // create noise. Send-time errors will surface them if persistent.
        // eslint-disable-next-line no-console
        console.warn("[zernio-health] non-credential error at startup:", health);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);
}
