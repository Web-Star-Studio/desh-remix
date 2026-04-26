import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useWorkspaceFilter } from "@/hooks/workspace/useWorkspaceFilter";
import { toast } from "@/hooks/use-toast";

interface ApiEmailSnooze {
  id: string;
  workspaceId: string;
  userId: string | null;
  gmailId: string;
  subject: string;
  fromName: string;
  snoozeUntil: string;
  originalLabels: string[];
  restored: boolean;
  createdAt: string;
}

// The cron on apps/api restores expired snoozes server-side. The SPA only
// reads the active list to drive the snooze badge in the inbox view. The
// `gmailConnected` arg is kept for surface compatibility but unused — the
// server-side path doesn't need it.
export function useEmailSnooze(_gmailConnected: boolean) {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspaceFilter();
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(new Set());
  const [showSnoozePopover, setShowSnoozePopover] = useState<string | null>(null);

  const loadSnoozes = useCallback(async () => {
    if (!user || !activeWorkspaceId) return;
    try {
      const rows = await apiFetch<ApiEmailSnooze[]>(
        `/workspaces/${activeWorkspaceId}/email-snoozes`,
      );
      setSnoozedIds(new Set(rows.map((r) => r.gmailId)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setSnoozedIds(new Set());
        return;
      }
      console.error("[useEmailSnooze] Load error:", err);
    }
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    loadSnoozes();
  }, [loadSnoozes]);

  // Refresh roughly every 2 min so the badge eventually clears once the
  // server-side cron restores a snooze. No tight polling needed — cron does
  // the heavy lifting; this is just for cache freshness.
  useEffect(() => {
    if (!user || !activeWorkspaceId) return;
    const interval = setInterval(() => loadSnoozes(), 120_000);
    return () => clearInterval(interval);
  }, [user, activeWorkspaceId, loadSnoozes]);

  const snoozeEmail = useCallback(
    async (
      emailId: string,
      snoozeUntil: Date,
      email?: { subject?: string; from?: string; labels?: string[] },
    ) => {
      if (!user || !activeWorkspaceId) return;
      try {
        await apiFetch<ApiEmailSnooze>(
          `/workspaces/${activeWorkspaceId}/email-snoozes`,
          {
            method: "POST",
            body: JSON.stringify({
              gmailId: emailId,
              snoozeUntil: snoozeUntil.toISOString(),
              subject: email?.subject,
              fromName: email?.from,
              originalLabels: email?.labels ?? ["INBOX"],
            }),
          },
        );
        setSnoozedIds((prev) => new Set(prev).add(emailId));
        toast({
          title: "⏰ E-mail adiado",
          description: `Retornará em ${snoozeUntil.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast({ title: "Erro ao adiar", description: message, variant: "destructive" });
      }
    },
    [user, activeWorkspaceId],
  );

  return {
    snoozedIds,
    showSnoozePopover,
    setShowSnoozePopover,
    snoozeEmail,
  };
}
