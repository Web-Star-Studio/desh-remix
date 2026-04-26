import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import { toast } from "@/hooks/use-toast";
import type { LabelColor } from "@/components/email/types";

export interface GmailLabelCached {
  id: string;
  gmailLabelId: string;
  connectionId: string;
  name: string;
  labelType: string;
  colorBg: string | null;
  colorText: string | null;
  messagesTotal: number;
  messagesUnread: number;
}

interface ApiGmailLabel {
  id: string;
  workspaceId: string;
  connectionId: string;
  gmailLabelId: string;
  name: string;
  labelType: string;
  colorBg: string | null;
  colorText: string | null;
  messagesTotal: number;
  messagesUnread: number;
  syncedAt: string;
}

function fromApi(l: ApiGmailLabel): GmailLabelCached {
  return {
    id: l.id,
    gmailLabelId: l.gmailLabelId,
    connectionId: l.connectionId,
    name: l.name,
    labelType: l.labelType,
    colorBg: l.colorBg,
    colorText: l.colorText,
    messagesTotal: l.messagesTotal,
    messagesUnread: l.messagesUnread,
  };
}

function mapGmailColor(bgColor: string | null): LabelColor {
  if (!bgColor) return "blue";
  const lower = bgColor.toLowerCase();
  if (lower.includes("#fb4c2f") || lower.includes("#cc3a21") || lower.includes("#ac2b16")) return "red";
  if (lower.includes("#16a765") || lower.includes("#094228") || lower.includes("#2da2bb")) return "green";
  if (lower.includes("#ffad47") || lower.includes("#fad165") || lower.includes("#ebdbde")) return "yellow";
  if (lower.includes("#a46a21") || lower.includes("#f691b3") || lower.includes("#cf8933")) return "orange";
  if (lower.includes("#653e9b") || lower.includes("#b694e8") || lower.includes("#a479e2")) return "purple";
  return "blue";
}

// `gmailConnections` arg kept for API compatibility with existing callers,
// but no longer used — the apps/api route resolves the workspace's Gmail
// connection server-side.
export function useGmailLabels(_gmailConnections: Array<{ id: string }>) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspaceFilter();
  const [labels, setLabels] = useState<GmailLabelCached[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLabels = useCallback(async () => {
    if (!user || !activeWorkspaceId) return;
    try {
      const rows = await apiFetch<ApiGmailLabel[]>(
        `/workspaces/${activeWorkspaceId}/gmail-labels`,
      );
      setLabels(rows.map(fromApi));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setLabels([]);
        return;
      }
      console.error("[useGmailLabels] Load error:", err);
    }
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    if (user && activeWorkspaceId) loadLabels();
  }, [user, activeWorkspaceId, loadLabels]);

  const userLabels = useMemo(
    () => labels.filter((l) => l.labelType === "user"),
    [labels],
  );
  const systemLabels = useMemo(
    () => labels.filter((l) => l.labelType !== "user"),
    [labels],
  );

  // Deduplicate by name across multi-account setups, summing counts.
  const sidebarLabels = useMemo(() => {
    const byName = new Map<
      string,
      {
        gmailId: string;
        name: string;
        colorBg: string | null;
        total: number;
        unread: number;
        connectionId: string;
      }
    >();
    for (const l of userLabels) {
      const existing = byName.get(l.name);
      if (existing) {
        existing.total += l.messagesTotal;
        existing.unread += l.messagesUnread;
      } else {
        byName.set(l.name, {
          gmailId: l.gmailLabelId,
          name: l.name,
          colorBg: l.colorBg,
          total: l.messagesTotal,
          unread: l.messagesUnread,
          connectionId: l.connectionId,
        });
      }
    }
    return Array.from(byName.values()).map((l) => ({
      id: `gmail:${l.gmailId}`,
      gmailId: l.gmailId,
      name: l.name,
      color: mapGmailColor(l.colorBg),
      messageCount: l.total,
      unreadCount: l.unread,
      connectionId: l.connectionId,
    }));
  }, [userLabels]);

  const createLabel = useCallback(
    async (name: string) => {
      if (!activeWorkspaceId) return null;
      setLoading(true);
      try {
        const created = await apiFetch<ApiGmailLabel>(
          `/workspaces/${activeWorkspaceId}/gmail-labels`,
          { method: "POST", body: JSON.stringify({ name }) },
        );
        await loadLabels();
        toast({ title: `Etiqueta "${name}" criada no Gmail` });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast({ title: "Erro ao criar etiqueta", description: message, variant: "destructive" });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [activeWorkspaceId, loadLabels],
  );

  // Composio's catalog doesn't expose a rename action — there's no Gmail-side
  // change happening here. To preserve the previous local-only rename UX we
  // simply refresh after relabeling fails; in practice users use create/delete.
  // Kept as a no-op shim so callers don't break; remove once UI drops it.
  const renameLabel = useCallback(
    async (_gmailLabelId: string, newName: string) => {
      toast({
        title: "Renomeação não suportada",
        description: `Use criar e remover para mudar o nome para "${newName}".`,
        variant: "destructive",
      });
    },
    [],
  );

  const deleteLabel = useCallback(
    async (_gmailLabelId: string, dbLabelIdParam?: string) => {
      if (!activeWorkspaceId) return;
      // Callers pass the Gmail label ID; we stored the row id in `id`.
      // Resolve via the loaded list to find the row UUID.
      const row = labels.find(
        (l) => l.gmailLabelId === _gmailLabelId || l.id === dbLabelIdParam,
      );
      if (!row) {
        toast({ title: "Etiqueta não encontrada", variant: "destructive" });
        return;
      }
      setLoading(true);
      try {
        await apiFetch<void>(
          `/workspaces/${activeWorkspaceId}/gmail-labels/${row.id}`,
          { method: "DELETE" },
        );
        await loadLabels();
        toast({ title: "Etiqueta removida do Gmail" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast({ title: "Erro ao remover etiqueta", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [activeWorkspaceId, labels, loadLabels],
  );

  // Refresh — pulls labels from Composio and upserts the cache server-side.
  const refreshLabels = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const rows = await apiFetch<ApiGmailLabel[]>(
        `/workspaces/${activeWorkspaceId}/gmail-labels/refresh`,
        { method: "POST" },
      );
      setLabels(rows.map(fromApi));
    } catch (err) {
      console.error("[useGmailLabels] Refresh error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  return {
    labels,
    userLabels,
    systemLabels,
    sidebarLabels,
    loading,
    loadLabels,
    createLabel,
    renameLabel,
    deleteLabel,
    refreshLabels,
  };
}
