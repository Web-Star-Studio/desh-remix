import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";
import { callEvolution } from "../_shared/whatsapp-evolution.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY") ?? "";

    // Auth: decode JWT then validate with getUser as fallback
    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.sub;
      if (!userId) throw new Error("no sub");
    } catch {
      return json({ error: "Invalid token" }, 401);
    }

    // Validate token is still active
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !user || user.id !== userId) {
      return json({ error: "Token expired or invalid" }, 401);
    }

    const body = await req.json();
    const { currentWorkspaceId, targetWorkspaceId } = body;
    if (!currentWorkspaceId || !targetWorkspaceId) {
      return json({ error: "Missing currentWorkspaceId or targetWorkspaceId" }, 400);
    }
    if (currentWorkspaceId === targetWorkspaceId) {
      return json({ error: "Source and target workspace are the same" }, 400);
    }

    // Validate user owns both workspaces
    const { data: workspaces } = await adminClient
      .from("workspaces")
      .select("id")
      .eq("user_id", userId)
      .in("id", [currentWorkspaceId, targetWorkspaceId]);

    if (!workspaces || workspaces.length < 2) {
      return json({ error: "You don't own both workspaces" }, 403);
    }

    // Check target workspace doesn't already have an active WhatsApp session
    const { data: existingTarget } = await adminClient
      .from("whatsapp_web_sessions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("workspace_id", targetWorkspaceId)
      .in("status", ["CONNECTED", "QR_PENDING", "RECONNECTING"])
      .limit(1);

    if (existingTarget && existingTarget.length > 0) {
      return json({ error: "O workspace destino já possui uma sessão WhatsApp ativa. Desconecte-a primeiro." }, 409);
    }

    // Build instance name: desh_{userId_8}_{workspaceId_6}
    const oldInstance = `desh_${userId.substring(0, 8)}_${currentWorkspaceId.substring(0, 6)}`;
    const results: Record<string, unknown> = {};

    // 1. Logout + delete old instance from Evolution API (best effort)
    if (evolutionApiKey) {
      // First logout
      const logoutRes = await callEvolution(
        evolutionApiKey,
        `/instance/logout/${oldInstance}`,
        "DELETE",
      );
      results.evolution_logout = { ok: logoutRes.ok, status: logoutRes.status };

      // Then delete the instance so it can be recreated in the new workspace
      const deleteRes = await callEvolution(
        evolutionApiKey,
        `/instance/delete/${oldInstance}`,
        "DELETE",
      );
      results.evolution_delete = { ok: deleteRes.ok, status: deleteRes.status };
    } else {
      results.evolution_logout = { ok: false, reason: "no_api_key" };
    }

    // 2. Update whatsapp_web_sessions
    const { error: sessErr } = await adminClient
      .from("whatsapp_web_sessions")
      .update({
        workspace_id: targetWorkspaceId,
        status: "DISCONNECTED",
        last_error: "Transferido para outro workspace. Reconecte via QR Code.",
        qr_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("workspace_id", currentWorkspaceId);

    results.sessions = { ok: !sessErr, error: sessErr?.message };

    // 3. Update whatsapp_conversations
    const { error: convErr } = await adminClient
      .from("whatsapp_conversations")
      .update({ workspace_id: targetWorkspaceId })
      .eq("user_id", userId)
      .eq("workspace_id", currentWorkspaceId);

    results.conversations = { ok: !convErr, error: convErr?.message };

    // 4. Check if there are any critical errors
    const hasErrors = sessErr || convErr;
    if (hasErrors) {
      console.error("[whatsapp-transfer] Partial failure:", results);
    }

    console.log(`[whatsapp-transfer] User ${userId.substring(0, 8)} transferred WA from ${currentWorkspaceId.substring(0, 6)} to ${targetWorkspaceId.substring(0, 6)}`, results);

    return json({
      success: !hasErrors,
      partial: !!hasErrors,
      results,
    });
  } catch (err) {
    console.error("[whatsapp-transfer] Error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
