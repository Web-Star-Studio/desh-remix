/**
 * Gmail Sync — orchestrator hook
 * Composes smaller focused hooks for cache, connections, sync engine, and labels.
 */
import { useGmailConnections } from "@/hooks/gmail/useGmailConnections";
import { useGmailCache } from "@/hooks/gmail/useGmailCache";
import { useGmailSyncEngine } from "@/hooks/gmail/useGmailSyncEngine";
import { useGmailLabels } from "@/hooks/gmail/useGmailLabels";

// Re-export types for backward compat
export type { CachedEmail, GmailSyncProgress, GmailSyncState } from "@/types/email";

export function useGmailSync() {
  const { gmailConnections, accountInfoMap } = useGmailConnections();

  const {
    cachedEmails, isLoadingCache, loadCachedEmails, loadMoreEmails,
    loadEmailsByLabel,
    updateEmailInCache, removeEmailsFromCache, activeFolderRef,
    folderUnreadCounts, loadUnreadCounts,
  } = useGmailCache({
    gmailConnectionCount: gmailConnections.length,
    accountInfoMap,
  });

  const {
    isSyncing, progress, syncState, syncStates,
    syncError, hasMore, syncCompleted,
    startSync, continueSync, stopSync, resetSync,
    incrementalSync, deltaSync, clearSyncError,
    syncFolder, renewWatch, backgroundSyncFolders,
    folderSyncStatuses,
  } = useGmailSyncEngine({
    gmailConnections,
    loadCachedEmails,
    activeFolderRef,
  });

  const {
    sidebarLabels: gmailCachedLabels,
    userLabels: gmailUserLabels,
    loading: labelsLoading,
    createLabel: createGmailLabel,
    renameLabel: renameGmailLabel,
    deleteLabel: deleteGmailLabel,
    refreshLabels: refreshGmailLabels,
  } = useGmailLabels(gmailConnections);

  const hasCache = cachedEmails.length > 0;

  // Per-account sync info for the sync panel
  const accountSyncInfo = syncStates
    .filter(s => s.connectionId)
    .map(s => {
      const acct = accountInfoMap.get(s.connectionId!);
      return {
        email: acct?.email || "Gmail",
        color: acct?.color || "hsl(210, 80%, 55%)",
        lastSyncedAt: s.lastSyncedAt,
        totalSynced: s.totalSynced,
      };
    });

  return {
    cachedEmails,
    isSyncing,
    isLoadingCache,
    progress,
    syncState,
    syncStates,
    syncError,
    hasCache,
    hasMore,
    syncCompleted,
    startSync,
    continueSync,
    stopSync,
    resetSync,
    incrementalSync,
    deltaSync,
    loadCachedEmails,
    loadMoreEmails,
    loadEmailsByLabel,
    removeEmailsFromCache,
    updateEmailInCache,
    accountCount: gmailConnections.length,
    accountInfoMap,
    clearSyncError,
    syncFolder,
    renewWatch,
    folderUnreadCounts,
    loadUnreadCounts,
    // Labels
    gmailCachedLabels,
    gmailUserLabels,
    labelsLoading,
    createGmailLabel,
    renameGmailLabel,
    deleteGmailLabel,
    refreshGmailLabels,
    // Per-account sync info
    accountSyncInfo,
    // Folder sync statuses
    backgroundSyncFolders,
    folderSyncStatuses,
  };
}
