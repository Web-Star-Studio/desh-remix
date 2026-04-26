// Legacy bridge — wraps `supabase.functions.invoke` for non-Composio edge fns
// (ai-router, serp-proxy, mapbox-proxy, late-proxy, finance-sync, pluggy-proxy,
// whatsapp-web, whatsapp-proxy, automation-execute). Each of these will be
// migrated to apps/api in its respective feature wave; until then this hook
// keeps the call shape stable. The defensive Supabase session checks were
// removed when the SPA moved to Cognito — Supabase JWTs no longer refresh,
// so a session_expired return on those edge fns is the correct, honest
// behavior. Composio callers have already moved to /composio/execute via
// the per-toolkit wrapper hooks.
import { useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dispatchDeshError } from "@/hooks/common/useErrorReporter";

interface UseEdgeFnOptions {
  /** Max number of retries on transient/auth errors (default: 1) */
  maxRetries?: number;
  /**
   * Max number of retries when the function is cold-starting (503 / boot).
   * Cold-start retries are *separate* from `maxRetries` because they can take
   * several seconds and should not eat into the auth-retry budget.
   * Default: 3 → ~0.6s + 1.2s + 2.4s = ~4.2s of wait time.
   */
  maxColdStartRetries?: number;
}

interface InvokeOptions<B = unknown> {
  /** Edge function name, e.g. "weather" or "composio-proxy" */
  fn: string;
  /** Optional JSON body */
  body?: B;
}

/** Known error codes returned by the invoke helper */
export type EdgeFnErrorCode =
  | "insufficient_credits"
  | "not_connected"
  | "timeout"
  | "bad_gateway"
  | "cold_start"
  | "session_expired"
  | "unknown";

/** Compute exponential backoff with jitter for cold-start retries. */
function coldStartBackoff(attempt: number): number {
  const base = 600;
  const exp = Math.min(base * Math.pow(2, attempt), 4_000);
  const jitter = exp * 0.2 * (Math.random() * 2 - 1);
  return Math.round(exp + jitter);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Module-scoped throttle so we don't spam the user with "warming up" toasts
 * when several components invoke cold functions in parallel.
 */
let lastColdStartToastAt = 0;
function notifyColdStart(fn: string) {
  const now = Date.now();
  if (now - lastColdStartToastAt < 8_000) return;
  lastColdStartToastAt = now;
  toast.loading("Acordando o serviço…", {
    id: `cold-start-${fn}`,
    description: "Primeira chamada após inatividade — aguarde alguns segundos.",
    duration: 5_000,
  });
}
function dismissColdStart(fn: string) {
  toast.dismiss(`cold-start-${fn}`);
}

/**
 * Centralised hook that wraps `supabase.functions.invoke` with:
 * 1. Automatic session check before every call
 * 2. Transparent token refresh + retry on 401 / auth errors
 * 3. **Cold-start retry** with exponential backoff on 503 / BOOT_ERROR
 * 4. Typed return value with structured error codes
 *
 * Usage:
 * ```ts
 * const { invoke } = useEdgeFn();
 * const data = await invoke<WeatherData>({ fn: "weather", body: { city: "SP" } });
 * ```
 */
export function useEdgeFn({ maxRetries = 1, maxColdStartRetries = 3 }: UseEdgeFnOptions = {}) {
  const invoke = useCallback(
    async <T = unknown>(opts: InvokeOptions): Promise<{ data: T | null; error: string | null; code?: EdgeFnErrorCode }> => {
      let lastError: string | null = null;
      let coldStartAttempts = 0;
      let notifiedColdStart = false;

      // Auth-retry loop is the OUTER loop; cold-start retries happen inside.
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const { data, error } = await supabase.functions.invoke(opts.fn, {
          body: opts.body,
        });

        if (!error) {
          if (notifiedColdStart) dismissColdStart(opts.fn);
          // Check for application-level errors in the response body
          if (data?.error === "not_connected") {
            dispatchDeshError({ silent: true, code: "not_connected", message: data.message || "Serviço não conectado", fn: opts.fn, severity: "warning" });
            return { data: null, error: data.message || "Serviço não conectado", code: "not_connected" };
          }
          if (data?.error === "timeout") {
            dispatchDeshError({ silent: true, code: "timeout", message: data.message || "Timeout na requisição", fn: opts.fn, severity: "warning" });
            return { data: null, error: data.message || "Timeout na requisição", code: "timeout" };
          }
          if (data?.error === "unexpected_html_response" || data?.error === "invalid_response") {
            dispatchDeshError({ silent: true, code: "bad_gateway", message: data.message || "Resposta inválida do servidor", fn: opts.fn, severity: "error" });
            return { data: null, error: data.message || "Resposta inválida do servidor", code: "bad_gateway" };
          }
          return { data: data as T, error: null };
        }

        // Try to extract the actual error body from FunctionsHttpError
        let msg: string;
        let statusCode: number | null = null;
        try {
          if (error && typeof error === "object" && "context" in error) {
            const ctx = (error as any).context;
            // Extract HTTP status code if available
            if (ctx && typeof ctx.status === "number") {
              statusCode = ctx.status;
            }
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              msg = body?.error ?? body?.message ?? JSON.stringify(body);
              // Detect specific error codes from response body
              if (body?.code) {
                const code = body.code;
                if (code === "not_connected" || code === "insufficient_credits" || code === "timeout") {
                  return { data: null, error: msg, code: code as EdgeFnErrorCode };
                }
              }
            } else {
              msg = "message" in error ? (error as any).message : String(error);
            }
          } else {
            msg = typeof error === "object" && "message" in error ? (error as any).message : String(error);
          }
        } catch {
          msg = typeof error === "object" && "message" in error ? (error as any).message : String(error);
        }
        lastError = msg;

        // ── Cold-start (503 / BOOT_ERROR) retry — runs BEFORE other branches ──
        const lower = msg.toLowerCase();
        const isColdStart =
          statusCode === 503 ||
          lower.includes("503") ||
          lower.includes("boot_error") ||
          lower.includes("worker_limit") ||
          lower.includes("function is starting") ||
          lower.includes("cold start") ||
          lower.includes("service unavailable");

        if (isColdStart && coldStartAttempts < maxColdStartRetries) {
          if (!notifiedColdStart) {
            notifyColdStart(opts.fn);
            notifiedColdStart = true;
          }
          const wait = coldStartBackoff(coldStartAttempts);
          coldStartAttempts++;
          console.warn(`[useEdgeFn] cold start on ${opts.fn} (status=${statusCode ?? "?"}), retry ${coldStartAttempts}/${maxColdStartRetries} in ${wait}ms`);
          await sleep(wait);
          // Re-attempt the same outer iteration without consuming auth-retry budget
          attempt--;
          continue;
        }

        // Detect credit/billing errors (402)
        const isCreditErr =
          statusCode === 402 ||
          msg.includes("402") ||
          msg.includes("insufficient_credits") ||
          msg.toLowerCase().includes("créditos insuficientes") ||
          msg.toLowerCase().includes("creditos insuficientes");

        if (isCreditErr) {
          if (notifiedColdStart) dismissColdStart(opts.fn);
          dispatchDeshError({ silent: true, code: "insufficient_credits", message: msg, fn: opts.fn, severity: "warning" });
          return { data: null, error: msg, code: "insufficient_credits" };
        }

        // Detect not_connected errors (401 from composio-proxy but NOT an auth issue)
        const isNotConnected = msg.includes("not_connected") || msg.includes("não conectou");
        if (isNotConnected) {
          if (notifiedColdStart) dismissColdStart(opts.fn);
          dispatchDeshError({ silent: true, code: "not_connected", message: msg, fn: opts.fn, severity: "warning" });
          return { data: null, error: msg, code: "not_connected" };
        }

        // Detect timeout errors (504)
        const isTimeout = statusCode === 504 || msg.includes("timeout") || msg.includes("Timeout");
        if (isTimeout) {
          if (notifiedColdStart) dismissColdStart(opts.fn);
          dispatchDeshError({ silent: true, code: "timeout", message: msg, fn: opts.fn, severity: "warning" });
          return { data: null, error: msg, code: "timeout" };
        }

        // Detect bad gateway (502) — HTML response / invalid JSON
        const isBadGateway = statusCode === 502 || msg.includes("unexpected_html_response") || msg.includes("invalid_response");
        if (isBadGateway) {
          if (notifiedColdStart) dismissColdStart(opts.fn);
          dispatchDeshError({ silent: true, code: "bad_gateway", message: msg, fn: opts.fn, severity: "error" });
          return { data: null, error: msg, code: "bad_gateway" };
        }

        const isAuthError =
          statusCode === 401 ||
          msg.includes("401") ||
          msg.includes("JWT") ||
          msg.includes("jwt") ||
          msg.includes("Unauthorized") ||
          msg.includes("session") ||
          msg.toLowerCase().includes("unauthorized");

        if (isAuthError) {
          // Supabase JWT is no longer refreshable post-Cognito-swap; surface
          // session_expired immediately so callers can prompt re-auth or fall
          // back to a different code path. Their feature-wave migration will
          // remove this branch entirely.
          if (notifiedColdStart) dismissColdStart(opts.fn);
          dispatchDeshError({ silent: true, code: "session_expired", message: "Sessão expirada. Faça login novamente.", fn: opts.fn, severity: "error" });
          return { data: null, error: "Sessão expirada. Faça login novamente.", code: "session_expired" };
        }

        // Non-auth error or exhausted retries
        break;
      }

      // Exhausted cold-start retries → surface a clear message
      if (notifiedColdStart) {
        dismissColdStart(opts.fn);
        toast.error("Serviço demorando mais que o esperado", {
          description: "Tente novamente em instantes — o servidor ainda está acordando.",
        });
        dispatchDeshError({
          silent: true,
          code: "cold_start",
          message: lastError || "Cold start exhausted",
          fn: opts.fn,
          severity: "warning",
        });
        return { data: null, error: lastError || "O serviço ainda está iniciando. Tente novamente.", code: "cold_start" };
      }

      dispatchDeshError({ silent: true,
        code: "unknown",
        message: lastError || "Unknown edge function error",
        fn: opts.fn,
        module: undefined,
        severity: "error",
      });
      return { data: null, error: lastError, code: "unknown" };
    },
    [maxRetries, maxColdStartRetries],
  );

  return { invoke };
}
