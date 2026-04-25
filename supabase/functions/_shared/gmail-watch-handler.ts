import { jsonResponse, errorResponse } from "./utils.ts";

/**
 * Gmail Watch — sets up a Gmail push notification watch via Composio proxy.
 * Called from gmail-gateway (action: "watch") and the deprecated gmail-watch function.
 */
export async function handleGmailWatch(req: Request, params: Record<string, any>) {
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
    userId = params.userId; // fallback for background jobs
  }
  if (!userId) {
    return errorResponse(401, "Not authenticated");
  }
  const workspaceId = params.workspace_id || params.workspaceId || "default";

  // Resolve effective workspace
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
    // Use composio-proxy to set up Gmail watch via GMAIL_WATCH action
    const { data, error } = await supabase.functions.invoke("composio-proxy", {
      body: {
        service: "gmail",
        path: "/watch",
        method: "POST",
        data: {
          userId,
          topicName: params.topicName || `projects/${Deno.env.get("GCP_PROJECT_ID") || "pandora"}/topics/gmail-push`,
          labelIds: params.labelIds || ["INBOX"],
        },
        workspace_id: effectiveWorkspaceId,
        default_workspace_id: effectiveWorkspaceId,
      },
      headers: { Authorization: authHeader },
    });

    if (error) {
      console.warn("[gmail-watch] composio-proxy error (non-critical):", error);
      // Return 200 with error details instead of 500 — watch is optional and should not crash the client
      return jsonResponse({ ok: false, reason: "watch_unavailable", message: typeof error === "object" && "message" in error ? (error as any).message : String(error) });
    }

    // Store watch expiration if returned
    if (data?.expiration) {
      await supabase
        .from("user_data")
        .upsert({
          user_id: userId,
          data_type: "gmail_watch",
          data: { expiration: data.expiration, historyId: data.historyId, updatedAt: new Date().toISOString() },
        }, { onConflict: "user_id,data_type" })
        .throwOnError();
    }

    return jsonResponse({ ok: true, expiration: data?.expiration, historyId: data?.historyId });
  } catch (e: any) {
    console.error("[gmail-watch] error:", e);
    return errorResponse(500, e.message || "Gmail watch setup failed");
  }
}
