/**
 * @function zernio-webhook
 * @description Receives delivery/read status events from Zernio and updates whatsapp_send_logs.
 * @status active
 * @auth public — verified via shared secret in `?token=` query OR `X-Zernio-Signature` header
 *
 * Expected payload (Zernio webhook):
 * {
 *   event: "message.sent" | "message.delivered" | "message.read" | "message.failed",
 *   data: {
 *     messageId: string,
 *     accountId?: string,
 *     to?: string,
 *     timestamp?: string,        // ISO
 *     error?: { code?: string; message?: string }
 *   }
 * }
 *
 * Configure in Zernio dashboard:
 *   https://<project>.functions.supabase.co/zernio-webhook?token=<ZERNIO_WEBHOOK_TOKEN>
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-zernio-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Map Zernio event names to our `delivery_status` enum values. */
function mapEvent(event: string): {
  status: "sent" | "delivered" | "read" | "failed";
  field: "delivered_at" | "read_at" | "failed_at" | null;
} | null {
  switch (event) {
    case "message.sent":
    case "messages.sent":
      return { status: "sent", field: null };
    case "message.delivered":
    case "messages.delivered":
      return { status: "delivered", field: "delivered_at" };
    case "message.read":
    case "messages.read":
      return { status: "read", field: "read_at" };
    case "message.failed":
    case "messages.failed":
    case "message.error":
      return { status: "failed", field: "failed_at" };
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Auth: shared secret via query token OR signature header ───────────────
  const expectedToken = Deno.env.get("ZERNIO_WEBHOOK_TOKEN") ?? "";
  if (!expectedToken) {
    console.error("[zernio-webhook] ZERNIO_WEBHOOK_TOKEN not configured");
    return json({ error: "Webhook not configured" }, 503);
  }
  const url = new URL(req.url);
  const providedToken =
    url.searchParams.get("token") ?? req.headers.get("x-zernio-signature") ?? "";
  if (providedToken !== expectedToken) {
    console.warn("[zernio-webhook] Unauthorized webhook attempt");
    return json({ error: "Unauthorized" }, 401);
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  let payload: {
    event?: string;
    data?: {
      messageId?: string;
      id?: string;
      accountId?: string;
      to?: string;
      timestamp?: string;
      error?: { code?: string; message?: string };
    };
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const event = payload.event ?? "";
  const data = payload.data ?? {};
  const messageId = data.messageId ?? data.id;
  if (!messageId) {
    return json({ error: "Missing data.messageId" }, 400);
  }

  const mapped = mapEvent(event);
  if (!mapped) {
    // Unknown event type — accept (200) so Zernio doesn't retry, but log it.
    console.log(`[zernio-webhook] Ignored unknown event: ${event}`);
    return json({ ok: true, ignored: true, event });
  }

  // ── Update the matching log row ──────────────────────────────────────────
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const eventTs = data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString();

  // Build patch: never downgrade status (read > delivered > sent > failed handled separately)
  const { data: existing, error: fetchErr } = await admin
    .from("whatsapp_send_logs")
    .select("id, delivery_status, delivered_at, read_at")
    .eq("zernio_message_id", messageId)
    .maybeSingle();

  if (fetchErr) {
    console.error("[zernio-webhook] Lookup error:", fetchErr.message);
    return json({ error: "Lookup failed" }, 500);
  }
  if (!existing) {
    // Message not in our DB (could be from another tenant or older send).
    console.log(`[zernio-webhook] No log found for messageId=${messageId}`);
    return json({ ok: true, found: false });
  }

  // Status precedence — don't go backwards
  const order = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 4 } as const;
  const current = (existing.delivery_status ?? "sent") as keyof typeof order;
  const incoming = mapped.status as keyof typeof order;
  // 'failed' is always recorded; otherwise only advance forward
  const shouldAdvance = mapped.status === "failed" || (order[incoming] ?? 0) >= (order[current] ?? 0);

  const patch: Record<string, unknown> = {
    webhook_payload: payload,
  };
  if (shouldAdvance) patch.delivery_status = mapped.status;
  if (mapped.field === "delivered_at" && !existing.delivered_at) patch.delivered_at = eventTs;
  if (mapped.field === "read_at" && !existing.read_at) patch.read_at = eventTs;
  if (mapped.field === "failed_at") {
    patch.failed_at = eventTs;
    if (data.error?.message) patch.error_message = String(data.error.message).slice(0, 500);
    if (data.error?.code) patch.error_code = String(data.error.code);
  }

  const { error: updErr } = await admin
    .from("whatsapp_send_logs")
    .update(patch)
    .eq("id", existing.id);

  if (updErr) {
    console.error("[zernio-webhook] Update error:", updErr.message);
    return json({ error: "Update failed" }, 500);
  }

  console.log(`[zernio-webhook] ${event} → ${mapped.status} for ${messageId}`);
  return json({ ok: true, status: mapped.status });
});
