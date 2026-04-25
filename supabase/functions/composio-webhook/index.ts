/**
 * @function composio-webhook
 * @description Recebe webhooks Composio V3 (trigger events, token expired)
 * @status active
 * @calledBy Composio platform
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";

// Map Composio toolkit slugs to our internal categories
const TOOLKIT_CATEGORY_MAP: Record<string, string> = {
  gmail: "email",
  googlecalendar: "calendar",
  googletasks: "task",
  googledrive: "storage",
  googlesheets: "storage",
  slack: "messaging",
  github: "development",
  linear: "development",
};

function mapToolkitToCategory(triggerSlug: string): string {
  const slug = triggerSlug.toLowerCase();
  for (const [toolkit, category] of Object.entries(TOOLKIT_CATEGORY_MAP)) {
    if (slug.startsWith(toolkit.toUpperCase()) || slug.includes(toolkit.toUpperCase())) {
      return category;
    }
  }
  return "other";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: true, skipped: "parse_error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventType = payload.type as string | undefined;

  try {
    // ── composio.trigger.message ──────────────────────────────────────────
    if (eventType === "composio.trigger.message") {
      const metadata = payload.metadata as Record<string, unknown> | undefined;
      const data = payload.data as Record<string, unknown> | undefined;
      const triggerSlug = metadata?.trigger_slug as string || "UNKNOWN";
      const composioUserId = metadata?.user_id as string || "";
      const connectedAccountId = metadata?.connected_account_id as string || "";
      // Extract workspace_id from composite entityId (format: userId_workspaceId)
      const entityParts = composioUserId.split("_");
      const workspaceId = entityParts.length > 1 ? entityParts.slice(1).join("_") : null;

      const category = mapToolkitToCategory(triggerSlug);
      const processingTime = Date.now() - startTime;

      await admin.from("webhook_events").insert({
        connection_id: connectedAccountId || "composio",
        user_id: "00000000-0000-0000-0000-000000000000",
        category,
        event_type: "trigger",
        object_type: triggerSlug,
        payload: data || {},
        processed: true,
        source: "composio",
        processing_time_ms: processingTime,
        trigger_slug: triggerSlug,
        metadata: {
          composio_event_id: payload.id,
          trigger_id: metadata?.trigger_id,
          connected_account_id: connectedAccountId,
          auth_config_id: metadata?.auth_config_id,
          composio_user_id: composioUserId,
          workspace_id: workspaceId,
          timestamp: payload.timestamp,
        },
      });


      return new Response(
        JSON.stringify({ ok: true, trigger: triggerSlug }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── composio.connected_account.expired ────────────────────────────────
    if (eventType === "composio.connected_account.expired") {
      const metadata = payload.metadata as Record<string, unknown> | undefined;
      const data = payload.data as Record<string, unknown> | undefined;
      const composioUserId = metadata?.user_id as string || "";
      const connectedAccountId = metadata?.connected_account_id as string || "";
      const toolkit = (data?.toolkit as string) || (data?.app_name as string) || "unknown";

      const processingTime = Date.now() - startTime;

      // Log the event
      await admin.from("webhook_events").insert({
        connection_id: connectedAccountId || "composio",
        user_id: "00000000-0000-0000-0000-000000000000",
        category: "auth",
        event_type: "expired",
        object_type: `connected_account:${toolkit}`,
        payload: data || {},
        processed: true,
        source: "composio",
        processing_time_ms: processingTime,
        trigger_slug: null,
        metadata: {
          composio_event_id: payload.id,
          connected_account_id: connectedAccountId,
          composio_user_id: composioUserId,
          toolkit,
          timestamp: payload.timestamp,
        },
      });


      return new Response(
        JSON.stringify({ ok: true, expired: toolkit }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Unknown event type — log but return 200
    const processingTime = Date.now() - startTime;
    await admin.from("webhook_events").insert({
      connection_id: "composio",
      user_id: "00000000-0000-0000-0000-000000000000",
      category: "other",
      event_type: eventType || "unknown",
      object_type: "composio_event",
      payload,
      processed: false,
      source: "composio",
      processing_time_ms: processingTime,
      metadata: { raw_type: eventType },
    });

    return new Response(
      JSON.stringify({ ok: true, skipped: "unknown_event_type" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const processingTime = Date.now() - startTime;
    console.error("[composio-webhook] Error:", err);

    // Try to log the error
    try {
      await admin.from("webhook_events").insert({
        connection_id: "composio",
        user_id: "00000000-0000-0000-0000-000000000000",
        category: "other",
        event_type: eventType || "error",
        object_type: "composio_error",
        payload,
        processed: false,
        source: "composio",
        processing_time_ms: processingTime,
        error_message: err instanceof Error ? err.message : String(err),
        metadata: {},
      });
    } catch { /* ignore logging error */ }

    // Always return 200 to prevent retries
    return new Response(
      JSON.stringify({ ok: true, error: "internal" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
