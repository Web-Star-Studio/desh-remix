/**
 * useGoogleServiceData — Generic hook for fetching data from Google services
 * (Gmail, Calendar, Tasks, Drive) via apps/api's `/composio/execute`. Handles
 * connection detection, caching, QPM rate-limiting, and scope requests.
 *
 * Migrated off the legacy `composio-proxy` Supabase edge function. Each
 * (service, path) tuple maps to a discrete Composio action via
 * `composioCallFor()` below; response shape normalization stays in this file
 * because Composio's per-action payloads vary (event_data vs items vs files).
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { executeComposioAction, ComposioExecuteError } from "@/lib/composio-client";
import { useComposioConnection } from "./useComposioConnection";
import { useComposioWorkspaceId } from "./useComposioWorkspaceId";
import { recordGoogleSync } from "@/components/dashboard/GoogleStatusIndicator";

interface ComposioCall {
  toolkit: string;
  action: string;
  args: Record<string, unknown>;
}

/**
 * Translate the legacy `(service, path, params)` tuple into the Composio
 * action shape `(toolkit, action, args)`. Returns null when the path isn't
 * mapped — the hook surfaces an error in that case so future callers don't
 * silently fail.
 */
function composioCallFor(
  service: string,
  path: string,
  params: Record<string, string>,
): ComposioCall | null {
  const numOrUndef = (v: string | undefined) => (v ? Number(v) : undefined);

  if (service === "gmail") {
    if (path.includes("/messages")) {
      return {
        toolkit: "gmail",
        action: "GMAIL_FETCH_EMAILS",
        args: {
          max_results: numOrUndef(params.maxResults),
          query: params.q,
          label_ids: params.labelIds ? params.labelIds.split(",") : undefined,
          format: params.format,
        },
      };
    }
    if (path.includes("/labels")) {
      return { toolkit: "gmail", action: "GMAIL_LIST_LABELS", args: {} };
    }
    if (path.includes("/threads")) {
      return {
        toolkit: "gmail",
        action: "GMAIL_LIST_THREADS",
        args: {
          max_results: numOrUndef(params.maxResults),
          query: params.q,
        },
      };
    }
  }

  if (service === "calendar") {
    if (path.includes("/calendarList")) {
      return { toolkit: "googlecalendar", action: "GOOGLECALENDAR_LIST_CALENDARS", args: {} };
    }
    if (path.includes("/events")) {
      const m = path.match(/calendars\/([^/]+)\/events/);
      return {
        toolkit: "googlecalendar",
        action: "GOOGLECALENDAR_FIND_EVENT",
        args: {
          calendar_id: m?.[1] ? decodeURIComponent(m[1]) : "primary",
          time_min: params.timeMin,
          time_max: params.timeMax,
          max_results: numOrUndef(params.maxResults),
          single_events: params.singleEvents === "true" ? true : undefined,
          order_by: params.orderBy,
        },
      };
    }
  }

  if (service === "drive" && path.startsWith("/files")) {
    return {
      toolkit: "googledrive",
      action: "GOOGLEDRIVE_FIND_FILE",
      args: {
        page_size: numOrUndef(params.pageSize),
        q: params.q,
        order_by: params.orderBy,
        fields: params.fields,
      },
    };
  }

  if (service === "tasks") {
    if (path === "/users/@me/lists") {
      return { toolkit: "googletasks", action: "GOOGLETASKS_LIST_TASK_LISTS", args: {} };
    }
    const taskListMatch = path.match(/\/lists\/([^/]+)\/tasks/);
    if (taskListMatch) {
      return {
        toolkit: "googletasks",
        action: "GOOGLETASKS_LIST_TASKS",
        args: { tasklist_id: taskListMatch[1] },
      };
    }
  }

  return null;
}

interface UseGoogleServiceDataOptions {
  service: string;
  path: string;
  params?: Record<string, string>;
  pollingInterval?: number;
  enabled?: boolean;
}

interface UseGoogleServiceDataResult<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  refetch: () => void;
  connectionNames: string[];
  /** True when Google is connected but missing the scope for this service */
  needsScope: boolean;
  /** Call this to request only the missing scope via incremental auth */
  requestScope: () => void;
  /** Timestamp of last successful data fetch */
  lastSyncedAt: number | null;
  /** Workspace ID of the primary connection used for this service */
  connectionWorkspaceId: string | null;
  /** True when this service is connected via Composio (not legacy Google OAuth) */
  isComposio: boolean;
  /** True after the hook confirms whether the current workspace/entity really has an active connection */
  connectionVerified: boolean;
}

// ── Global serial queue + per-service QPM guard ──

const STAGGER_DELAY = 500; // ms between consecutive API calls (global)

/** Max calls per service per 60s window before forcing a cooldown */
const SERVICE_QPM_SOFT_LIMIT: Record<string, number> = {
  calendar: 8,
  gmail: 10,
  tasks: 10,
  people: 8,
  drive: 10,
};
const DEFAULT_QPM_SOFT = 8;

/** Timestamps of recent API calls, keyed by service */
const serviceCallTimestamps = new Map<string, number[]>();

function recordServiceCall(service: string) {
  const now = Date.now();
  const times = (serviceCallTimestamps.get(service) || []).filter(t => now - t < 60_000);
  times.push(now);
  serviceCallTimestamps.set(service, times);
}

/** Returns ms to wait before calling service, or 0 if OK */
function getServiceCooldown(service: string): number {
  const now = Date.now();
  const times = (serviceCallTimestamps.get(service) || []).filter(t => now - t < 60_000);
  const limit = SERVICE_QPM_SOFT_LIMIT[service] || DEFAULT_QPM_SOFT;
  if (times.length < limit) return 0;
  const oldest = times[0];
  return Math.max(0, oldest + 60_000 - now + 100);
}

let isQueueRunning = false;
const pendingQueue: Array<{ resolve: () => void; service: string; timer?: ReturnType<typeof setTimeout> }> = [];

/** Safety timeout to prevent queue from getting stuck forever */
const SLOT_TIMEOUT = 30_000;

/** Max queue depth — drop requests beyond this to prevent memory leaks */
const MAX_QUEUE_SIZE = 20;

async function acquireGoogleSlot(service: string): Promise<void> {
  const cooldown = getServiceCooldown(service);
  if (cooldown > 0) {
    await new Promise(r => setTimeout(r, Math.min(cooldown, 10_000)));
  }

  if (!isQueueRunning) {
    isQueueRunning = true;
    recordServiceCall(service);
    return;
  }

  // Prevent queue overflow — force through oldest entries
  if (pendingQueue.length >= MAX_QUEUE_SIZE) {
    const oldest = pendingQueue.shift()!;
    if (oldest.timer) clearTimeout(oldest.timer);
    console.warn(`[acquireGoogleSlot] Queue overflow (${MAX_QUEUE_SIZE}), forcing oldest (${oldest.service})`);
    recordServiceCall(oldest.service);
    oldest.resolve();
  }

  return new Promise<void>((resolve) => {
    const entry: { resolve: () => void; service: string; timer?: ReturnType<typeof setTimeout> } = { resolve, service };
    entry.timer = setTimeout(() => {
      const idx = pendingQueue.indexOf(entry);
      if (idx >= 0) {
        pendingQueue.splice(idx, 1);
        console.warn(`[acquireGoogleSlot] Timeout waiting for slot (${service}), forcing through`);
        recordServiceCall(service);
        resolve();
      }
    }, SLOT_TIMEOUT);
    pendingQueue.push(entry);
  });
}

function releaseGoogleSlot() {
  if (pendingQueue.length > 0) {
    const next = pendingQueue.shift()!;
    if (next.timer) clearTimeout(next.timer);
    const cooldown = getServiceCooldown(next.service);
    setTimeout(() => {
      recordServiceCall(next.service);
      next.resolve();
    }, Math.max(STAGGER_DELAY, cooldown));
  } else {
    isQueueRunning = false;
  }
}

// ── Smart cache with per-service TTLs and stale-while-revalidate ──

/** Per-service TTL configuration (ms) */
const SERVICE_TTL: Record<string, number> = {
  gmail: 180_000,      // 3min (was 1min)
  calendar: 300_000,   // 5min (was 2min)
  tasks: 600_000,      // 10min (was 5min)
  people: 900_000,     // 15min (was 5min)
  drive: 600_000,      // 10min (was 3min)
  default: 120_000,    // 2min (was 1min)
};

/** Stale window: serve stale data while revalidating in background */
const STALE_WINDOW = 30_000;

interface CacheEntry {
  data: any;
  timestamp: number;
  promise?: Promise<any>;
  /** Service name for TTL lookup */
  service: string;
}

const requestCache = new Map<string, CacheEntry>();

// ── localStorage persistent cache layer ──

const LS_CACHE_PREFIX = "desh_goog_";
const LS_MAX_ENTRIES = 20; // limit stored entries

function lsKey(cacheKey: string): string {
  // Short hash to avoid huge localStorage keys
  return LS_CACHE_PREFIX + cacheKey.replace(/[^a-zA-Z0-9_|]/g, "").slice(0, 80);
}

function evictOldLSEntries() {
  try {
    const entries: { key: string; timestamp: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(LS_CACHE_PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(k) || "");
        entries.push({ key: k, timestamp: parsed?.t || 0 });
      } catch {
        entries.push({ key: k, timestamp: 0 });
      }
    }
    if (entries.length <= LS_MAX_ENTRIES) return;
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = entries.slice(0, entries.length - LS_MAX_ENTRIES);
    for (const e of toRemove) localStorage.removeItem(e.key);
  } catch { /* noop */ }
}

function persistToLS(cacheKey: string, data: any, timestamp: number, service: string) {
  try {
    const key = lsKey(cacheKey);
    localStorage.setItem(key, JSON.stringify({ d: data, t: timestamp, s: service }));
    evictOldLSEntries();
  } catch {
    // localStorage full — evict and retry once
    try {
      evictOldLSEntries();
      localStorage.setItem(lsKey(cacheKey), JSON.stringify({ d: data, t: timestamp, s: service }));
    } catch { /* truly full */ }
  }
}

function hydrateFromLS(cacheKey: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(lsKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.d || !parsed?.t) return null;
    return { data: parsed.d, timestamp: parsed.t, service: parsed.s || "default" };
  } catch {
    return null;
  }
}

// ── Invalidation event emitter with debounce ──

type InvalidationListener = (service: string) => void;
const invalidationListeners = new Set<InvalidationListener>();

/** Debounced invalidation tracking to prevent duplicate fetches */
const pendingInvalidations = new Map<string, ReturnType<typeof setTimeout>>();
const INVALIDATION_DEBOUNCE_MS = 500;

function emitInvalidation(service: string) {
  // Clear any pending debounce for this service
  const existing = pendingInvalidations.get(service);
  if (existing) clearTimeout(existing);

  pendingInvalidations.set(service, setTimeout(() => {
    pendingInvalidations.delete(service);
    for (const listener of invalidationListeners) {
      listener(service);
    }
  }, INVALIDATION_DEBOUNCE_MS));
}

/** Invalidate all cache entries for a specific service */
export function invalidateGoogleCache(service: string) {
  for (const [key, entry] of requestCache.entries()) {
    if (entry.service === service) {
      requestCache.delete(key);
    }
  }
  emitInvalidation(service);
}

/** Invalidate all Google caches */
export function invalidateAllGoogleCache() {
  requestCache.clear();
  // Stagger invalidation events to avoid burst
  const services = ["calendar", "gmail", "tasks", "drive", "people"];
  services.forEach((s, i) => {
    setTimeout(() => emitInvalidation(s), i * 200);
  });
}

/** Normalize timestamps in params to nearest 30s to improve cache hit rate */
function normalizeParamsForCache(params: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      const seconds = Math.floor(date.getSeconds() / 30) * 30;
      date.setSeconds(seconds, 0);
      normalized[key] = date.toISOString();
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

function getCacheKey(service: string, path: string, params: Record<string, string>, connId: string) {
  return `${service}|${path}|${connId}|${JSON.stringify(normalizeParamsForCache(params))}`;
}

function getTTL(service: string): number {
  return SERVICE_TTL[service] || SERVICE_TTL.default;
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < getTTL(entry.service);
}

function isStale(entry: CacheEntry): boolean {
  const age = Date.now() - entry.timestamp;
  const ttl = getTTL(entry.service);
  return age >= ttl && age < ttl + STALE_WINDOW;
}

// ── Visibility-aware polling helpers ──

/** Returns current page visibility + a flag indicating a focus-regain transition */
function usePageVisible() {
  const [visible, setVisible] = useState(!document.hidden);
  const [justResumed, setJustResumed] = useState(false);
  useEffect(() => {
    const handler = () => {
      const nowVisible = !document.hidden;
      setVisible(nowVisible);
      if (nowVisible) {
        setJustResumed(true);
        // Reset after a tick so consumers can detect the transition
        setTimeout(() => setJustResumed(false), 100);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return { visible, justResumed };
}

export function useGoogleServiceData<T extends any[]>({
  service,
  path,
  params = {},
  pollingInterval,
  enabled = true,
}: UseGoogleServiceDataOptions): UseGoogleServiceDataResult<T> {
  const effectivePollingInterval = pollingInterval ?? getTTL(service);
  const { isConnected: isComposioConnected, loading: composioLoading } = useComposioConnection();
  const composioWorkspaceId = useComposioWorkspaceId();
  const [data, setData] = useState<T>([] as unknown as T);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const retryCount = useRef(0);
  const mountedRef = useRef(true);
  const [notConnectedFlag, setNotConnectedFlag] = useState(false);
  const [connectionVerified, setConnectionVerified] = useState(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { visible: pageVisible, justResumed } = usePageVisible();
  const errorBackoffRef = useRef(0);

  // Safety: auto-clear loading state after 25s
  const safeSetLoading = useCallback((val: boolean) => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    if (val) {
      loadingTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          console.warn(`[useGoogleServiceData] Loading timeout for ${service}${path}, forcing stop`);
          setIsLoading(false);
          setError("Timeout ao carregar dados");
        }
      }, 25_000);
    }
    setIsLoading(val);
  }, [service, path]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, []);

  // Map service names to Composio toolkit slugs
  const COMPOSIO_TOOLKIT_MAP: Record<string, string> = {
    calendar: "googlecalendar",
    gmail: "gmail",
    tasks: "googletasks",
    people: "googlecontacts",
    drive: "googledrive",
  };

  // Composio-only: no legacy fallback
  const composioToolkit = COMPOSIO_TOOLKIT_MAP[service] || "";
  const hasComposioConnection = composioToolkit ? isComposioConnected(composioToolkit) : false;

  const scopePrefix = service; // simplified — just for cache key generation

  const relevantConnections = useMemo(() => {
    if (hasComposioConnection) {
      return [{
        id: `composio-${service}`,
        google_user_id: "composio",
        email: "composio",
        display_name: "Composio",
        avatar_url: null,
        scopes: [scopePrefix],
        created_at: "",
        updated_at: "",
        workspace_id: null,
      }] as any[];
    }
    return [];
  }, [hasComposioConnection, service, scopePrefix]);

  const isConnected = relevantConnections.length > 0 && enabled && !notConnectedFlag;

  const needsScope = !isConnected && enabled && !composioLoading && connectionVerified;
  const requestScope = useCallback(() => {
    // No-op: scope requests now handled via Integrations page
    console.warn("[useGoogleServiceData] requestScope is deprecated — use Integrations page");
  }, []);

  // Reset connection validation when workspace changes
  useEffect(() => {
    setNotConnectedFlag(false);
    setConnectionVerified(false);
  }, [composioWorkspaceId]);

  // Auto-reset notConnectedFlag when composio confirms toolkit is connected
  useEffect(() => {
    if (notConnectedFlag && hasComposioConnection && !composioLoading) {
      console.debug(`[useGoogleServiceData] Composio confirms ${service} connected, resetting notConnectedFlag`);
      setNotConnectedFlag(false);
      setConnectionVerified(false);
    }
  }, [notConnectedFlag, hasComposioConnection, composioLoading, service]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const paramsKey = JSON.stringify(params);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const connIds = relevantConnections.map(c => c.id).join(",");

  // ── Hydrate from localStorage on mount ──
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !isConnected || relevantConnections.length === 0) return;
    hydratedRef.current = true;
    const conn = relevantConnections[0];
    const cacheKey = getCacheKey(service, path, params, conn.id);
    const cached = hydrateFromLS(cacheKey);
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      console.debug(`[useGoogleServiceData] Hydrated ${service}${path} from localStorage (${cached.data.length} items)`);
      setData(cached.data as T);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, connIds]);

  const fetchData = useCallback(async (force = false, background = false) => {
    if (!isConnected || relevantConnections.length === 0) return;

    const conn = relevantConnections[0];
    const cacheKey = getCacheKey(service, path, params, conn.id);
    const cached = requestCache.get(cacheKey);
    if (!force && cached) {
      if (cached.promise) {
        if (!background) safeSetLoading(true);
        try {
          const result = await cached.promise;
          if (mountedRef.current) {
            setData(result as T);
            setError(null);
          }
        } catch (err: any) {
          if (mountedRef.current) setError(err.message);
        } finally {
          if (mountedRef.current && !background) safeSetLoading(false);
        }
        return;
      }

      if (isFresh(cached) && cached.data) {
        if (mountedRef.current) {
          setData(cached.data as T);
          setError(null);
        }
        return;
      }

      if (isStale(cached) && cached.data) {
        if (mountedRef.current) {
          setData(cached.data as T);
          setError(null);
        }
        fetchData(true, true);
        return;
      }
    }

    if (!background) safeSetLoading(true);
    if (!background) setError(null);

    const fetchPromise = (async () => {
      await acquireGoogleSlot(service);
      try {
        const call = composioCallFor(service, path, params);
        if (!call) {
          throw new Error(`unmapped composio path: ${service}${path}`);
        }

        let result: any;
        try {
          result = await executeComposioAction<any>(
            composioWorkspaceId,
            call.toolkit,
            call.action,
            call.args,
          );
        } catch (err) {
          if (err instanceof ComposioExecuteError) {
            if (err.code === "not_connected") {
              console.warn(`[useGoogleServiceData] Not connected for ${service}${path}, disabling polling`);
              if (mountedRef.current) {
                setNotConnectedFlag(true);
                setConnectionVerified(true);
                safeSetLoading(false);
              }
              return;
            }
            if (err.code === "unauthorized") {
              console.warn(`[useGoogleServiceData] Auth error for ${service}${path}`);
              if (mountedRef.current) {
                setConnectionVerified(true);
              }
              return;
            }
          }
          throw err;
        }

        // Composio's tools.execute() typically returns { data, error, successful }.
        // Some actions surface rate-limits inline via the `error` field.
        if (result?.error) {
          const code = result.error.code;
          const isRateLimit = code === 403 || code === 429;
          if (isRateLimit && retryCount.current < 2) {
            retryCount.current++;
            const delay = 30_000 * retryCount.current + Math.random() * 5000;
            console.warn(`[useGoogleServiceData] Rate limited for ${service}${path}, backing off ${Math.round(delay / 1000)}s (attempt ${retryCount.current})`);
            await new Promise(r => setTimeout(r, delay));
            requestCache.delete(cacheKey);
            return fetchData(true);
          }
          if (isRateLimit) {
            requestCache.set(cacheKey, { data: cached?.data || [], timestamp: Date.now(), service });
            console.warn(`[useGoogleServiceData] Rate limit persists for ${service}${path}, using cached data and cooling down 60s`);
            if (cached?.data && mountedRef.current) {
              setData(cached.data as T);
            }
            return;
          }
          throw new Error(result.error.message || String(result.error));
        }

        retryCount.current = 0;
        errorBackoffRef.current = 0;
        // Composio's per-action payloads vary: { data: { event_data: [...] } },
        // { event_data: [...] }, { items: [...] }, { tasks: [...] }, etc. The
        // chain below picks the first array-shaped field we recognise.
        const eventData = Array.isArray(result?.data?.event_data) ? result.data.event_data
          : Array.isArray(result?.event_data) ? result.event_data
          : Array.isArray(result?.event_data?.event_data) ? result.event_data.event_data
          : null;
        const taskData = Array.isArray(result?.data?.tasks) ? result.data.tasks
          : Array.isArray(result?.tasks) ? result.tasks
          : null;
        const fileData = Array.isArray(result?.data?.files) ? result.data.files
          : Array.isArray(result?.files) ? result.files
          : null;
        const rawItems = result?.items || result?.messages || fileData || result?.connections || eventData || taskData || result?.events || result?.calendarList || result?.calendars || (Array.isArray(result) ? result : [result]);
        const events = Array.isArray(rawItems) ? rawItems : [rawItems];
        const uniqueEvents = events.filter((event: any, index: number, self: any[]) =>
          index === self.findIndex((e: any) => e.id && e.id === event.id)
        );
        return uniqueEvents;
      } finally {
        releaseGoogleSlot();
      }
    })();

    requestCache.set(cacheKey, { data: cached?.data, timestamp: cached?.timestamp || 0, promise: fetchPromise, service });

    try {
      const items = await fetchPromise;
      if (items !== undefined) {
        const now = Date.now();
        requestCache.set(cacheKey, { data: items, timestamp: now, service });
        // Persist to localStorage for instant hydration on next boot
        persistToLS(cacheKey, items, now, service);
        if (mountedRef.current) {
          setData(items as T);
          setError(null);
          setLastSyncedAt(now);
          setConnectionVerified(true);
          recordGoogleSync();
        }
      }
    } catch (err: any) {
      console.error(`[useGoogleServiceData] ${service}${path} error:`, err);
      requestCache.delete(cacheKey);
      if (mountedRef.current) {
        setError(err.message);
        setConnectionVerified(true);
      }
      // Exponential backoff: extend next poll delay on consecutive errors
      errorBackoffRef.current = Math.min(errorBackoffRef.current + 1, 5);
    } finally {
      if (mountedRef.current && !background) safeSetLoading(false);
    }
  }, [isConnected, connIds, service, path, paramsKey, safeSetLoading]);

  // Listen for selective invalidation events (debounced on emitter side)
  useEffect(() => {
    const listener: InvalidationListener = (invalidatedService) => {
      if (invalidatedService === "*" || invalidatedService === service) {
        fetchData(true);
      }
    };
    invalidationListeners.add(listener);
    return () => { invalidationListeners.delete(listener); };
  }, [service, fetchData]);

  // ── Visibility-aware polling with smart refetch-on-focus ──
  useEffect(() => {
    if (!isConnected) {
      // Avoid creating a new [] reference every render; only reset if non-empty.
      // Without this, setData([]) on every render triggers an infinite loop
      // when fetchData's deps are unstable.
      setData((prev) =>
        Array.isArray(prev) && prev.length === 0 ? prev : ([] as unknown as T),
      );
      return;
    }

    // On focus regain, force refetch if data is stale
    if (justResumed) {
      const conn = relevantConnections[0];
      if (conn) {
        const cacheKey = getCacheKey(service, path, params, conn.id);
        const cached = requestCache.get(cacheKey);
        if (!cached || !isFresh(cached)) {
          console.debug(`[useGoogleServiceData] Tab regained focus, refetching stale ${service}${path}`);
          fetchData(true, true); // background refetch
        }
      }
    }

    fetchData();

    // Only poll when page is visible
    if (!pageVisible) return;

    // Exponential backoff on errors: double interval per consecutive error (max 5x)
    const backoffMultiplier = Math.pow(2, errorBackoffRef.current);
    const adjustedInterval = Math.min(effectivePollingInterval * backoffMultiplier, 600_000); // cap at 10min
    const timer = setInterval(fetchData, adjustedInterval);
    return () => clearInterval(timer);
  }, [isConnected, fetchData, effectivePollingInterval, pageVisible, justResumed]);

  return {
    data,
    isLoading,
    error,
    isConnected,
    isComposio: hasComposioConnection,
    connectionVerified,
    refetch: () => fetchData(true),
    connectionNames: relevantConnections.map(c => `Google - ${c.email || c.display_name || "Conta"}`),
    needsScope,
    requestScope,
    lastSyncedAt,
    connectionWorkspaceId: relevantConnections[0]?.workspace_id ?? null,
  };
}
