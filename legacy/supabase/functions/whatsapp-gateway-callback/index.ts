/**
 * @function whatsapp-gateway-callback
 * @description Callback do gateway WhatsApp (x-api-key auth)
 * @status active
 * @calledBy WhatsApp gateway service
 * @note Custom CORS headers (x-api-key)
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── 1. Extract & validate API Key ────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("X-Api-Key");
  if (!apiKey || !apiKey.startsWith("desh_")) {
    return jsonResp({ error: "Missing or invalid X-Api-Key header" }, 401);
  }

  // Capture caller IP for logs
  const callerIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";

  // ── 2. Compute SHA-256 hash of the incoming key ──────────────────────────
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // ── 3. Service-role client for lookup + writes ───────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── 4. Resolve user_id from key_hash ─────────────────────────────────────
  const { data: keyRow, error: keyError } = await supabase
    .from("user_gateway_api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyError || !keyRow) {
    return jsonResp({ error: "Invalid API key" }, 401);
  }

  if (keyRow.revoked_at) {
    return jsonResp({ error: "API key has been revoked" }, 401);
  }

  const userId: string = keyRow.user_id;
  const keyId: string = keyRow.id;

  // ── 5. Parse body ─────────────────────────────────────────────────────────
  let body: {
    event: string;
    sessionId: string;
    data?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "Invalid JSON body" }, 400);
  }

  const { event, sessionId, data = {} } = body;

  if (!event || !sessionId) {
    return jsonResp({ error: "event and sessionId are required" }, 400);
  }

  // ── 6. Fire-and-forget: update last_used_at + write gateway key log ───────
  Promise.all([
    supabase
      .from("user_gateway_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyId),
    supabase
      .from("gateway_api_key_logs")
      .insert({
        key_id: keyId,
        user_id: userId,
        event,
        session_id: sessionId,
        ip_address: callerIp,
      }),
  ]).catch((e) => console.error("Key log insert error:", e));

  // ── Helper: write audit log to whatsapp_session_logs ─────────────────────
  async function writeAuditLog(
    evt: string,
    meta: Record<string, unknown> = {}
  ) {
    await supabase
      .from("whatsapp_session_logs")
      .insert({
        user_id: userId,
        session_id: sessionId,
        event: evt,
        source: "callback",
        meta: { ip: callerIp, ...meta },
      })
      .then(({ error }) => {
        if (error) console.error("Audit log error:", error.message);
      });
  }

  // ── 7. Handle events ──────────────────────────────────────────────────────
  switch (event) {
    // ── QR code received ──────────────────────────────────────────────────
    case "qr_code": {
      const { error } = await supabase
        .from("whatsapp_web_sessions")
        .update({
          status: "QR_PENDING",
          last_qr_code: data.qrBase64 as string,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("user_id", userId);

      if (error) return jsonResp({ error: error.message }, 500);
      await writeAuditLog("qr_received");
      return jsonResp({ ok: true, event });
    }

    // ── Session connected ─────────────────────────────────────────────────
    case "session_connected": {
      const { error } = await supabase
        .from("whatsapp_web_sessions")
        .update({
          status: "CONNECTED",
          last_qr_code: null,
          last_connected_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("user_id", userId);

      if (error) return jsonResp({ error: error.message }, 500);
      await writeAuditLog("connected");
      return jsonResp({ ok: true, event });
    }

    // ── Session disconnected ──────────────────────────────────────────────
    case "session_disconnected": {
      const reason = (data.reason as string) ?? null;
      const { error } = await supabase
        .from("whatsapp_web_sessions")
        .update({
          status: "DISCONNECTED",
          last_error: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId)
        .eq("user_id", userId);

      if (error) return jsonResp({ error: error.message }, 500);
      await writeAuditLog("disconnected", { reason });
      return jsonResp({ ok: true, event });
    }

    // ── Message received ──────────────────────────────────────────────────
    case "message_received": {
      const phoneNumber = (data.from as string)?.replace("@c.us", "") ?? "";

      // Ensure conversation exists
      let conversationId: string;
      const { data: existing } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("user_id", userId)
        .eq("channel", "whatsapp_web")
        .eq("external_contact_id", phoneNumber)
        .maybeSingle();

      if (existing) {
        conversationId = existing.id;
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from("whatsapp_conversations")
          .insert({
            user_id: userId,
            channel: "whatsapp_web",
            external_contact_id: phoneNumber,
            title: phoneNumber,
            last_message_at: new Date().toISOString(),
            unread_count: 0,
            labels: [],
          })
          .select("id")
          .single();

        if (convErr || !newConv) {
          return jsonResp({ error: convErr?.message ?? "Failed to create conversation" }, 500);
        }
        conversationId = newConv.id;
      }

      // Insert message
      const { error: msgErr } = await supabase
        .from("whatsapp_messages")
        .insert({
          conversation_id: conversationId,
          direction: "inbound",
          type: "text",
          content_text: data.body as string,
          content_raw: data,
          sent_at: data.timestamp
            ? new Date((data.timestamp as number) * 1000).toISOString()
            : new Date().toISOString(),
          status: "received",
        });

      if (msgErr) return jsonResp({ error: msgErr.message }, 500);

      // Update conversation
      await supabase
        .from("whatsapp_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);

      await writeAuditLog("message_received", { from: phoneNumber });
      return jsonResp({ ok: true, event, conversationId });
    }

    default:
      // Log unknown events too (for debugging gateway issues)
      await writeAuditLog("unknown_event", { raw_event: event });
      return jsonResp({ error: `Unknown event: ${event}` }, 400);
  }
});
