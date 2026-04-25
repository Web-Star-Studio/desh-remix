/**
 * @function whatsapp-web-proxy
 * @description Proxy WhatsApp Web via Evolution API — Router entry point
 * @status active
 * @calledBy WhatsApp Web module
 * @note Custom CORS headers (x-workspace-id, Access-Control-Allow-Methods)
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { userInstanceName } from "../_shared/whatsapp-utils.ts";
import type { WaContext } from "../_shared/whatsapp-evolution.ts";
import { handleWebhook } from "../_shared/whatsapp-webhook-handler.ts";
import {
  handleInstanceCreate, handleInstanceDelete, handleRestart,
  handleQr, handleQrRaw, handleStatus, handleSessionCreate, handleSessionDelete,
  handleWebhookSetup, handleWebhookStatus, handleDebugAuth,
  handleHealthCheck, handleDebugAdmin,
} from "../_shared/whatsapp-session-handler.ts";
import {
  handleSendText, handleSendMedia, handleMediaDownload, handleMarkRead,
  handleSendReaction, handleDeleteMessage, handleStarMessage, handleForwardMessage,
} from "../_shared/whatsapp-message-handler.ts";
import {
  handleSyncUnread, handleSyncHistoryStart, handleSyncHistoryBatch,
  handleSyncHistoryCancel, handleSyncHistoryLegacy,
} from "../_shared/whatsapp-sync-handler.ts";
import {
  handleFetchProfilePicture, handleEnrichContacts,
  handleFindPresence, handleFindContactInfo, handleUpdatePresence,
} from "../_shared/whatsapp-contact-handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-workspace-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("WHATSAPP_WEB_GATEWAY_SECRET") ?? "";

  const url = new URL(req.url);
  const segments = url.pathname.replace(/^\/whatsapp-web-proxy\/?/, "").split("/").filter(Boolean);
  const route = segments[0] ?? "";

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // ── PUBLIC ROUTES (no auth) ────────────────────────────────────────────────
  if (req.method === "POST" && route === "webhook") {
    const result = await handleWebhook(req, { adminClient, apiKey, supabaseUrl, supabaseAnonKey, serviceRoleKey });
    if (result instanceof Response) return result;
    return json(result.data, result.status);
  }

  if (req.method === "POST" && route === "health-check") {
    const result = await handleHealthCheck(adminClient, apiKey);
    return json(result.data, result.status);
  }

  if (req.method === "GET" && route === "debug") {
    const result = await handleDebugAdmin(req, adminClient, apiKey, supabaseUrl, supabaseAnonKey);
    return json(result.data, result.status);
  }

  // ── AUTH (required for all other routes) ───────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) return json({ error: "Unauthorized" }, 401);

  const userId = authUser.id;
  let workspaceId = req.headers.get("x-workspace-id") ?? undefined;

  // If no workspace provided, resolve from active WhatsApp session
  if (!workspaceId) {
    const { data: activeSession } = await adminClient
      .from("whatsapp_web_sessions")
      .select("workspace_id")
      .eq("user_id", userId)
      .eq("status", "CONNECTED")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeSession?.workspace_id) {
      workspaceId = activeSession.workspace_id;
    } else {
      // Fallback: any session (even disconnected)
      const { data: anySession } = await adminClient
        .from("whatsapp_web_sessions")
        .select("workspace_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (anySession?.workspace_id) workspaceId = anySession.workspace_id;
    }
  }

  const instance = userInstanceName(userId, workspaceId);
  const ctx: WaContext = { adminClient, userId, instance, workspaceId, supabaseUrl, supabaseAnonKey, serviceRoleKey, apiKey };

  // Helper to parse body for POST routes
  const parseBody = () => req.json().catch(() => ({}));

  let result: { data: unknown; status: number };

  try {
    switch (route) {
      // ── Session/Instance ──
      case "instance-create":    result = await handleInstanceCreate(ctx); break;
      case "instance-delete":    result = await handleInstanceDelete(ctx); break;
      case "restart":            result = await handleRestart(ctx); break;
      case "qr":                 result = await handleQr(ctx); break;
      case "qr-raw":             result = await handleQrRaw(ctx); break;
      case "status":             result = await handleStatus(ctx); break;
      case "webhook-setup":      result = await handleWebhookSetup(ctx); break;
      case "webhook-status":     result = await handleWebhookStatus(ctx); break;
      case "debug-auth":         result = await handleDebugAuth(ctx); break;
      case "sessions":
        if (req.method === "POST" && segments.length === 1) result = await handleSessionCreate(ctx);
        else if (req.method === "DELETE" && segments.length === 2) result = await handleSessionDelete(ctx);
        else result = { data: { error: "Rota não encontrada" }, status: 404 };
        break;

      // ── Messages ──
      case "messages":           result = await handleSendText(ctx, await parseBody()); break;
      case "send-media":         result = await handleSendMedia(ctx, await parseBody()); break;
      case "media-download":     result = await handleMediaDownload(ctx, await parseBody()); break;
      case "mark-read":          result = await handleMarkRead(ctx, await parseBody()); break;
      case "send-reaction":      result = await handleSendReaction(ctx, await parseBody()); break;
      case "delete-message":     result = await handleDeleteMessage(ctx, await parseBody()); break;
      case "star-message":       result = await handleStarMessage(ctx, await parseBody()); break;
      case "forward-message":    result = await handleForwardMessage(ctx, await parseBody()); break;

      // ── Sync ──
      case "sync-unread":        result = await handleSyncUnread(ctx); break;
      case "sync-history":       result = await handleSyncHistoryLegacy(ctx); break;
      case "sync-history-start": result = await handleSyncHistoryStart(ctx); break;
      case "sync-history-batch": result = await handleSyncHistoryBatch(ctx, await parseBody()); break;
      case "sync-history-cancel":result = await handleSyncHistoryCancel(ctx, await parseBody()); break;

      // ── Contacts ──
      case "fetch-profile-picture": result = await handleFetchProfilePicture(ctx, await parseBody()); break;
      case "enrich-contacts":       result = await handleEnrichContacts(ctx); break;
      case "find-presence":         result = await handleFindPresence(ctx, await parseBody()); break;
      case "find-contact-info":     result = await handleFindContactInfo(ctx, await parseBody()); break;
      case "update-presence":       result = await handleUpdatePresence(ctx, await parseBody()); break;

      default:
        result = { data: { error: "Rota não encontrada" }, status: 404 };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[whatsapp-web-proxy] Unhandled error on /${route}:`, msg);
    result = { data: { error: msg }, status: 500 };
  }

  return json(result.data, result.status);
});
