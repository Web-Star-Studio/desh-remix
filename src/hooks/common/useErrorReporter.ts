// TODO: Migrar para edge function — acesso direto ao Supabase
import { useEffect, useRef, useCallback } from "react";
import { useAdminRole } from "@/hooks/admin/useAdminRole";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getSmartMessages, inferModule, type ErrorDetail } from "@/lib/errorMessages";

const DEDUP_WINDOW_MS = 5_000;

/**
 * Global error reporter hook.
 * - Listens to `desh:error` custom events, `window.onerror`, and `unhandledrejection`
 * - Shows admin-specific debug toasts vs. friendly user toasts
 * - Persists errors to `error_reports` table (fire-and-forget)
 */
export function useErrorReporter() {
  const { isAdmin } = useAdminRole();
  const isAdminRef = useRef(isAdmin);
  const recentRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  const isDuplicate = useCallback((key: string): boolean => {
    const now = Date.now();
    const last = recentRef.current.get(key);
    if (last && now - last < DEDUP_WINDOW_MS) return true;
    recentRef.current.set(key, now);
    // Cleanup old entries
    if (recentRef.current.size > 50) {
      for (const [k, v] of recentRef.current) {
        if (now - v > DEDUP_WINDOW_MS) recentRef.current.delete(k);
      }
    }
    return false;
  }, []);

  const persistError = useCallback(async (detail: ErrorDetail) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await (supabase.from("error_reports") as any).insert({
        user_id: session.user.id,
        severity: detail.severity || "error",
        module: detail.module || inferModule(detail.message || ""),
        message: (detail.message || "Unknown error").slice(0, 2000),
        stack: detail.stack?.slice(0, 4000) || null,
        metadata: detail.meta || {},
        user_agent: navigator.userAgent,
        url: window.location.href,
      });
    } catch {
      // Fire-and-forget — never block the UI
    }
  }, []);

  const handleError = useCallback((detail: ErrorDetail) => {
    // Skip credit errors (handled by UpgradeModal) and not_connected (handled by connection CTAs)
    if (detail.code === "insufficient_credits" || detail.code === "not_connected") {
      // Still persist for admin visibility
      persistError(detail);
      return;
    }

    const dedupKey = `${detail.code || ""}:${detail.module || ""}:${(detail.message || "").slice(0, 80)}`;
    if (isDuplicate(dedupKey)) return;

    if (!detail.module && detail.message) {
      detail.module = inferModule(detail.message);
    }

    // Always persist (even silent errors)
    persistError(detail);

    // If silent, caller handles their own UI — skip toast
    if (detail.silent) return;

    const msgs = getSmartMessages(detail);

    if (isAdminRef.current) {
      toast({
        variant: "destructive",
        title: msgs.adminTitle,
        description: msgs.adminDescription?.slice(0, 500),
        duration: 8000,
      });
    } else {
      toast({
        title: msgs.userTitle,
        description: msgs.userDescription,
        duration: 5000,
      });
    }
  }, [isDuplicate, persistError]);

  useEffect(() => {
    const onDeshError = (e: Event) => {
      const detail = (e as CustomEvent<ErrorDetail>).detail;
      handleError(detail);
    };

    const onWindowError = (e: ErrorEvent) => {
      handleError({
        message: e.message,
        stack: e.error?.stack,
        severity: "error",
      });
    };

    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled promise rejection";
      const stack = reason instanceof Error ? reason.stack : undefined;

      handleError({ message, stack, severity: "error" });
      e.preventDefault();
    };

    window.addEventListener("desh:error", onDeshError);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("desh:error", onDeshError);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [handleError]);
}

/** Utility to dispatch a desh:error event from anywhere.
 * By default shows a toast — pass `silent: true` to only persist. */
export function dispatchDeshError(detail: ErrorDetail) {
  window.dispatchEvent(new CustomEvent("desh:error", { detail }));
}

/**
 * Report an error with smart toast (admin=debug, user=friendly).
 * Use this INSTEAD of `toast({ variant: "destructive" })` in catch blocks.
 *
 * Example:
 * ```ts
 * import { reportError } from "@/hooks/common/useErrorReporter";
 * catch (e) { reportError(e, "finance"); }
 * ```
 */
export function reportError(
  error: unknown,
  module?: string,
  opts?: { severity?: ErrorDetail["severity"]; silent?: boolean; meta?: Record<string, unknown> }
) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Erro desconhecido";
  const stack = error instanceof Error ? error.stack : undefined;
  dispatchDeshError({
    message,
    stack,
    module,
    severity: opts?.severity || "error",
    silent: opts?.silent,
    meta: opts?.meta,
  });
}
