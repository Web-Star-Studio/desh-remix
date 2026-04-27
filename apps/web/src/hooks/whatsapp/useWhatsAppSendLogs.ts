/**
 * useWhatsAppSendLogs — paginated history with filters.
 *
 * Backed by apps/api `GET /workspaces/:id/zernio/whatsapp/send-logs` (server
 * applies `status`/`phone`/`content`/`since`/`limit` filters). Realtime
 * (Supabase postgres_changes) was removed when the table moved off Supabase;
 * we poll every 30s instead and invalidate on send via the mutation hook.
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export interface WhatsAppSendLog {
  id: string;
  createdAt: string;
  accountId: string;
  toPhone: string;
  messageType: "text" | "template";
  templateName: string | null;
  messagePreview: string | null;
  status: "success" | "failed";
  deliveryStatus: DeliveryStatus | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedAt: string | null;
  zernioMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  contactId: string | null;
}

export interface SendLogsFilter {
  status?: DeliveryStatus | "all";
  /** Legacy: applied to BOTH phone and content. Server splits internally if both `phone` and `content` are also supplied. */
  search?: string;
  phone?: string;
  content?: string;
  /** ISO timestamp lower bound. */
  since?: string;
  limit?: number;
}

interface SendLogsResponse {
  logs: WhatsAppSendLog[];
}

function buildQuery(filter: SendLogsFilter): string {
  const params = new URLSearchParams();
  const status = filter.status;
  if (status && status !== "all") params.set("status", status);
  const phone = (filter.phone ?? filter.search ?? "").trim();
  if (phone) params.set("phone", phone);
  const content = (filter.content ?? filter.search ?? "").trim();
  if (content && content !== phone) params.set("content", content);
  if (filter.since) params.set("since", filter.since);
  if (filter.limit) params.set("limit", String(filter.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useWhatsAppSendLogs(filter: SendLogsFilter = {}) {
  const { activeWorkspaceId } = useWorkspace();
  const { status = "all", search = "", phone = "", content = "", since, limit = 200 } = filter;

  const trimmedSearch = search.trim();
  const trimmedPhone = phone.trim();
  const trimmedContent = content.trim();

  return useQuery({
    queryKey: [
      "whatsapp_send_logs",
      activeWorkspaceId,
      status,
      trimmedSearch,
      trimmedPhone,
      trimmedContent,
      since,
      limit,
    ],
    enabled: Boolean(activeWorkspaceId),
    queryFn: async (): Promise<WhatsAppSendLog[]> => {
      if (!activeWorkspaceId) return [];
      const qs = buildQuery({
        status: filter.status,
        search: filter.search,
        phone: filter.phone,
        content: filter.content,
        since: filter.since,
        limit,
      });
      const res = await apiFetch<SendLogsResponse>(
        `/workspaces/${activeWorkspaceId}/zernio/whatsapp/send-logs${qs}`,
      );
      return res.logs ?? [];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export interface SendLogsStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  readRate: number;
  deliveryRate: number;
}

export function computeStats(logs: WhatsAppSendLog[]): SendLogsStats {
  const total = logs.length;
  let sent = 0,
    delivered = 0,
    read = 0,
    failed = 0;
  for (const l of logs) {
    const s = l.deliveryStatus ?? (l.status === "failed" ? "failed" : "sent");
    if (s === "sent") sent++;
    else if (s === "delivered") delivered++;
    else if (s === "read") read++;
    else if (s === "failed") failed++;
  }
  const successful = total - failed;
  return {
    total,
    sent,
    delivered,
    read,
    failed,
    readRate: successful > 0 ? Math.round((read / successful) * 100) : 0,
    deliveryRate: successful > 0 ? Math.round(((delivered + read) / successful) * 100) : 0,
  };
}
