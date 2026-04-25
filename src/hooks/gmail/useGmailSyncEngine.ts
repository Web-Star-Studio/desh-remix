import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { GmailSyncState, GmailSyncProgress } from "@/types/email";

/** Delta sync interval — 2 minutes */
const DELTA_SYNC_INTERVAL = 2 * 60 * 1000;
/** Full incremental sync as fallback — 10 minutes */
const FULL_INCREMENTAL_INTERVAL = 10 * 60 * 1000;
/** Watch renewal check — every 30 minutes */
const WATCH_RENEWAL_INTERVAL = 30 * 60 * 1000;

interface GoogleConnection {
  id: string;
  [key: string]: any;
}

interface UseGmailSyncEngineOptions {
  gmailConnections: GoogleConnection[];
  loadCachedEmails: (folder: string) => Promise<void>;
  activeFolderRef: React.MutableRefObject<string>;
}

interface SyncError {
  message: string;
  timestamp: number;
  retryCount: number;
}

function mapRow(data: any): GmailSyncState {
  return {
    folder: data.folder ?? "inbox",
    nextPageToken: data.next_page_token ?? null,
    totalSynced: data.total_synced ?? 0,
    syncCompleted: data.sync_completed ?? false,
    lastSyncedAt: data.last_synced_at ?? null,
    historyId: data.history_id ?? null,
    watchExpiration: data.watch_expiration ?? null,
    connectionId: data.connection_id ?? undefined,
  };
}

/** Retry a function with exponential backoff, refreshing auth on 401 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1500,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || "";
      const isAuth = msg.includes("Unauthorized") || msg.includes("401") || msg.includes("Not authenticated");
      const isRetryable = isAuth ||
        msg.includes("429") ||
        msg.includes("503") ||
        msg.includes("Network") ||
        msg.includes("fetch");
      if (!isRetryable || attempt === maxRetries) throw err;
      // On auth errors, try refreshing the session before retry
      if (isAuth) {
        try {
          await supabase.auth.refreshSession();
        } catch {
          // If refresh fails, throw immediately
          throw err;
        }
      }
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(`[sync-retry] Attempt ${attempt + 1} failed (${msg}), retrying in ${Math.round(delay)}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export function useGmailSyncEngine({ gmailConnections, loadCachedEmails, activeFolderRef }: UseGmailSyncEngineOptions) {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<GmailSyncProgress>({ synced: 0, totalSynced: 0, done: false });
  const [syncStates, setSyncStates] = useState<GmailSyncState[]>([]);
  const [syncError, setSyncError] = useState<SyncError | null>(null);
  const cancelRef = useRef(false);
  const lastDeltaSyncRef = useRef(0);
  const syncingRef = useRef(false); // Prevents concurrent syncs

  const syncState = syncStates.length > 0 ? syncStates[0] : null;

  const loadSyncStates = useCallback(async (folder?: string) => {
    if (!user || gmailConnections.length === 0) return;
    const f = folder || activeFolderRef.current;
    const validConnectionIds = gmailConnections.map(c => c.id);
    const { data } = await supabase
      .from("gmail_sync_state" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("folder", f);
    if (data) {
      // Filter out sync states for connections that no longer exist
      const filtered = (data as any[]).filter(
        d => !d.connection_id || validConnectionIds.includes(d.connection_id)
      );
      setSyncStates(filtered.map(mapRow));
    } else {
      setSyncStates([]);
    }
  }, [user, gmailConnections, activeFolderRef]);

  const callSyncOnce = useCallback(async (
    folder: string, pageToken: string | null, resetSync: boolean,
    connectionId: string, afterDate?: string | null, mode?: string,
  ) => {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Try refreshing the session before giving up
      const { data: refreshData } = await supabase.auth.refreshSession();
      session = refreshData?.session ?? null;
    }
    if (!session) throw new Error("Not authenticated");
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const res = await fetch(`${supabaseUrl}/functions/v1/gmail-gateway`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action: "sync", folder, pageToken, batchSize: 100, resetSync, afterDate, connectionId, mode: mode || "full" }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Network error" }));
      const msg = err.error || `HTTP ${res.status}`;
      // Stale/removed Google connection — throw a special typed error
      if (msg.includes("No Google connection found") || msg.includes("No token found")) {
        const e = new Error(msg);
        (e as any).staleConnection = true;
        throw e;
      }
      throw new Error(msg);
    }
    return await res.json() as {
      synced: number; nextPageToken: string | null; totalSynced: number;
      done: boolean; historyId?: string | null; historyExpired?: boolean;
      deleted?: number; labelsChanged?: number;
    };
  }, []);

  /** Call gmail-watch to renew push notifications */
  const renewWatch = useCallback(async () => {
    if (!user || gmailConnections.length === 0) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      await fetch(`${supabaseUrl}/functions/v1/gmail-gateway`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "watch" }),
      });
    } catch (err) {
      console.warn("[gmail-watch] Renewal failed:", err);
    }
  }, [user, gmailConnections.length]);

  const incrementalSyncRef = useRef<((folder: string) => Promise<void>) | null>(null);

  // ─── DELTA SYNC ───
  const syncErrorRef = useRef<SyncError | null>(null);
  syncErrorRef.current = syncError;

  const deltaSync = useCallback(async (folder: string = "inbox") => {
    if (!user || syncingRef.current || gmailConnections.length === 0) return;
    
    // Re-read fresh sync states directly from DB to avoid stale closure
    const { data: freshStates } = await supabase
      .from("gmail_sync_state" as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("folder", folder);
    
    const currentStates = (freshStates as any[] || []).map(mapRow);
    const validConnectionIds = gmailConnections.map(c => c.id);
    const filteredStates = currentStates.filter(
      s => !s.connectionId || validConnectionIds.includes(s.connectionId)
    );
    
    // Update local state
    setSyncStates(filteredStates);
    
    // Auto-detect connections missing sync_state and run incremental for them
    const connectionIdsWithState = new Set(filteredStates.map(s => s.connectionId).filter(Boolean));
    const orphanConnections = gmailConnections.filter(c => !connectionIdsWithState.has(c.id));
    if (orphanConnections.length > 0) {
      console.warn(`[deltaSync] Found ${orphanConnections.length} connections without sync_state, triggering incremental sync`);
      return incrementalSyncRef.current?.(folder);
    }
    
    const connectionsWithHistory = filteredStates.filter(s => s.historyId && s.connectionId);
    if (connectionsWithHistory.length === 0) return incrementalSyncRef.current?.(folder);

    cancelRef.current = false;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      let totalSynced = 0;
      let totalDeleted = 0;
      for (const state of connectionsWithHistory) {
        if (cancelRef.current || !state.connectionId) break;
        try {
          const result = await withRetry(() =>
            callSyncOnce(folder, null, false, state.connectionId!, null, "delta")
          );
          if (result.historyExpired) {
            const afterDate = state.lastSyncedAt || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            await withRetry(() =>
              callSyncOnce(folder, null, false, state.connectionId!, afterDate, "full")
            );
          }
          totalSynced += result.synced || 0;
          totalDeleted += result.deleted || 0;
        } catch (err: any) {
          if ((err as any).staleConnection) {
            console.warn(`[deltaSync] Skipping stale connection ${state.connectionId}:`, err.message);
            continue;
          }
          console.error(`[deltaSync] Error for connection ${state.connectionId}:`, err);
          const prevRetry = syncErrorRef.current?.retryCount || 0;
          setSyncError({ message: err.message || "Erro de sincronização", timestamp: Date.now(), retryCount: prevRetry + 1 });
        }
      }
      if (totalSynced > 0 || totalDeleted > 0) {
        await loadCachedEmails(folder);
        setSyncError(null);
      }
      lastDeltaSyncRef.current = Date.now();
    } catch (err: any) {
      console.error("Delta sync error:", err);
      const prevRetry = syncErrorRef.current?.retryCount || 0;
      setSyncError({ message: err.message || "Erro de sincronização", timestamp: Date.now(), retryCount: prevRetry + 1 });
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [user, gmailConnections, callSyncOnce, loadCachedEmails]);

  // ─── FULL SYNC ───
  const startSync = useCallback(async (folder: string = "inbox") => {
    if (!user || syncingRef.current || gmailConnections.length === 0) return;
    cancelRef.current = false;
    syncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    setProgress({ synced: 0, totalSynced: 0, done: false });
    try {
      for (const conn of gmailConnections) {
        if (cancelRef.current) break;
        try {
          let pageToken: string | null = null;
          let isFirstBatch = true;
          while (!cancelRef.current) {
            const result = await withRetry(() =>
              callSyncOnce(folder, pageToken, isFirstBatch, conn.id)
            );
            isFirstBatch = false;
            setProgress(prev => ({ synced: prev.synced + result.synced, totalSynced: prev.totalSynced + result.synced, done: false }));
            if (result.done || !result.nextPageToken) break;
            pageToken = result.nextPageToken;
          }
        } catch (err: any) {
          if ((err as any).staleConnection) {
            console.warn(`[startSync] Skipping stale connection ${conn.id}`);
            continue;
          }
          throw err;
        }
      }
      await loadCachedEmails(folder);
      await loadSyncStates(folder);
      setProgress(prev => ({ ...prev, done: true }));
      // Renew watch after full sync to ensure push notifications are active
      renewWatch();
    } catch (err: any) {
      console.error("Sync error:", err);
      setSyncError({ message: err.message || "Erro de sincronização", timestamp: Date.now(), retryCount: 0 });
      throw err;
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [user, gmailConnections, callSyncOnce, loadCachedEmails, loadSyncStates, renewWatch]);

  // ─── CONTINUE SYNC ───
  const continueSync = useCallback(async (folder: string = "inbox") => {
    if (!user || syncingRef.current) return;
    const pendingStates = syncStates.filter(s => s.nextPageToken && !s.syncCompleted);
    if (pendingStates.length === 0) return;
    cancelRef.current = false;
    syncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    setProgress({ synced: 0, totalSynced: 0, done: false });
    try {
      for (const state of pendingStates) {
        if (cancelRef.current || !state.connectionId) break;
        let pageToken: string | null = state.nextPageToken;
        while (!cancelRef.current) {
          const result = await withRetry(() =>
            callSyncOnce(folder, pageToken, false, state.connectionId!)
          );
          setProgress(prev => ({ synced: prev.synced + result.synced, totalSynced: prev.totalSynced + result.synced, done: false }));
          if (result.done || !result.nextPageToken) break;
          pageToken = result.nextPageToken;
        }
      }
      await loadCachedEmails(folder);
      await loadSyncStates(folder);
      setProgress(prev => ({ ...prev, done: true }));
    } catch (err: any) {
      console.error("Continue sync error:", err);
      setSyncError({ message: err.message || "Erro de sincronização", timestamp: Date.now(), retryCount: 0 });
      throw err;
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [user, syncStates, callSyncOnce, loadCachedEmails, loadSyncStates]);

  // ─── INCREMENTAL SYNC ───
  const incrementalSync = useCallback(async (folder: string = "inbox") => {
    if (!user || syncingRef.current || gmailConnections.length === 0) return;
    cancelRef.current = false;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      for (const conn of gmailConnections) {
        if (cancelRef.current) break;
        try {
          // Read fresh state from DB to avoid stale closure
          const { data: freshState } = await supabase
            .from("gmail_sync_state" as any)
            .select("last_synced_at")
            .eq("user_id", user.id)
            .eq("folder", folder)
            .eq("connection_id", conn.id)
            .maybeSingle();
          const afterDate = (freshState as any)?.last_synced_at
            ? new Date((freshState as any).last_synced_at).toISOString()
            : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          let pageToken: string | null = null;
          while (!cancelRef.current) {
            const result = await withRetry(() =>
              callSyncOnce(folder, pageToken, false, conn.id, afterDate)
            );
            if (result.done || !result.nextPageToken) break;
            pageToken = result.nextPageToken;
          }
        } catch (err: any) {
          if ((err as any).staleConnection) {
            console.warn(`[incrementalSync] Skipping stale connection ${conn.id}`);
            continue;
          }
          throw err;
        }
      }
      await loadCachedEmails(folder);
      await loadSyncStates(folder);
      setSyncError(null);
    } catch (err: any) {
      console.error("Incremental sync error:", err);
      setSyncError({ message: err.message || "Erro de sincronização", timestamp: Date.now(), retryCount: 0 });
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [user, gmailConnections, callSyncOnce, loadCachedEmails, loadSyncStates]);

  incrementalSyncRef.current = incrementalSync;

  const stopSync = useCallback(() => { cancelRef.current = true; setIsSyncing(false); syncingRef.current = false; }, []);

  const resetSync = useCallback(async () => {
    if (!user) return;
    setSyncStates([]);
    setSyncError(null);
    setProgress({ synced: 0, totalSynced: 0, done: false });
  }, [user]);

  const clearSyncError = useCallback(() => setSyncError(null), []);

  // Keep stable refs for polling to avoid interval recreation
  const deltaSyncRef = useRef(deltaSync);
  deltaSyncRef.current = deltaSync;
  const renewWatchRef = useRef(renewWatch);
  renewWatchRef.current = renewWatch;

  // ─── AUTO POLLING ───
  useEffect(() => {
    if (!user || gmailConnections.length === 0) return;

    const deltaTimer = setInterval(() => {
      deltaSyncRef.current(activeFolderRef.current);
    }, DELTA_SYNC_INTERVAL);

    const fullTimer = setInterval(() => {
      if (Date.now() - lastDeltaSyncRef.current > FULL_INCREMENTAL_INTERVAL) {
        incrementalSyncRef.current?.(activeFolderRef.current);
      }
    }, FULL_INCREMENTAL_INTERVAL);

    // Auto-renew gmail watch
    const watchTimer = setInterval(() => {
      renewWatchRef.current();
    }, WATCH_RENEWAL_INTERVAL);

    return () => { clearInterval(deltaTimer); clearInterval(fullTimer); clearInterval(watchTimer); };
  }, [user, gmailConnections.length, activeFolderRef]);

  /** Background sync for secondary folders (sent, drafts, trash, spam) */
  const backgroundSyncFolders = useCallback(async () => {
    if (!user || gmailConnections.length === 0) return;
    const secondaryFolders = ["sent", "drafts", "trash", "spam"];
    for (const folder of secondaryFolders) {
      if (cancelRef.current) break;
      for (const conn of gmailConnections) {
        try {
          // Check if this folder has ever been synced for this connection
          const { data: existingState } = await supabase
            .from("gmail_sync_state" as any)
            .select("sync_completed, total_synced")
            .eq("user_id", user.id)
            .eq("folder", folder)
            .eq("connection_id", conn.id)
            .maybeSingle();
          
          if ((existingState as any)?.sync_completed && (existingState as any)?.total_synced > 0) {
            // Already synced — do a quick delta instead
            await withRetry(() => callSyncOnce(folder, null, false, conn.id, null, "delta")).catch(() => {});
          } else {
            // First sync — do initial full sync (first page only for speed)
            await withRetry(() => callSyncOnce(folder, null, false, conn.id, null, "full")).catch(() => {});
          }
        } catch (err) {
          console.warn(`[backgroundSync] Error syncing ${folder} for ${conn.id}:`, err);
        }
      }
    }
    // Refresh folder sync statuses after background sync
    loadAllFolderSyncStatesRef.current?.().then(s => s && setFolderSyncStatuses(s)).catch(() => {});
  }, [user, gmailConnections, callSyncOnce]);

  // ─── ON MOUNT: stale-while-revalidate ───
  useEffect(() => {
    if (!user || gmailConnections.length === 0) return;
    // Validate connections have IDs before attempting sync
    const validConnections = gmailConnections.filter(c => c.id);
    if (validConnections.length === 0) return;
    loadSyncStates("inbox");
    loadCachedEmails("inbox").then(() => {
      setTimeout(() => deltaSync("inbox"), 1500);
      // After inbox loads, background-sync other folders
      setTimeout(() => backgroundSyncFolders(), 5000);
    });
    // Renew watch on mount
    renewWatch();
  }, [user, gmailConnections.length]); // eslint-disable-line

  // ─── FOLDER CHANGE: trigger delta sync ───
  const syncFolder = useCallback(async (folder: string) => {
    await loadSyncStates(folder);
    // Quick delta sync for the new folder after cache loads
    if (!syncingRef.current) {
      setTimeout(() => deltaSync(folder), 500);
    }
  }, [loadSyncStates, deltaSync]);

  const hasMore = syncStates.some(s => !!s.nextPageToken && !s.syncCompleted);
  const syncCompleted = syncStates.length > 0 && syncStates.every(s => s.syncCompleted);
  const totalSynced = syncStates.reduce((sum, s) => sum + s.totalSynced, 0);

  /** Load sync states for ALL folders (for sidebar status indicators) */
  const loadAllFolderSyncStates = useCallback(async () => {
    if (!user || gmailConnections.length === 0) return {};
    const { data } = await supabase
      .from("gmail_sync_state" as any)
      .select("folder, sync_completed, total_synced, last_synced_at, connection_id")
      .eq("user_id", user.id);
    if (!data) return {};
    const map: Record<string, { synced: boolean; totalSynced: number; lastSyncedAt: string | null }> = {};
    for (const row of data as any[]) {
      const f = row.folder;
      if (!map[f]) map[f] = { synced: false, totalSynced: 0, lastSyncedAt: null };
      map[f].synced = map[f].synced || row.sync_completed;
      map[f].totalSynced += row.total_synced || 0;
      if (row.last_synced_at && (!map[f].lastSyncedAt || row.last_synced_at > map[f].lastSyncedAt)) {
        map[f].lastSyncedAt = row.last_synced_at;
      }
    }
    return map;
  }, [user, gmailConnections]);

  const loadAllFolderSyncStatesRef = useRef(loadAllFolderSyncStates);
  loadAllFolderSyncStatesRef.current = loadAllFolderSyncStates;

  const [folderSyncStatuses, setFolderSyncStatuses] = useState<Record<string, { synced: boolean; totalSynced: number; lastSyncedAt: string | null }>>({});

  // Load folder sync statuses on mount only (not on every syncStates change)
  useEffect(() => {
    if (!user || gmailConnections.length === 0) return;
    loadAllFolderSyncStates().then(setFolderSyncStatuses);
  }, [user, gmailConnections.length, loadAllFolderSyncStates]);

  return {
    isSyncing,
    progress,
    syncState: syncState ? { ...syncState, totalSynced } : null,
    syncStates,
    syncError,
    hasMore,
    syncCompleted,
    startSync,
    continueSync,
    stopSync,
    resetSync,
    incrementalSync,
    deltaSync,
    loadSyncStates,
    clearSyncError,
    syncFolder,
    renewWatch,
    backgroundSyncFolders,
    folderSyncStatuses,
  };
}
