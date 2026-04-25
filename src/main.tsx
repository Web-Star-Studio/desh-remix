import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "@/lib/performance/webVitals";

// Boot performance monitor (LCP/CLS/INP). Listener attaches dynamically.
initWebVitals();

// ============================================================================
// CRITICAL: Mount React FIRST. PWA registration is deferred and isolated so
// any failure (missing workbox-window, virtual module resolution error, SW
// registration error) cannot block the loading screen or app boot.
// ============================================================================
createRoot(document.getElementById("root")!).render(<App />);

// ----------------------------------------------------------------------------
// PWA bootstrap — runs AFTER React mounts, fully wrapped in try/catch.
// ----------------------------------------------------------------------------
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

async function bootPWA() {
  if (isPreviewHost || isInIframe) {
    // Preview/iframe: unregister all SWs and clear caches — never register
    try {
      const regs = await navigator.serviceWorker?.getRegistrations();
      regs?.forEach((r) => r.unregister());
    } catch {}
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
    return;
  }

  // ---- Runtime preflight: verify workbox-window is resolvable ----
  // virtual:pwa-register depends on workbox-window. Probe it first so we can
  // emit a precise, actionable diagnostic instead of an opaque module error.
  const pwaDiagnostics: Record<string, unknown> = {
    serviceWorkerSupported: "serviceWorker" in navigator,
    cachesSupported: "caches" in window,
    secureContext: window.isSecureContext,
    userAgent: navigator.userAgent,
  };

  try {
    const wb = await import("workbox-window");
    pwaDiagnostics.workboxWindow = "ok";
    pwaDiagnostics.workboxExports = Object.keys(wb);
    console.info("[PWA] workbox-window detected", pwaDiagnostics);
  } catch (err: any) {
    pwaDiagnostics.workboxWindow = "missing";
    pwaDiagnostics.error = err?.message || String(err);
    pwaDiagnostics.errorName = err?.name;
    pwaDiagnostics.errorStack = err?.stack;
    console.error(
      "[PWA] workbox-window NOT available — service worker registration aborted.\n" +
      "Install with: npm install workbox-window",
      pwaDiagnostics
    );
    window.dispatchEvent(
      new CustomEvent("pwa-register-error", {
        detail: {
          message:
            "Dependência 'workbox-window' ausente. O app continua funcionando, mas o modo offline está desativado.",
          retry: async () => { await bootPWA(); },
        },
      })
    );
    return;
  }

  // Production: dynamically import virtual:pwa-register so any resolution
  // failure is caught gracefully.
  let registerSW: ((opts: any) => (reload?: boolean) => Promise<void>) | null = null;
  try {
    const mod = await import("virtual:pwa-register");
    registerSW = mod.registerSW;
    console.info("[PWA] virtual:pwa-register loaded successfully");
  } catch (err: any) {
    console.error(
      "[PWA] virtual:pwa-register unavailable — skipping SW registration",
      { ...pwaDiagnostics, registerError: err?.message, stack: err?.stack }
    );
    window.dispatchEvent(
      new CustomEvent("pwa-register-error", {
        detail: {
          message:
            "Módulo de atualização do app indisponível. Verifique o console para detalhes.",
          retry: async () => { await bootPWA(); },
        },
      })
    );
    return;
  }


  async function clearOldCaches() {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.includes("font")).map((k) => caches.delete(k))
      );
      console.log("[PWA] Old caches cleared");
    } catch {}
  }

  try {
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log("[PWA] New version available — auto-reloading in 3s");
        clearOldCaches().then(() => {
          window.dispatchEvent(new CustomEvent("pwa-update-available"));
          setTimeout(() => { window.location.reload(); }, 3500);
        });
      },
      onOfflineReady() {
        console.log("[PWA] Offline ready");
      },
      onRegisteredSW(_swUrl: string, r: ServiceWorkerRegistration | undefined) {
        if (!r) return;
        try { setInterval(() => { try { r.update(); } catch {} }, 30 * 1000); } catch {}
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") { try { r.update(); } catch {} }
        });
        window.addEventListener("focus", () => { try { r.update(); } catch {} });
        window.addEventListener("online", () => { try { r.update(); } catch {} });
      },
      onRegisterError(error: unknown) {
        console.error("[PWA] Service worker registration failed:", error);
        window.dispatchEvent(
          new CustomEvent("pwa-register-error", {
            detail: {
              message:
                (error as any)?.message ||
                "Não foi possível registrar o serviço de atualização do app.",
              retry: async () => { await bootPWA(); },
            },
          })
        );
      },
    });

    (window as any).__pwaUpdateSW = updateSW;
  } catch (err: any) {
    console.error("[PWA] registerSW threw synchronously:", err);
    window.dispatchEvent(
      new CustomEvent("pwa-register-error", {
        detail: {
          message: err?.message || "Erro inesperado ao registrar PWA.",
          retry: async () => { await bootPWA(); },
        },
      })
    );
  }
}

// Defer PWA boot to idle time so it never competes with first paint.
const scheduleBoot = () => {
  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(() => { bootPWA().catch(() => {}); }, { timeout: 3000 });
  } else {
    setTimeout(() => { bootPWA().catch(() => {}); }, 1000);
  }
};

if (document.readyState === "complete") {
  scheduleBoot();
} else {
  window.addEventListener("load", scheduleBoot, { once: true });
}
