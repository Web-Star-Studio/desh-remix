/**
 * @function whatsapp-proxy
 * @description Proxy seguro entre frontend e Meta Graph API
 * @status active
 * @calledBy WhatsApp module
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";

const META_BASE = "https://graph.facebook.com/v20.0";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── 1. Verify user JWT ─────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Missing authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) {
    return json({ error: "Invalid or expired token" }, 401);
  }

  // ── 2. Parse request body ──────────────────────────────────────────────────
  let body: { connectionId?: string; action?: string; payload?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { connectionId, action, payload = {} } = body;
  if (!connectionId || !action) {
    return json({ error: "connectionId and action are required" }, 400);
  }

  // ── 3. Load connection (ownership check) ───────────────────────────────────
  const adminClient = createClient(supabaseUrl, supabaseServiceRole);
  const { data: conn, error: connError } = await adminClient
    .from("whatsapp_connections")
    .select("id, phone_number_id, meta_access_token, status")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .single();

  if (connError || !conn) {
    return json({ error: "Connection not found or access denied" }, 404);
  }

  const { phone_number_id: phoneNumberId, meta_access_token: accessToken } = conn;

  // ── 4. Forward to Meta ─────────────────────────────────────────────────────
  const metaHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  let metaUrl: string;
  let metaMethod: string;
  let metaBody: unknown;

  switch (action) {
    case "sendMessage": {
      // payload: { to, text }
      const { to, text } = payload as { to: string; text: string };
      if (!to || !text) return json({ error: "payload.to and payload.text are required for sendMessage" }, 400);
      metaUrl = `${META_BASE}/${phoneNumberId}/messages`;
      metaMethod = "POST";
      metaBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      };
      break;
    }

    case "sendTemplate": {
      // payload: { to, template: { name, language, components? } }
      const { to, template } = payload as { to: string; template: unknown };
      if (!to || !template) return json({ error: "payload.to and payload.template are required for sendTemplate" }, 400);
      metaUrl = `${META_BASE}/${phoneNumberId}/messages`;
      metaMethod = "POST";
      metaBody = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template,
      };
      break;
    }

    case "getPhoneInfo": {
      metaUrl = `${META_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,platform_type,throughput`;
      metaMethod = "GET";
      metaBody = undefined;
      break;
    }

    case "markRead": {
      // payload: { messageId }
      const { messageId } = payload as { messageId: string };
      if (!messageId) return json({ error: "payload.messageId is required for markRead" }, 400);
      metaUrl = `${META_BASE}/${phoneNumberId}/messages`;
      metaMethod = "POST";
      metaBody = {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      };
      break;
    }

    case "raw": {
      // payload: { path, method, body, params }
      const { path, method = "GET", body: rawBody, params } = payload as {
        path: string;
        method?: string;
        body?: unknown;
        params?: Record<string, string>;
      };
      if (!path) return json({ error: "payload.path is required for raw action" }, 400);
      const url = new URL(`${META_BASE}/${phoneNumberId}${path}`);
      if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
      metaUrl = url.toString();
      metaMethod = method;
      metaBody = rawBody;
      break;
    }

    default:
      return json({ error: `Unknown action: ${action}` }, 400);
  }

  try {
    const metaRes = await fetch(metaUrl, {
      method: metaMethod,
      headers: metaHeaders,
      body: metaBody !== undefined ? JSON.stringify(metaBody) : undefined,
    });

    const metaData = await metaRes.json() as Record<string, unknown>;

    // ── Persist outbound messages in the DB ────────────────────────────────
    if (metaRes.ok && action === "sendMessage") {
      const { to, text } = payload as { to: string; text: string };
      const wamid = (metaData.messages as Array<{ id: string }>)?.[0]?.id ?? null;
      const sentAt = new Date().toISOString();

      // Upsert conversation for the recipient
      const { data: conv } = await adminClient
        .from("whatsapp_conversations")
        .upsert(
          {
            user_id: user.id,
            channel: "whatsapp",
            external_contact_id: to,
            last_message_at: sentAt,
          },
          { onConflict: "user_id,external_contact_id", ignoreDuplicates: false },
        )
        .select("id")
        .single();

      if (conv) {
        await adminClient.from("whatsapp_messages").insert({
          conversation_id: conv.id,
          direction: "outbound",
          type: "text",
          content_text: text,
          content_raw: { wamid, to },
          sent_at: sentAt,
          status: "sent",
        });
      }
    }

    // If Meta rate-limits or errors, propagate the status
    return json(metaData, metaRes.ok ? 200 : metaRes.status);
  } catch (err) {
    console.error("[whatsapp-proxy] Meta API fetch error:", err);
    return json({ error: "Failed to reach Meta API" }, 502);
  }
});
