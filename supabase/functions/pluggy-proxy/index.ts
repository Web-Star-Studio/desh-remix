/**
 * @function pluggy-proxy
 * @description Proxy para Pluggy Open Finance (contas, transações, pagamentos)
 * @status active
 * @calledBy Finance hooks
 */
import { corsHeaders, handleCors, errorResponse, jsonResponse } from "../_shared/utils.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { getPluggyApiKey, buildServiceClient } from "../_shared/pluggy-utils.ts";

const PAYMENT_ACTIONS = new Set([
  "list_institutions", "list_connectors", "create_recipient", "create_recipient_qr",
  "create_payment", "create_scheduled_payment", "create_pix_automatico",
  "list_pix_auto_schedules", "cancel_pix_auto", "schedule_pix_auto_payment",
  "get_payment", "list_intents", "delete_payment",
]);

const INSIGHT_ACTIONS = new Set([
  "kpis", "recurring", "behavior_analysis", "list_consents", "revoke_consent",
  "update_category", "list_categories", "category_rules", "item_status", "connectors_catalog",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const authResult = await verifyAuth(req);
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, ...params } = body;
    const userId = authResult.userId;

    if (action === "enrich") {
      const { handlePluggyEnrich } = await import("../_shared/pluggy-enrich-handler.ts");
      return await handlePluggyEnrich(params, userId);
    }

    if (action === "realtime-balance") {
      const { handleRealtimeBalance } = await import("../_shared/pluggy-balance-handler.ts");
      return await handleRealtimeBalance(params, userId);
    }

    if (INSIGHT_ACTIONS.has(action)) {
      const { handlePluggyInsights } = await import("../_shared/pluggy-insights-handler.ts");
      return await handlePluggyInsights({ action, ...params }, userId);
    }

    if (PAYMENT_ACTIONS.has(action)) {
      const { handlePluggyPayments } = await import("../_shared/pluggy-payments-handler.ts");
      return await handlePluggyPayments({ action, ...params }, userId);
    }

    return errorResponse(400, `Unknown action: ${action}`);
  } catch (e: any) {
    console.error("pluggy-proxy error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});
