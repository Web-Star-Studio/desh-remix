import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import { streamEmailEvents } from "@/lib/email-stream";
import type { CachedEmail } from "@/types/email";

interface UseGmailCacheOptions {
  gmailConnectionCount: number;
  accountInfoMap: Map<string, { email: string; color: string }>;
}

interface ApiEmail {
  id: string;
  workspaceId: string;
  connectionId: string;
  gmailId: string;
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  bodyPreview: string;
  date: string;
  isUnread: boolean;
  isStarred: boolean;
  hasAttachment: boolean;
  labelIds: string[];
  folder: string;
  headers: Record<string, unknown>;
  metadata: Record<string, unknown>;
  composioSyncedAt: string | null;
  createdAt: string;
}

interface ListResponse {
  items: ApiEmail[];
  nextCursor: string | null;
}

const SYSTEM_LABELS = new Set([
  "INBOX",
  "SENT",
  "DRAFT",
  "TRASH",
  "SPAM",
  "UNREAD",
  "CHAT",
  "STARRED",
]);

const PAGE_SIZE = 200;

export function useGmailCache({ gmailConnectionCount, accountInfoMap }: UseGmailCacheOptions) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspaceFilter();
  const [cachedEmails, setCachedEmails] = useState<CachedEmail[]>([]);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [folderUnreadCounts, setFolderUnreadCounts] = useState<Record<string, number>>({});
  const activeFolderRef = useRef("inbox");
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);

  const mapApi = useCallback(
    (row: ApiEmail): CachedEmail => {
      const acct = accountInfoMap.get(row.connectionId);
      const date = row.date ? new Date(row.date) : null;
      return {
        id: row.gmailId,
        gmail_id: row.gmailId,
        from: row.fromName || "Desconhecido",
        email: row.fromEmail || "",
        subject: row.subject || "Sem assunto",
        body: row.snippet || "",
        date:
          date && !isNaN(date.getTime())
            ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
            : "",
        unread: row.isUnread,
        starred: row.isStarred,
        hasAttachment: row.hasAttachment,
        folder: row.folder,
        labels: (row.labelIds ?? [])
          .filter((lid) => !SYSTEM_LABELS.has(lid))
          .map((lid) => `gmail:${lid}`),
        accountEmail: acct?.email,
        accountColor: gmailConnectionCount > 1 ? acct?.color : undefined,
        connectionId: row.connectionId || undefined,
        workspaceId: row.workspaceId,
        threadId: row.threadId ?? undefined,
      };
    },
    [gmailConnectionCount, accountInfoMap],
  );

  const loadUnreadCounts = useCallback(async () => {
    if (!user || !activeWorkspaceId) return;
    const folders = ["inbox", "sent", "drafts", "trash", "spam"];
    const results: Record<string, number> = {};
    await Promise.all(
      folders.map(async (f) => {
        try {
          // We don't have a dedicated count endpoint yet — approximate by
          // listing one page and summing isUnread. For inbox this is good
          // enough; the apps/api side can ship a /emails/counts route in
          // wave 4b if the SPA needs precise totals.
          const res = await apiFetch<ListResponse>(
            `/workspaces/${activeWorkspaceId}/emails?folder=${f}&limit=200`,
          );
          results[f] = res.items.filter((e) => e.isUnread).length;
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            results[f] = 0;
          }
        }
      }),
    );
    setFolderUnreadCounts(results);
  }, [user, activeWorkspaceId]);

  const loadCachedEmails = useCallback(
    async (folder = "inbox") => {
      if (!user || !activeWorkspaceId) return;
      activeFolderRef.current = folder;
      cursorRef.current = null;
      hasMoreRef.current = true;
      setIsLoadingCache(true);
      try {
        const res = await apiFetch<ListResponse>(
          `/workspaces/${activeWorkspaceId}/emails?folder=${folder}&limit=${PAGE_SIZE}`,
        );
        setCachedEmails(res.items.map(mapApi));
        cursorRef.current = res.nextCursor;
        hasMoreRef.current = !!res.nextCursor;
        loadUnreadCounts();
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          console.error("Error loading cached emails:", err);
        }
        setCachedEmails([]);
      } finally {
        setIsLoadingCache(false);
      }
    },
    [user, activeWorkspaceId, mapApi, loadUnreadCounts],
  );

  const loadEmailsByLabel = useCallback(
    async (gmailLabelId: string) => {
      if (!user || !activeWorkspaceId) return;
      setIsLoadingCache(true);
      try {
        const res = await apiFetch<ListResponse>(
          `/workspaces/${activeWorkspaceId}/emails?label=${encodeURIComponent(gmailLabelId)}&limit=${PAGE_SIZE}`,
        );
        setCachedEmails(res.items.map(mapApi));
      } catch (err) {
        console.error("Error loading emails by label:", err);
        setCachedEmails([]);
      } finally {
        setIsLoadingCache(false);
      }
    },
    [user, activeWorkspaceId, mapApi],
  );

  const loadMoreEmails = useCallback(
    async (folder?: string) => {
      if (!user || !activeWorkspaceId || !hasMoreRef.current || !cursorRef.current) return;
      const f = folder || activeFolderRef.current;
      try {
        const res = await apiFetch<ListResponse>(
          `/workspaces/${activeWorkspaceId}/emails?folder=${f}&limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursorRef.current)}`,
        );
        if (res.items.length > 0) {
          setCachedEmails((prev) => {
            const existing = new Set(prev.map((e) => e.gmail_id));
            const fresh = res.items.filter((e) => !existing.has(e.gmailId)).map(mapApi);
            return [...prev, ...fresh];
          });
        }
        cursorRef.current = res.nextCursor;
        hasMoreRef.current = !!res.nextCursor;
      } catch (err) {
        console.error("Error loading more emails:", err);
      }
    },
    [user, activeWorkspaceId, mapApi],
  );

  const updateEmailInCache = useCallback(
    async (
      gmailId: string,
      updates: Partial<{
        is_unread: boolean;
        is_starred: boolean;
        label_ids: string[];
        folder: string;
      }>,
    ) => {
      if (!user || !activeWorkspaceId) return;
      const shouldRemoveFromView =
        updates.folder && updates.folder !== activeFolderRef.current;

      // Optimistic local update.
      setCachedEmails((prev) => {
        if (shouldRemoveFromView) return prev.filter((e) => e.gmail_id !== gmailId);
        return prev.map((e) => {
          if (e.gmail_id !== gmailId) return e;
          return {
            ...e,
            unread: updates.is_unread !== undefined ? updates.is_unread : e.unread,
            starred: updates.is_starred !== undefined ? updates.is_starred : e.starred,
            folder: updates.folder || e.folder,
            labels: updates.label_ids
              ? updates.label_ids
                  .filter((lid) => !SYSTEM_LABELS.has(lid))
                  .map((lid) => `gmail:${lid}`)
              : e.labels,
          };
        });
      });

      // Resolve the row UUID for the apps/api PATCH. We list the page; the
      // gmailId-to-id map is small enough to scan in memory.
      try {
        const list = await apiFetch<ListResponse>(
          `/workspaces/${activeWorkspaceId}/emails?folder=${activeFolderRef.current}&limit=${PAGE_SIZE}`,
        );
        const match = list.items.find((e) => e.gmailId === gmailId);
        if (!match) return;
        const body: Record<string, unknown> = {};
        if (updates.is_unread !== undefined) body.isRead = !updates.is_unread;
        if (updates.is_starred !== undefined) body.isStarred = updates.is_starred;
        if (updates.label_ids !== undefined) body.labelIds = updates.label_ids;
        if (updates.folder !== undefined) body.folder = updates.folder;
        await apiFetch<unknown>(
          `/workspaces/${activeWorkspaceId}/emails/${match.id}`,
          { method: "PATCH", body: JSON.stringify(body) },
        );
      } catch (err) {
        console.error("Cache update error:", err);
      }
    },
    [user, activeWorkspaceId],
  );

  const removeEmailsFromCache = useCallback(
    async (gmailIds: string[]) => {
      if (!user || !activeWorkspaceId || gmailIds.length === 0) return;
      setCachedEmails((prev) => prev.filter((e) => !gmailIds.includes(e.gmail_id)));
      // Resolve and trash each. Best-effort — if the row was already gone
      // server-side, the 404 is harmless.
      try {
        const list = await apiFetch<ListResponse>(
          `/workspaces/${activeWorkspaceId}/emails?folder=${activeFolderRef.current}&limit=${PAGE_SIZE}`,
        );
        const targets = list.items.filter((e) => gmailIds.includes(e.gmailId));
        await Promise.all(
          targets.map((t) =>
            apiFetch<unknown>(
              `/workspaces/${activeWorkspaceId}/emails/${t.id}/trash`,
              { method: "POST" },
            ).catch(() => undefined),
          ),
        );
      } catch (err) {
        console.error("Cache cleanup error:", err);
      }
    },
    [user, activeWorkspaceId],
  );

  // SSE subscription for new mail. The server webhook drives upsertEmails,
  // which publishes a workspace-scoped event; the SPA reloads the active
  // folder on receipt. Reconnect with exponential backoff up to 30s on
  // disconnect. (Polling fallback would be redundant; the next reconnect
  // catches up via loadCachedEmails.)
  useEffect(() => {
    if (!user || !activeWorkspaceId) return;
    const controller = new AbortController();
    let cancelled = false;
    let backoff = 1_000;

    const run = async () => {
      while (!cancelled) {
        await streamEmailEvents(activeWorkspaceId, {
          signal: controller.signal,
          onOpen: () => {
            backoff = 1_000;
          },
          onEvent: (event) => {
            // Skip the initial ready-event whose gmailIds is empty.
            if (event.gmailIds.length === 0) return;
            void loadCachedEmails(activeFolderRef.current);
          },
          onError: () => {
            /* fall through to backoff */
          },
        });
        if (cancelled) break;
        await new Promise((r) => setTimeout(r, backoff));
        backoff = Math.min(backoff * 2, 30_000);
      }
    };
    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user, activeWorkspaceId, loadCachedEmails]);

  return {
    cachedEmails,
    isLoadingCache,
    loadCachedEmails,
    loadMoreEmails,
    loadEmailsByLabel,
    updateEmailInCache,
    removeEmailsFromCache,
    activeFolderRef,
    folderUnreadCounts,
    loadUnreadCounts,
  };
}
