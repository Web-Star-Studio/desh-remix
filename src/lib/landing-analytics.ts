/**
 * Lightweight, privacy-friendly analytics for the landing page.
 *
 * - No external SDKs or network calls — events are written to
 *   `window.dataLayer` (Google Tag Manager convention) and dispatched as
 *   a `desh:analytics` CustomEvent so any provider can consume them later.
 * - Rate-limits scroll events (only fires once per depth bucket per session).
 * - Respects DNT and disables tracking when the user has not accepted cookies
 *   (consent is read from localStorage `desh-cookie-consent`).
 */

export type LandingEventName =
  | "cta_click"
  | "scroll_depth"
  | "faq_open"
  | "pandora_open"
  | "pandora_message_sent"
  | "section_view"
  | "page_view";

export interface LandingEventPayload {
  // Where the event happened (component / section).
  location?: string;
  // Free-form label (e.g. CTA copy, FAQ question).
  label?: string;
  // Numeric value (e.g. scroll percentage).
  value?: number;
  // Any extra context.
  [key: string]: unknown;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const SESSION_KEY = "desh-landing-analytics-session";
const CONSENT_KEY = "desh-cookie-consent";

function hasConsent(): boolean {
  if (typeof window === "undefined") return false;
  // Respect Do Not Track.
  const dnt = (navigator as Navigator & { doNotTrack?: string }).doNotTrack;
  if (dnt === "1" || dnt === "yes") return false;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return true; // default-on until user explicitly opts out
    const parsed = JSON.parse(raw);
    // Accept either { analytics: true } or string "accepted"/"rejected".
    if (typeof parsed === "string") return parsed !== "rejected";
    if (parsed && typeof parsed === "object") {
      if ("analytics" in parsed) return Boolean(parsed.analytics);
      if ("accepted" in parsed) return Boolean(parsed.accepted);
    }
    return true;
  } catch {
    return true;
  }
}

function getSession(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Record<string, true>) : {};
  } catch {
    return {};
  }
}

function markSession(key: string) {
  if (typeof window === "undefined") return;
  try {
    const session = getSession();
    session[key] = true;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* noop */
  }
}

export function trackLandingEvent(
  event: LandingEventName,
  payload: LandingEventPayload = {}
) {
  if (typeof window === "undefined") return;
  if (!hasConsent()) return;

  const data = {
    event: `desh_${event}`,
    timestamp: Date.now(),
    path: window.location.pathname,
    ...payload,
  };

  // GTM-friendly dataLayer push.
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(data);

  // Custom event so the app (or future providers) can listen in.
  try {
    window.dispatchEvent(new CustomEvent("desh:analytics", { detail: data }));
  } catch {
    /* noop */
  }

  // Dev-only console log to make instrumentation visible while building.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", data);
  }
}

/**
 * Initialize global scroll-depth tracking. Returns a cleanup function.
 * Fires once per bucket (25 / 50 / 75 / 100 %) per session.
 */
export function initScrollDepthTracking(): () => void {
  if (typeof window === "undefined") return () => {};
  const buckets = [25, 50, 75, 100];
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const height = (doc.scrollHeight - doc.clientHeight) || 1;
      const pct = Math.min(100, Math.round((scrollTop / height) * 100));
      const session = getSession();
      for (const b of buckets) {
        const key = `scroll_${b}`;
        if (pct >= b && !session[key]) {
          markSession(key);
          trackLandingEvent("scroll_depth", { value: b, location: "landing" });
        }
      }
      ticking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  // Fire once on mount in case page already scrolled (e.g. anchor link).
  onScroll();
  return () => window.removeEventListener("scroll", onScroll);
}

/**
 * Track a CTA click. `location` should be a stable id (e.g. "hero_primary").
 */
export function trackCtaClick(location: string, label?: string) {
  trackLandingEvent("cta_click", { location, label });
}
