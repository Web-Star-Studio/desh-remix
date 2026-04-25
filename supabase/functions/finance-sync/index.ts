/**
 * @function finance-sync
 * @description Sync de dados financeiros (router para handlers Pluggy)
 * @status active
 * @calledBy FinancePage
 */
import { corsHeaders, handleCors, errorResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "sync": {
        const { handleSyncFinancialData } = await import("../_shared/finance-sync-handler.ts");
        return await handleSyncFinancialData(params);
      }
      case "get-token": {
        const { handleGetConnectToken } = await import("../_shared/finance-connect-token-handler.ts");
        return await handleGetConnectToken(req, params);
      }
      default:
        return errorResponse(400, `Unknown action: ${action}`);
    }
  } catch (e: any) {
    console.error("finance-sync error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});
