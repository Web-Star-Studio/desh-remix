/**
 * Web Vitals monitoring (LCP, CLS, INP, FCP, TTFB).
 * Reports to console in dev and to Supabase `error_reports` table
 * (severity: 'info', module: 'web-vitals') in production for slow metrics only.
 *
 * Thresholds follow Google's "needs-improvement"/"poor" guidance:
 *   LCP > 2500ms, CLS > 0.1, INP > 200ms, FCP > 1800ms, TTFB > 800ms
 */
import type { Metric } from "web-vitals";

const THRESHOLDS: Record<string, number> = {
  LCP: 2500,
  CLS: 0.1,
  INP: 200,
  FCP: 1800,
  TTFB: 800,
};

let reported = false;

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
}

function getConnection(): { effectiveType?: string; downlink?: number; rtt?: number } {
  if (typeof navigator === "undefined") return {};
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (!conn) return {};
  return { effectiveType: conn.effectiveType, downlink: conn.downlink, rtt: conn.rtt };
}

async function reportToBackend(metric: Metric) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const conn = getConnection();
    await supabase.from("error_reports").insert({
      severity: "info",
      module: "web-vitals",
      message: `${metric.name}: ${Math.round(metric.value)}${metric.name === "CLS" ? "" : "ms"} (${metric.rating})`,
      url: typeof window !== "undefined" ? window.location.pathname : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      metadata: {
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
        mobile: isMobile(),
        ...conn,
      },
    });
  } catch {
    // Silent — performance reporting must never break the app
  }
}

function handleMetric(metric: Metric) {
  const threshold = THRESHOLDS[metric.name];
  const exceeds = threshold !== undefined && metric.value > threshold;

  if (import.meta.env.DEV) {
    const tag = exceeds ? "⚠️" : "✅";
    // eslint-disable-next-line no-console
    console.info(
      `${tag} [vitals] ${metric.name}=${Math.round(metric.value)}${metric.name === "CLS" ? "" : "ms"} (${metric.rating})`
    );
    return;
  }

  // Prod: only report poor/needs-improvement to keep volume low
  if (metric.rating === "good") return;
  reportToBackend(metric);
}

/**
 * Initialise Web Vitals monitoring. Safe to call multiple times — only the
 * first call attaches listeners. No-op in SSR.
 */
export function initWebVitals() {
  if (typeof window === "undefined" || reported) return;
  reported = true;

  // Dynamic import — keeps the library out of the critical path
  import("web-vitals").then(({ onLCP, onCLS, onINP, onFCP, onTTFB }) => {
    onLCP(handleMetric);
    onCLS(handleMetric);
    onINP(handleMetric);
    onFCP(handleMetric);
    onTTFB(handleMetric);
  });
}
