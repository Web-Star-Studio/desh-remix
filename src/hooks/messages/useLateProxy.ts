import { useCallback } from "react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { toast } from "sonner";

/**
 * useLateProxy — Wrapper around useEdgeFn for calling the `late-proxy` edge function.
 *
 * Guarda de cliente (fail-fast):
 * - Para rotas `/inbox/` (que exigem `accountId`), valida ANTES de chamar o
 *   proxy se o accountId está presente em query string ou body.
 * - Se ausente, exibe um toast amigável e retorna um erro estruturado SEM
 *   gastar uma ida ao edge function (que retornaria 400 de qualquer forma).
 *
 * Logging:
 * - Loga apenas erros que indicam problema *real* de payload/server (400/unknown),
 *   evitando ruído em situações normais (cold start, sessão expirada).
 * - Sanitiza a rota (sem query string) e nunca registra body/conteúdo de mensagens.
 */

const ACCOUNT_REQUIRED_PREFIX = "/inbox/";
const MISSING_ACCOUNT_MESSAGE =
  "Conta social desconectada. Reconecte sua integração para enviar mensagens.";

/** Rotas `/inbox/` que NÃO exigem accountId (allowlist). */
const ACCOUNT_OPTIONAL_ROUTES: ReadonlySet<string> = new Set([
  // Listagem global de conversas pode vir agregada por user; accountId é opcional.
  "/inbox/conversations",
]);

function routeRequiresAccountId(baseRoute: string): boolean {
  if (!baseRoute.startsWith(ACCOUNT_REQUIRED_PREFIX)) return false;
  return !ACCOUNT_OPTIONAL_ROUTES.has(baseRoute);
}

function hasAccountId(route: string, body?: object): boolean {
  if (/[?&]accountId=[^&]+/.test(route)) return true;
  if (body && typeof body === "object") {
    const v = (body as Record<string, unknown>).accountId;
    if (typeof v === "string" && v.trim().length > 0) return true;
  }
  return false;
}

export function useLateProxy() {
  const { invoke } = useEdgeFn();

  const lateInvoke = useCallback(
    async <T = unknown>(route: string, method: string = "GET", body?: object) => {
      const baseRoute = route.split("?")[0];

      // ─── Guard: bloqueia chamadas a /inbox/* sem accountId ─────────────────
      if (routeRequiresAccountId(baseRoute) && !hasAccountId(route, body)) {
        toast.error(MISSING_ACCOUNT_MESSAGE);
        // eslint-disable-next-line no-console
        console.warn("[lateInvoke] blocked: missing accountId", { route: baseRoute, method });
        return {
          data: null as T | null,
          error: MISSING_ACCOUNT_MESSAGE,
          code: "missing_account_id" as const,
        };
      }

      const result = await invoke<T>({
        fn: "late-proxy",
        body: { route, method, body },
      });

      // Only surface noisy logs for genuine bad-request / unknown errors.
      // Cold-start, session expiry, etc. já são tratados em camadas superiores.
      const shouldLog =
        !!result.error &&
        (result.code === "unknown" ||
          /\b400\b/.test(result.error) ||
          /accountid is required/i.test(result.error));

      if (shouldLog) {
        const hasAccountIdQuery = /[?&]accountId=/.test(route);
        const hasAccountIdBody = !!(body && (body as Record<string, unknown>).accountId);

        // eslint-disable-next-line no-console
        console.warn("[lateInvoke] error", {
          route: baseRoute,
          method,
          accountIdInQuery: hasAccountIdQuery,
          accountIdInBody: hasAccountIdBody,
          code: result.code,
        });
      }

      return result;
    },
    [invoke],
  );

  return { lateInvoke };
}
