import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-client";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import type { GmailSyncState, GmailSyncProgress } from "@/types/email";

// Sync orchestration is now server-side: pg-boss runs the watch-renewal cron,
// the gmail-webhook enqueues incremental-sync jobs on every Pub/Sub push, and
// the SPA only needs a "Sync now" trigger. The legacy engine — full-sync
// pagination, delta-sync polling, watch renewal, retry-with-backoff — has
// been removed because all of it lives in apps/api now.
//
// We keep the hook surface (startSync, deltaSync, etc.) so existing callers
// continue to work; most are no-ops or thin apiFetch wrappers.

interface SyncError {
  message: string;
  timestamp: number;
  retryCount: number;
}

interface UseGmailSyncEngineOptions {
  gmailConnections: Array<{ id: string }>;
  loadCachedEmails: (folder: string) => Promise<void>;
  activeFolderRef: React.MutableRefObject<string>;
}

const DEFAULT_PROGRESS: GmailSyncProgress = { synced: 0, totalSynced: 0, done: false };

export function useGmailSyncEngine({
  gmailConnections,
  loadCachedEmails,
  activeFolderRef,
}: UseGmailSyncEngineOptions) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspaceFilter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<GmailSyncProgress>(DEFAULT_PROGRESS);
  const [syncError, setSyncError] = useState<SyncError | null>(null);

  const syncingRef = useRef(false);

  const triggerServerSync = useCallback(async () => {
    if (!user || !activeWorkspaceId || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    setProgress(DEFAULT_PROGRESS);
    try {
      await apiFetch<{ enqueued: number; connections: number }>(
        `/workspaces/${activeWorkspaceId}/emails/sync`,
        { method: "POST" },
      );
      // Server-side processing is async (pg-boss); refresh local cache to
      // catch any rows that have already landed. The 60s polling in
      // useGmailCache picks up later updates.
      await loadCachedEmails(activeFolderRef.current);
      setProgress({ synced: 0, totalSynced: 0, done: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncError({ message, timestamp: Date.now(), retryCount: 0 });
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [user, activeWorkspaceId, loadCachedEmails, activeFolderRef]);

  // Surface compatibility — legacy callers branch on these names but the
  // server-side path is uniform.
  const startSync = triggerServerSync;
  const continueSync = triggerServerSync;
  const incrementalSync = useCallback(
    async (_folder?: string) => {
      await triggerServerSync();
    },
    [triggerServerSync],
  );
  const deltaSync = useCallback(
    async (_folder?: string) => {
      // Delta sync was the polling-based fast path. Now redundant: webhook
      // already syncs on activity, and 60s cache polling refreshes the SPA.
      // No-op preserves the surface.
    },
    [],
  );

  const stopSync = useCallback(() => {
    setIsSyncing(false);
    syncingRef.current = false;
  }, []);

  const resetSync = useCallback(async () => {
    setSyncError(null);
    setProgress(DEFAULT_PROGRESS);
  }, []);

  const clearSyncError = useCallback(() => setSyncError(null), []);

  // Watch renewal is server-cron now; SPA-side renewal is dead.
  const renewWatch = useCallback(async () => {
    /* server cron handles watch renewal */
  }, []);

  const backgroundSyncFolders = useCallback(async () => {
    /* server-side webhook covers all folders */
  }, []);

  const syncFolder = useCallback(
    async (_folder: string) => {
      /* server-side covers it; loadCachedEmails on folder change is enough */
    },
    [],
  );

  // First-mount sync — kick the server once on mount so the SPA gets a fresh
  // cache without waiting for the next inbound webhook.
  useEffect(() => {
    if (!user || !activeWorkspaceId || gmailConnections.length === 0) return;
    void triggerServerSync();
  }, [user, activeWorkspaceId, gmailConnections.length, triggerServerSync]);

  // Empty placeholders — preserved for surface compatibility.
  const syncStates: GmailSyncState[] = [];
  const folderSyncStatuses: Record<
    string,
    { synced: boolean; totalSynced: number; lastSyncedAt: string | null }
  > = {};

  return {
    isSyncing,
    progress,
    syncState: null as GmailSyncState | null,
    syncStates,
    syncError,
    hasMore: false,
    syncCompleted: true,
    startSync,
    continueSync,
    stopSync,
    resetSync,
    incrementalSync,
    deltaSync,
    loadSyncStates: async (_folder?: string) => {
      /* no-op */
    },
    clearSyncError,
    syncFolder,
    renewWatch,
    backgroundSyncFolders,
    folderSyncStatuses,
  };
}
