// TODO: Migrar para edge function — acesso direto ao Supabase
/**
 * useCalendarSync — Extracted from CalendarPage
 * Handles full + incremental Google Calendar sync with persisted cache.
 */
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useEdgeFn } from "@/hooks/ai/useEdgeFn";
import { usePersistedWidget } from "@/hooks/ui/usePersistedWidget";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useComposioWorkspaceId, useDefaultWorkspaceId } from "@/hooks/integrations/useComposioWorkspaceId";
import type { EventCategory, RecurrenceType } from "@/types/calendar";
import type { ComposioCalendarEvent } from "@/types/composio";

const isNotConnectedError = (message?: string | null) => {
  const normalized = (message || "").toLowerCase();
  return normalized.includes("not_connected") || normalized.includes("não conectou");
};

interface PersistedSyncData {
  events: any[];
  syncedAt: number | null;
  syncTokens: Record<string, string>;
  incrementalSyncedAt: number | null;
}

/**
 * useCalendarSync — Handles full + incremental Google Calendar sync with persisted cache.
 * Uses composio-proxy to fetch events and stores them locally for offline access.
 * @param googleConnected - Whether Google Calendar is connected via Composio
 * @param secondaryCalendars - Additional calendars beyond primary
 * @param mapGoogleEvent - Maps raw Composio event to the app's CalendarEvent format
 * @param usingComposio - When true, skips secondary calendar sync (Composio returns all)
 */
export function useCalendarSync({
  googleConnected,
  connectionVerified,
  secondaryCalendars,
  mapGoogleEvent,
  usingComposio = false,
}: {
  googleConnected: boolean;
  connectionVerified: boolean;
  secondaryCalendars: any[];
  mapGoogleEvent: (e: ComposioCalendarEvent, color: string, idx: number, calendarId?: string) => any;
  usingComposio?: boolean;
}) {
  const { invoke } = useEdgeFn();
  const { user } = useAuth();
  const composioWorkspaceId = useComposioWorkspaceId();
  const defaultWorkspaceId = useDefaultWorkspaceId();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const {
    data: persistedSync,
    save: savePersistedSync,
    loading: persistedSyncLoading,
    clearCache: clearSyncCache,
  } = usePersistedWidget<PersistedSyncData>({
    key: "calendar_full_sync",
    defaultValue: { events: [], syncedAt: null, syncTokens: {}, incrementalSyncedAt: null },
    debounceMs: 500,
  });

  const fullSyncEvents = persistedSync.events;
  const fullSyncLastSyncedAt = persistedSync.syncedAt;
  const syncTokens = persistedSync.syncTokens ?? {};
  const incrementalSyncedAt = persistedSync.incrementalSyncedAt ?? null;

  // Slim event payload before persisting — keeps localStorage well below the 5MB quota
  // even with thousands of events. Heavy fields (raw description HTML, full attendee
  // metadata, recurrence blobs) are dropped from the cached copy. The full data still
  // flows through React state during the active session.
  const slimEvent = useCallback((e: any) => {
    if (!e || typeof e !== "object") return e;
    const { rawData, raw, attendees, description, recurrence, conferenceData, ...rest } = e;
    return {
      ...rest,
      // Keep a short truncated description so previews still work after reload
      description: typeof description === "string" ? description.slice(0, 240) : undefined,
      attendeesCount: Array.isArray(attendees) ? attendees.length : 0,
    };
  }, []);

  const setFullSyncEvents = useCallback((events: any[], newTokens?: Record<string, string>) => {
    if (!mountedRef.current) return;
    savePersistedSync({
      events: events.map(slimEvent),
      syncedAt: Date.now(),
      syncTokens: newTokens ?? persistedSync.syncTokens ?? {},
      incrementalSyncedAt: persistedSync.incrementalSyncedAt ?? null,
    });
  }, [savePersistedSync, persistedSync.syncTokens, persistedSync.incrementalSyncedAt, slimEvent]);

  const [fullSyncStatus, setFullSyncStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [fullSyncProgress, setFullSyncProgress] = useState<{ fetched: number; pages: number } | null>(null);
  const [lastSyncType, setLastSyncType] = useState<"full" | "incremental" | null>(null);
  const fullSyncAbortRef = useRef(false);

  const runFullSync = useCallback(async () => {
    if (!googleConnected) return;
    fullSyncAbortRef.current = false;
    setFullSyncStatus("running");
    setLastSyncType("full");
    setFullSyncProgress({ fetched: 0, pages: 0 });

    const timeMin = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const allFetched: any[] = [];
    let pageToken: string | undefined;
    let pages = 0;
    const newTokens: Record<string, string> = {};

    try {
      do {
        if (fullSyncAbortRef.current || !mountedRef.current) break;
        const params: Record<string, string> = {
          timeMin, singleEvents: "true", orderBy: "startTime", maxResults: "2500",
        };
        if (pageToken) params.pageToken = pageToken;

        const { data, error: fnError } = await invoke<any>({
          fn: "composio-proxy",
          body: {
            service: "calendar",
            path: "/calendars/primary/events",
            method: "GET",
            params,
            workspace_id: composioWorkspaceId,
            default_workspace_id: defaultWorkspaceId,
          },
        });
        if (fnError) throw new Error(fnError);
        if (data?.error) throw new Error(data.error.message || JSON.stringify(data.error));

        const rawData = data?.data?.event_data || data?.event_data || data?.items || data?.data || data;
        const items: any[] = Array.isArray(rawData) ? rawData : Array.isArray(rawData?.event_data) ? rawData.event_data : [];
        allFetched.push(...items.map((e: any) => ({ ...e, _calId: "primary" })));
        pages++;
        pageToken = data?.nextPageToken;
        if (!pageToken && data?.nextSyncToken) newTokens["primary"] = data.nextSyncToken;
        if (mountedRef.current) setFullSyncProgress({ fetched: allFetched.length, pages });
        if (pageToken) await new Promise(r => setTimeout(r, 300));
      } while (pageToken);

      // Skip secondary calendar sync when using Composio
      // Composio FIND_EVENT already returns all calendar events
      if (!usingComposio) {
        for (const cal of secondaryCalendars) {
          if (fullSyncAbortRef.current || !mountedRef.current) break;
          let secPageToken: string | undefined;
          do {
            const params: Record<string, string> = {
              timeMin, singleEvents: "true", orderBy: "startTime", maxResults: "2500",
            };
            if (secPageToken) params.pageToken = secPageToken;
            const { data: secData } = await invoke<any>({
              fn: "composio-proxy",
              body: {
                service: "calendar",
                path: `/calendars/${encodeURIComponent(cal.id)}/events`,
                method: "GET",
                params,
                workspace_id: composioWorkspaceId,
                default_workspace_id: defaultWorkspaceId,
              },
            });
            const rawSecData = secData?.data?.event_data || secData?.event_data || secData?.items || secData?.data || secData;
            const secItems: any[] = Array.isArray(rawSecData) ? rawSecData : Array.isArray(rawSecData?.event_data) ? rawSecData.event_data : [];
            allFetched.push(...secItems.map((e: any) => ({ ...e, _calId: cal.id })));
            secPageToken = secData?.nextPageToken;
            if (!secPageToken && secData?.nextSyncToken) newTokens[cal.id] = secData.nextSyncToken;
            if (mountedRef.current) setFullSyncProgress(p => ({ fetched: allFetched.length, pages: (p?.pages || 0) + 1 }));
            if (secPageToken) await new Promise(r => setTimeout(r, 300));
          } while (secPageToken);
        }
      }

      const mapped = allFetched
        .filter(e => e.start?.dateTime || e.start?.date)
        .map((e, i) => mapGoogleEvent(e, "bg-primary", i, e._calId || "primary"));

      if (mountedRef.current) {
        setFullSyncEvents(mapped, newTokens);
        setFullSyncStatus("done");
        setFullSyncProgress(prev => ({ ...prev!, fetched: mapped.length }));
        toast({ title: "Sincronização completa!", description: `${mapped.length} eventos importados e salvos localmente.` });

        // Background sync to Supabase cache (fire and forget)
        if (user && allFetched.length > 0) {
          supabase.from('calendar_events_cache').upsert(
            allFetched
              .filter(e => e.start?.dateTime || e.start?.date)
              .map(e => ({
                user_id: user.id,
                event_id: e.id,
                title: e.summary || null,
                start_at: e.start?.dateTime || e.start?.date || null,
                end_at: e.end?.dateTime || e.end?.date || null,
                location: e.location || null,
                description: e.description || null,
                attendees: e.attendees || [],
                composio_synced_at: new Date().toISOString(),
              })),
            { onConflict: 'user_id,event_id' }
          ).then(({ error }) => {
            if (error) console.warn('[CalendarCache] Sync error:', error.message);
          });
        }
      }
    } catch (err: any) {
      if (mountedRef.current) {
        if (isNotConnectedError(err?.message)) {
          savePersistedSync({ events: [], syncedAt: null, syncTokens: {}, incrementalSyncedAt: null });
          setFullSyncProgress(null);
          setFullSyncStatus("idle");
          return;
        }

        setFullSyncStatus("error");
        toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
      }
    }
  }, [googleConnected, invoke, secondaryCalendars, mapGoogleEvent, setFullSyncEvents, savePersistedSync, composioWorkspaceId, defaultWorkspaceId]);

  const runIncrementalSync = useCallback(async () => {
    if (!googleConnected) return;
    if (Object.keys(syncTokens).length === 0) { runFullSync(); return; }
    fullSyncAbortRef.current = false;
    setFullSyncStatus("running");
    setLastSyncType("incremental");
    setFullSyncProgress({ fetched: 0, pages: 0 });

    try {
      let currentEvents = [...fullSyncEvents];
      const updatedTokens = { ...syncTokens };
      let totalDelta = 0;

      const applyDelta = (deltaItems: any[], calId: string) => {
        deltaItems.forEach((e: any) => {
          const googleId = e.id;
          if (e.status === "cancelled") {
            currentEvents = currentEvents.filter(ev => ev.googleId !== googleId);
          } else if (e.start?.dateTime || e.start?.date) {
            const mapped = mapGoogleEvent(e, "bg-primary", 0, calId);
            const idx = currentEvents.findIndex(ev => ev.googleId === googleId);
            if (idx >= 0) currentEvents[idx] = mapped;
            else currentEvents.push(mapped);
          }
        });
        totalDelta += deltaItems.length;
      };

      const primaryToken = syncTokens["primary"];
      if (primaryToken) {
        let pageToken: string | undefined;
        let lastData: any;
        do {
          if (!mountedRef.current) return;
          const params: Record<string, string> = { maxResults: "2500" };
          if (pageToken) params.pageToken = pageToken;
          else params.syncToken = primaryToken;

          const { data, error: fnError } = await invoke<any>({
            fn: "composio-proxy",
            body: {
              service: "calendar",
              path: "/calendars/primary/events",
              method: "GET",
              params,
              workspace_id: composioWorkspaceId,
              default_workspace_id: defaultWorkspaceId,
            },
          });
          if (fnError) throw new Error(fnError);
          if (data?.error?.code === 410) { await runFullSync(); return; }
          if (data?.error) throw new Error(data.error.message || JSON.stringify(data.error));

          const rawDelta = data?.data?.event_data || data?.event_data || data?.items || data?.data || data;
          const deltaItems = Array.isArray(rawDelta) ? rawDelta : Array.isArray(rawDelta?.event_data) ? rawDelta.event_data : [];
          applyDelta(deltaItems, "primary");
          pageToken = data?.nextPageToken;
          lastData = data;
          if (mountedRef.current) setFullSyncProgress({ fetched: totalDelta, pages: 0 });
          if (pageToken) await new Promise(r => setTimeout(r, 300));
        } while (pageToken);
        if (lastData?.nextSyncToken) updatedTokens["primary"] = lastData.nextSyncToken;
      }

      if (!usingComposio) {
        for (const cal of secondaryCalendars) {
          if (fullSyncAbortRef.current || !mountedRef.current) break;
          const calToken = syncTokens[cal.id];
          if (!calToken) continue;
          let pageToken: string | undefined;
          let lastSecData: any;
          do {
            const params: Record<string, string> = { maxResults: "2500" };
            if (pageToken) params.pageToken = pageToken;
            else params.syncToken = calToken;

            const { data: secData } = await invoke<any>({
              fn: "composio-proxy",
              body: {
                service: "calendar",
                path: `/calendars/${encodeURIComponent(cal.id)}/events`,
                method: "GET",
                params,
                workspace_id: composioWorkspaceId,
                default_workspace_id: defaultWorkspaceId,
              },
            });
            if (secData?.error?.code === 410) { await runFullSync(); return; }
            const rawSecDelta = secData?.data?.event_data || secData?.event_data || secData?.items || secData?.data || secData;
            const secDeltaItems = Array.isArray(rawSecDelta) ? rawSecDelta : Array.isArray(rawSecDelta?.event_data) ? rawSecDelta.event_data : [];
            applyDelta(secDeltaItems, cal.id);
            pageToken = secData?.nextPageToken;
            lastSecData = secData;
            if (mountedRef.current) setFullSyncProgress({ fetched: totalDelta, pages: 0 });
            if (pageToken) await new Promise(r => setTimeout(r, 300));
          } while (pageToken);
          if (lastSecData?.nextSyncToken) updatedTokens[cal.id] = lastSecData.nextSyncToken;
        }
      }

      if (mountedRef.current) {
        savePersistedSync({
          events: currentEvents.map(slimEvent),
          syncedAt: persistedSync.syncedAt,
          syncTokens: updatedTokens,
          incrementalSyncedAt: Date.now(),
        });

        setFullSyncStatus("done");
        setFullSyncProgress({ fetched: totalDelta, pages: 0 });
        if (totalDelta > 0) {
          toast({ title: "Sync incremental concluído", description: `${totalDelta} alteração(ões) aplicada(s).` });
        }
      }
    } catch (err: any) {
      if (mountedRef.current) {
        if (isNotConnectedError(err?.message)) {
          savePersistedSync({ events: [], syncedAt: null, syncTokens: {}, incrementalSyncedAt: null });
          setFullSyncProgress(null);
          setFullSyncStatus("idle");
          return;
        }

        setFullSyncStatus("error");
        toast({ title: "Erro no sync incremental", description: err.message, variant: "destructive" });
      }
    }
  }, [googleConnected, syncTokens, fullSyncEvents, secondaryCalendars, invoke, mapGoogleEvent, savePersistedSync, persistedSync.syncedAt, runFullSync, composioWorkspaceId, defaultWorkspaceId]);

  // Auto-sync
  const FULL_SYNC_TTL_MS = 24 * 60 * 60 * 1000;
  const INCREMENTAL_SYNC_INTERVAL_MS = 15 * 60 * 1000;
  useEffect(() => {
    if (!connectionVerified || !googleConnected || persistedSyncLoading || fullSyncStatus === "running") return;
    const cacheEmpty = fullSyncEvents.length === 0;
    const fullExpired = !fullSyncLastSyncedAt || (Date.now() - fullSyncLastSyncedAt > FULL_SYNC_TTL_MS);
    const hasTokens = Object.keys(syncTokens).length > 0;
    const incrementalExpired = !incrementalSyncedAt || (Date.now() - incrementalSyncedAt > INCREMENTAL_SYNC_INTERVAL_MS);

    if (cacheEmpty && !hasTokens) {
      runFullSync();
    } else if (hasTokens && (incrementalExpired || cacheEmpty)) {
      runIncrementalSync();
    } else if (fullExpired && !hasTokens) {
      runFullSync();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionVerified, googleConnected, persistedSyncLoading]);

  const syncTooltipText = useMemo(() => {
    const parts: string[] = [];
    if (fullSyncEvents.length > 0) parts.push(`${fullSyncEvents.length} eventos sincronizados`);
    if (fullSyncLastSyncedAt) parts.push(`Full: ${format(new Date(fullSyncLastSyncedAt), "dd/MM HH:mm")}`);
    if (incrementalSyncedAt) parts.push(`Δ: ${format(new Date(incrementalSyncedAt), "HH:mm")}`);
    return parts.length > 0 ? parts.join(" · ") : "Sincronizar eventos";
  }, [fullSyncEvents.length, fullSyncLastSyncedAt, incrementalSyncedAt]);

  // Optimistic update helpers
  const optimisticAdd = useCallback((event: any) => {
    if (fullSyncEvents.length > 0) {
      savePersistedSync({ ...persistedSync, events: [...fullSyncEvents, event] });
    }
  }, [fullSyncEvents, savePersistedSync, persistedSync]);

  const optimisticRemove = useCallback((googleId: string) => {
    if (fullSyncEvents.length > 0) {
      savePersistedSync({ ...persistedSync, events: fullSyncEvents.filter(fe => fe.googleId !== googleId) });
    }
  }, [fullSyncEvents, savePersistedSync, persistedSync]);

  const optimisticUpdate = useCallback((googleId: string, patch: Partial<any>) => {
    if (fullSyncEvents.length > 0) {
      const updated = fullSyncEvents.map(fe => fe.googleId === googleId ? { ...fe, ...patch } : fe);
      savePersistedSync({ ...persistedSync, events: updated });
    }
  }, [fullSyncEvents, savePersistedSync, persistedSync]);

  return {
    fullSyncEvents,
    fullSyncLastSyncedAt,
    syncTokens,
    incrementalSyncedAt,
    fullSyncStatus,
    setFullSyncStatus,
    fullSyncProgress,
    lastSyncType,
    persistedSyncLoading,
    persistedSync,
    savePersistedSync,
    clearSyncCache,
    runFullSync,
    runIncrementalSync,
    syncTooltipText,
    optimisticAdd,
    optimisticRemove,
    optimisticUpdate,
  };
}
