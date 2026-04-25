/**
 * useWhatsAppSendLogs — paginated history with filters and realtime updates.
 *
 * Subscribes to `whatsapp_send_logs` realtime channel and refetches on changes
 * so delivery_status updates from the webhook appear live in the UI.
 *
 * Filters:
 * - `status`     → exact delivery_status
 * - `phone`      → digits-only flexible match against `to_phone`
 *                  (ignores spaces, dashes, parentheses, leading "+")
 * - `content`    → ILIKE on `message_preview` OR `template_name`
 * - `since`      → created_at lower bound
 *
 * Backwards compat: `search` is still accepted and applied to BOTH phone and
 * content, mirroring the previous behaviour.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed";

export interface WhatsAppSendLog {
  id: string;
  created_at: string;
  account_id: string;
  to_phone: string;
  message_type: "text" | "template";
  template_name: string | null;
  message_preview: string | null;
  status: "success" | "failed";
  delivery_status: DeliveryStatus | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  zernio_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
  contact_id: string | null;
}

export interface SendLogsFilter {
  status?: DeliveryStatus | "all";
  /** Legacy: applied to BOTH phone (digits) and content (ILIKE). */
  search?: string;
  /** Phone fragment — digits-only normalization is applied automatically. */
  phone?: string;
  /** Content fragment — ILIKE on message_preview / template_name. */
  content?: string;
  /** ISO date — show logs from this day forward */
  since?: string;
  limit?: number;
}

/** Strip everything except digits (drops "+", "-", spaces, parentheses). */
function onlyDigits(s: string): string {
  return s.replace(/\D+/g, "");
}

/** Escape PostgREST .or() special chars: `,` and `()`. ILIKE % stays literal. */
function escapeOr(s: string): string {
  return s.replace(/[(),]/g, "\\$&");
}

export function useWhatsAppSendLogs(filter: SendLogsFilter = {}) {
  const { activeWorkspaceId } = useWorkspace();
  const qc = useQueryClient();
  const {
    status = "all",
    search = "",
    phone = "",
    content = "",
    since,
    limit = 200,
  } = filter;

  const trimmedSearch = search.trim();
  const trimmedPhone = phone.trim();
  const trimmedContent = content.trim();

  const query = useQuery({
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
    queryFn: async (): Promise<WhatsAppSendLog[]> => {
      let q = supabase
        .from("whatsapp_send_logs")
        .select(
          "id, created_at, account_id, to_phone, message_type, template_name, message_preview, status, delivery_status, delivered_at, read_at, failed_at, zernio_message_id, error_code, error_message, latency_ms, contact_id",
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (activeWorkspaceId) q = q.eq("workspace_id", activeWorkspaceId);
      if (status && status !== "all") q = q.eq("delivery_status", status);
      if (since) q = q.gte("created_at", since);

      // ── Phone filter ────────────────────────────────────────
      // Stored E.164 (+5511…) and the user typing "(11) 99999-9999" or
      // "+55 11 9..." should both match. We try both shapes:
      //   1. digits-only fragment (covers the common stored format)
      //   2. raw fragment (covers literal punctuation if present)
      const phoneInput = trimmedPhone || (trimmedSearch ? trimmedSearch : "");
      const phoneDigits = onlyDigits(phoneInput);
      const phoneOrParts: string[] = [];
      if (phoneDigits.length >= 3) {
        phoneOrParts.push(`to_phone.ilike.%${escapeOr(phoneDigits)}%`);
      }
      if (phoneInput && phoneInput !== phoneDigits && phoneInput.length >= 3) {
        phoneOrParts.push(`to_phone.ilike.%${escapeOr(phoneInput)}%`);
      }

      // ── Content filter ──────────────────────────────────────
      const contentInput = trimmedContent || trimmedSearch;
      const contentOrParts: string[] = [];
      if (contentInput && contentInput.length >= 1) {
        const c = escapeOr(contentInput);
        contentOrParts.push(`message_preview.ilike.%${c}%`);
        contentOrParts.push(`template_name.ilike.%${c}%`);
      }

      // Apply filters. When both phone+content come from `search`, we want
      // EITHER side to match (legacy behaviour). When the caller uses the
      // explicit `phone`/`content` fields, they are ANDed (separate .or()).
      if (trimmedSearch && !trimmedPhone && !trimmedContent) {
        const all = [...phoneOrParts, ...contentOrParts];
        if (all.length > 0) q = q.or(all.join(","));
      } else {
        if (phoneOrParts.length > 0) q = q.or(phoneOrParts.join(","));
        if (contentOrParts.length > 0) q = q.or(contentOrParts.join(","));
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as WhatsAppSendLog[];
    },
    staleTime: 15_000,
  });

  // Realtime: refetch when any row changes
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp_send_logs_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_send_logs" },
        () => {
          qc.invalidateQueries({ queryKey: ["whatsapp_send_logs"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
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
    const s = l.delivery_status ?? (l.status === "failed" ? "failed" : "sent");
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
