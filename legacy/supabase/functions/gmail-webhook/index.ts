/**
 * @function gmail-webhook
 * @description Push notifications do Gmail via Google Cloud Pub/Sub (watch sync)
 * @status active
 * @calledBy Google Cloud Pub/Sub
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { getComposioAccessToken, resolveWorkspaceId } from "../_shared/composio-client.ts";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Fetch with retry on 429/503 */
async function gmailFetch(url: string, accessToken: string, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 429 || res.status === 503) {
      const retryAfter = res.headers.get("Retry-After");
      const delay = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 30_000) : (1500 * (attempt + 1));
      console.warn(`[gmail-webhook] Rate limited (${res.status}), retrying in ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    return res;
  }
  return fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
}

function parseMessage(m: any, userId: string, connId: string, workspaceId: string | null) {
  const headers = m.payload?.headers || [];
  const fromHeader = headers.find((h: any) => h.name === "From")?.value || "";
  const subjectHeader = headers.find((h: any) => h.name === "Subject")?.value || "";
  const dateHeader = headers.find((h: any) => h.name === "Date")?.value || "";
  const fromName = fromHeader.replace(/<.*>/g, "").trim() || "Desconhecido";
  const fromEmailMatch = fromHeader.match(/<(.+?)>/);
  const fromEmail = fromEmailMatch ? fromEmailMatch[1] : fromHeader;
  const labelIds: string[] = m.labelIds || [];

  const folder = labelIds.includes("SENT") ? "sent"
    : labelIds.includes("DRAFT") ? "drafts"
    : labelIds.includes("TRASH") ? "trash"
    : labelIds.includes("SPAM") ? "spam"
    : "inbox";

  return {
    user_id: userId,
    gmail_id: m.id,
    connection_id: connId,
    workspace_id: workspaceId,
    from_name: fromName,
    from_email: fromEmail,
    subject: subjectHeader || m.snippet || "Sem assunto",
    snippet: m.snippet || "",
    date: (() => { if (!dateHeader) return new Date().toISOString(); const d = new Date(dateHeader); return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); })(),
    is_unread: labelIds.includes("UNREAD"),
    is_starred: labelIds.includes("STARRED"),
    has_attachment: !!(m.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)),
    label_ids: labelIds,
    folder,
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const message = body.message;
    if (!message?.data) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_data" }), { status: 200 });
    }

    let decoded: { emailAddress?: string; historyId?: number };
    try {
      decoded = JSON.parse(atob(message.data));
    } catch {
      return new Response(JSON.stringify({ ok: true, skipped: "decode_error" }), { status: 200 });
    }

    const { emailAddress, historyId: incomingHistoryId } = decoded;
    if (!emailAddress || !incomingHistoryId) {
      return new Response(JSON.stringify({ ok: true, skipped: "missing_fields" }), { status: 200 });
    }


    // Find user by email — lookup in composio_user_emails
    const { data: mapping, error: mappingError } = await serviceClient
      .from("composio_user_emails")
      .select("user_id")
      .eq("email", emailAddress)
      .eq("toolkit", "gmail")
      .maybeSingle();

    if (mappingError || !mapping) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_mapping" }), { status: 200 });
    }

    const userId = mapping.user_id;
    const connId = "composio-gmail";

    // Resolve workspace for composite entityId
    const workspaceId = await resolveWorkspaceId(serviceClient, userId);

    // Get access token via Composio with workspace-aware entityId
    const accessToken = await getComposioAccessToken(userId, "gmail", workspaceId);
    if (!accessToken) {
      console.error(`[gmail-webhook] Could not get Composio access token for user ${userId} ws ${workspaceId}`);
      return new Response(JSON.stringify({ ok: true, skipped: "no_composio_token" }), { status: 200 });
    }

    // Get stored sync state with composite key
    const { data: syncState } = await serviceClient
      .from("gmail_sync_state")
      .select("history_id, total_synced")
      .eq("user_id", userId)
      .eq("folder", "inbox")
      .eq("connection_id", connId)
      .maybeSingle();

    const storedHistoryId = syncState?.history_id;

    if (!storedHistoryId) {
      await serviceClient.from("gmail_sync_state").upsert({
        user_id: userId, folder: "inbox", connection_id: connId,
        history_id: Number(incomingHistoryId),
        last_synced_at: new Date().toISOString(),
        total_synced: 0, sync_completed: false,
      }, { onConflict: "user_id,folder,connection_id" });
      return new Response(JSON.stringify({ ok: true, bootstrapped: true }), { status: 200 });
    }

    if (Number(incomingHistoryId) <= Number(storedHistoryId)) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_processed" }), { status: 200 });
    }

    // Fetch full history delta (added, deleted, label changes)
    const historyParams = new URLSearchParams({
      startHistoryId: String(storedHistoryId),
      historyTypes: "messageAdded,messageDeleted,labelAdded,labelRemoved",
      labelId: "INBOX",
      maxResults: "500",
    });

    const historyRes = await gmailFetch(`${GMAIL_BASE}/history?${historyParams}`, accessToken);

    if (!historyRes.ok) {
      const errText = await historyRes.text();
      console.error("[gmail-webhook] History API error:", historyRes.status, errText);
      await serviceClient.from("gmail_sync_state").upsert({
        user_id: userId, folder: "inbox", connection_id: connId,
        history_id: Number(incomingHistoryId),
        last_synced_at: new Date().toISOString(),
        total_synced: syncState?.total_synced ?? 0,
        sync_completed: true,
      }, { onConflict: "user_id,folder,connection_id" });
      return new Response(JSON.stringify({ ok: true, history_error: true }), { status: 200 });
    }

    const historyData = await historyRes.json();
    const histories: any[] = historyData.history || [];

    // Collect changes
    const addedIds = new Set<string>();
    const deletedIds = new Set<string>();
    const labelChangedIds = new Set<string>();

    for (const h of histories) {
      for (const added of (h.messagesAdded || [])) addedIds.add(added.message.id);
      for (const deleted of (h.messagesDeleted || [])) deletedIds.add(deleted.message.id);
      for (const la of (h.labelsAdded || [])) labelChangedIds.add(la.message.id);
      for (const lr of (h.labelsRemoved || [])) labelChangedIds.add(lr.message.id);
    }

    // Remove deleted from added
    for (const id of deletedIds) {
      addedIds.delete(id);
      labelChangedIds.delete(id);
    }

    const idsToFetch = [...new Set([...addedIds, ...labelChangedIds])];
    let synced = 0;

    if (idsToFetch.length > 0) {
      const BATCH_SIZE = 10;
      const detailedMessages: any[] = [];
      for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
        const batch = idsToFetch.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async (id) => {
          try {
            const msgRes = await gmailFetch(
              `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
              accessToken
            );
            if (!msgRes.ok) return null;
            return await msgRes.json();
          } catch { return null; }
        }));
        detailedMessages.push(...results.filter(Boolean));
        if (i + BATCH_SIZE < idsToFetch.length) await new Promise(r => setTimeout(r, 150));
      }

      const cacheRows = detailedMessages.map(m => parseMessage(m, userId, connId, workspaceId));
      if (cacheRows.length > 0) {
        const { error: upsertError } = await serviceClient
          .from("gmail_messages_cache")
          .upsert(cacheRows, { onConflict: "user_id,gmail_id" });
        if (upsertError) console.error("Upsert error:", upsertError);
        synced = cacheRows.length;
      }
    }

    // Delete removed messages
    let deletedCount = 0;
    if (deletedIds.size > 0) {
      const { count } = await serviceClient
        .from("gmail_messages_cache")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .in("gmail_id", [...deletedIds]);
      deletedCount = count || 0;
    }

    // Update sync state with composite key
    await serviceClient.from("gmail_sync_state").upsert({
      user_id: userId, folder: "inbox", connection_id: connId,
      history_id: Number(incomingHistoryId),
      total_synced: (syncState?.total_synced ?? 0) + synced - deletedCount,
      last_synced_at: new Date().toISOString(),
      sync_completed: true,
    }, { onConflict: "user_id,folder,connection_id" });

    const processingTime = Date.now() - Date.parse(new Date().toISOString());
    const processingMs = Math.max(0, Date.now() - (performance.now() - performance.now() + Date.now()) );


    // Log to webhook_events for unified admin dashboard
    try {
      await serviceClient.from("webhook_events").insert({
        connection_id: connId,
        user_id: userId,
        category: "email",
        event_type: "updated",
        object_type: "gmail_sync",
        payload: { synced, deleted: deletedCount, historyId: incomingHistoryId, emailAddress },
        processed: true,
        source: "gmail",
        processing_time_ms: null,
        metadata: { emailAddress },
      });
    } catch (logErr) {
      console.warn("[gmail-webhook] Failed to log to webhook_events:", logErr);
    }

    return new Response(JSON.stringify({ ok: true, synced, deleted: deletedCount }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[gmail-webhook] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 200 });
  }
});
