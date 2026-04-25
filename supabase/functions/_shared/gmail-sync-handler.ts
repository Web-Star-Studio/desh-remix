import { jsonResponse, errorResponse } from "./utils.ts";
import { emitEvent } from "./event-emitter.ts";

/**
 * Gmail Sync — fetches recent emails via Composio and upserts into emails_cache.
 * Called from gmail-gateway (action: "sync") and the deprecated gmail-sync function.
 */
export async function handleGmailSync(req: Request, params: Record<string, any>) {
  const { createClient } = await import("npm:@supabase/supabase-js@2.95.3");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Extract user from JWT
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  let userId: string | null = null;
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id ?? null;
  }
  if (!userId && params.userId) {
    userId = params.userId;
  }
  if (!userId) {
    return errorResponse(401, "Not authenticated");
  }

  const maxResults = params.maxResults || 20;
  const labelIds = params.labelIds || ["INBOX"];
  const query = params.query || "";
  const workspaceId = params.workspace_id || params.workspaceId || "default";

  // Resolve effective workspace: find user's default workspace if needed
  let effectiveWorkspaceId = workspaceId;
  if (effectiveWorkspaceId === "default") {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .limit(1)
      .single();
    if (ws?.id) effectiveWorkspaceId = ws.id;
  }

  try {
    // Fetch emails via composio-proxy
    const { data, error } = await supabase.functions.invoke("composio-proxy", {
      body: {
        service: "gmail",
        path: "/messages",
        method: "GET",
        params: {
          max_results: maxResults,
          label_ids: labelIds,
          query,
          include_body: true,
        },
        workspace_id: effectiveWorkspaceId,
        default_workspace_id: effectiveWorkspaceId,
      },
      headers: { Authorization: authHeader },
    });

    if (error) {
      console.error("[gmail-sync] composio-proxy error:", error);
      return errorResponse(500, typeof error === "object" && "message" in error ? (error as any).message : String(error));
    }

    // Normalize messages from composio response
    const messages = data?.messages || data?.data?.messages || [];
    let synced = 0;

    if (messages.length > 0) {
      const rows = messages.map((msg: any) => {
        const gmailId = msg.messageId || msg.id || "";
        const fromRaw = msg.from || msg.sender || "";
        const fromMatch = fromRaw.match(/^(.*?)\s*<(.+?)>$/);
        const fromName = fromMatch ? fromMatch[1].trim().replace(/^"|"$/g, "") : fromRaw;
        const fromEmail = fromMatch ? fromMatch[2] : fromRaw;

        return {
          user_id: userId,
          gmail_id: gmailId,
          subject: msg.subject || "(sem assunto)",
          from_name: fromName || null,
          from_email: fromEmail || null,
          body_preview: (msg.messageText || msg.snippet || "").substring(0, 500),
          is_read: !(msg.labelIds || []).includes("UNREAD"),
          has_attachment: (msg.attachmentList || []).length > 0,
          labels: msg.labelIds || [],
          received_at: msg.date || msg.receivedAt || msg.internalDate || new Date().toISOString(),
          composio_synced_at: new Date().toISOString(),
        };
      }).filter((r: any) => r.gmail_id);

      if (rows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("emails_cache")
          .upsert(rows, { onConflict: "user_id,gmail_id", ignoreDuplicates: false });

        if (upsertErr) {
          console.error("[gmail-sync] upsert error:", upsertErr);
        } else {
          synced = rows.length;
          // Emit events for new emails (fire-and-forget)
          for (const row of rows) {
            emitEvent(supabase, userId!, effectiveWorkspaceId === "default" ? null : effectiveWorkspaceId, "email.received", "email", {
              from: row.from_email, from_name: row.from_name, subject: row.subject,
              snippet: (row.body_preview || "").substring(0, 200), labels: row.labels,
            }).catch(() => {});
          }
        }
      }
    }

    return jsonResponse({ synced, done: true, total: messages.length });
  } catch (e: any) {
    console.error("[gmail-sync] error:", e);
    return errorResponse(500, e.message || "Gmail sync failed");
  }
}
