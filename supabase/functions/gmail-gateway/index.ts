/**
 * @function gmail-gateway
 * @description Sync gateway Gmail (router para handlers de sync)
 * @status active
 * @calledBy EmailPage
 */
import { corsHeaders, handleCors, errorResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "sync": {
        const { handleGmailSync } = await import("../_shared/gmail-sync-handler.ts");
        return await handleGmailSync(req, params);
      }
      case "watch": {
        const { handleGmailWatch } = await import("../_shared/gmail-watch-handler.ts");
        return await handleGmailWatch(req, params);
      }
      default:
        return errorResponse(400, `Unknown action: ${action}`);
    }
  } catch (e: any) {
    console.error("gmail-gateway error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});
