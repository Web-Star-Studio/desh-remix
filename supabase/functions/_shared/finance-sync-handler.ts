import { jsonResponse, errorResponse } from "./utils.ts";

/**
 * Handles sync by triggering sync-financial-data in background (fire-and-forget).
 * Returns immediately to avoid the 150s edge function idle timeout — the actual
 * Pluggy sync can take 2-3 minutes for large accounts.
 *
 * The client should poll financial_connections.last_synced_at (or use realtime
 * on financial_transactions_unified) to detect when the sync completes.
 */
export async function handleSyncFinancialData(params: Record<string, any>) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const syncUrl = `${supabaseUrl}/functions/v1/sync-financial-data`;
  const payload = {
    provider: params.provider || "pluggy",
    connection_id: params.connection_id,
    provider_connection_id: params.provider_connection_id,
    user_id: params.user_id,
    workspace_id: params.workspace_id || null,
  };

  if (!payload.connection_id || !payload.provider_connection_id || !payload.user_id) {
    return errorResponse(400, "Missing required params: connection_id, provider_connection_id, user_id");
  }

  // Fire-and-forget: dispara o sync em background sem aguardar
  const backgroundTask = fetch(syncUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error("[finance-sync-handler] Background sync error:", err);
  });

  // EdgeRuntime.waitUntil mantém a task viva após retornar a resposta
  try {
    // @ts-ignore - EdgeRuntime is available in Supabase edge functions
    EdgeRuntime.waitUntil(backgroundTask);
  } catch {
    // Fallback: se EdgeRuntime não estiver disponível, ainda assim dispara (sem await)
  }

  return jsonResponse({
    success: true,
    queued: true,
    message: "Sync started in background. Poll financial_connections.last_synced_at to detect completion.",
  }, 202);
}
