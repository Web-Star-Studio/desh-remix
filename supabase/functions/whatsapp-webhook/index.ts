/**
 * @function whatsapp-webhook
 * @description Webhook público para Meta Platform (mensagens e status)
 * @status active
 * @calledBy Meta Platform
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";

function ok(body = "OK") {
  return new Response(body, { status: 200, headers: corsHeaders });
}

function err(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const verifyToken = Deno.env.get("META_WHATSAPP_VERIFY_TOKEN") ?? "";

  // ── GET: Hub verification challenge ────────────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken && challenge) {
      return ok(challenge);
    }

    return err("Forbidden: verify_token mismatch", 403);
  }

  // ── POST: Inbound events ────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return err("Method not allowed", 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return ok(); // Always 200 to Meta even on parse errors to prevent retries
  }

  // Only handle whatsapp_business_account objects
  if (payload.object !== "whatsapp_business_account") {
    return ok();
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];

  for (const entry of entries) {
    const wabaId = entry.id as string;
    const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];

    // Resolve which user owns this WABA
    const { data: connRow } = await admin
      .from("whatsapp_connections")
      .select("id, user_id, phone_number_id")
      .eq("waba_id", wabaId)
      .maybeSingle();

    if (!connRow) {
      console.warn("[whatsapp-webhook] No connection found for waba_id:", wabaId);
      continue;
    }

    const { user_id: userId } = connRow;

    for (const change of changes) {
      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      // ── Inbound messages ──────────────────────────────────────────────────
      const messages = (value.messages as Array<Record<string, unknown>>) ?? [];
      for (const msg of messages) {
        const externalContactId = msg.from as string;
        const wamid = msg.id as string;
        const msgType = (msg.type as string) ?? "other";
        const textBody = (msg.text as Record<string, unknown> | undefined)?.body as string | undefined;
        const timestamp = parseInt(msg.timestamp as string, 10);
        const sentAt = timestamp ? new Date(timestamp * 1000).toISOString() : new Date().toISOString();

        // Upsert conversation
        const { data: conv } = await admin
          .from("whatsapp_conversations")
          .upsert(
            {
              user_id: userId,
              channel: "whatsapp",
              external_contact_id: externalContactId,
              last_message_at: sentAt,
            },
            { onConflict: "user_id,external_contact_id", ignoreDuplicates: false },
          )
          .select("id, unread_count")
          .single();

        if (!conv) {
          console.error("[whatsapp-webhook] Failed to upsert conversation for:", externalContactId);
          continue;
        }

        // Increment unread count (coerce null → 0 for brand-new rows)
        await admin
          .from("whatsapp_conversations")
          .update({ unread_count: (conv.unread_count ?? 0) + 1, last_message_at: sentAt })
          .eq("id", conv.id);

        // Insert message — wrapped in try/catch to prevent retry loops from Meta
        try {
          const VALID_MSG_TYPES = ["text","image","audio","video","document","sticker","location","contact","reaction","template","other"];
          const safeType = VALID_MSG_TYPES.includes(msgType) ? msgType : "other";

          await admin.from("whatsapp_messages").insert({
            conversation_id: conv.id,
            direction: "inbound",
            type: safeType,
            content_text: textBody ?? null,
            content_raw: { ...msg, wamid },
            sent_at: sentAt,
            status: "delivered",
          });
        } catch (insertErr) {
          console.error("[whatsapp-webhook] Error inserting message:", insertErr);
          // Continue processing — don't return 500
        }

      }

      // ── Status updates ────────────────────────────────────────────────────
      const statuses = (value.statuses as Array<Record<string, unknown>>) ?? [];
      for (const status of statuses) {
        const wamid = status.id as string;
        const newStatus = status.status as string; // sent | delivered | read | failed

        // Map Meta status → our schema
        const mappedStatus =
          newStatus === "read" ? "read"
          : newStatus === "delivered" ? "delivered"
          : newStatus === "failed" ? "failed"
          : null;

        if (!mappedStatus) continue;

        // Find the message by wamid stored in content_raw
        const { data: msgRow } = await admin
          .from("whatsapp_messages")
          .select("id")
          .eq("content_raw->>wamid", wamid)
          .maybeSingle();

        if (msgRow) {
          await admin
            .from("whatsapp_messages")
            .update({ status: mappedStatus })
            .eq("id", msgRow.id);

        }
      }
    }
  }

  // Log to webhook_events for unified admin dashboard
  try {
    const totalMessages = entries.reduce((sum: number, entry: any) => {
      const changes = entry.changes || [];
      return sum + changes.reduce((cs: number, c: any) => cs + ((c.value?.messages as any[])?.length || 0), 0);
    }, 0);

    if (totalMessages > 0) {
      await admin.from("webhook_events").insert({
        connection_id: "whatsapp",
        user_id: "00000000-0000-0000-0000-000000000000",
        category: "messaging",
        event_type: "created",
        object_type: "whatsapp_inbound",
        payload: { messages_count: totalMessages, entries_count: entries.length },
        processed: true,
        source: "whatsapp",
        metadata: {},
      });
    }
  } catch (logErr) {
    console.warn("[whatsapp-webhook] Failed to log to webhook_events:", logErr);
  }

  // Always return 200 to Meta to prevent infinite retries
  return ok();
});
