/**
 * @function email-system
 * @description Sistema de e-mails transacionais (router para handlers)
 * @status active
 * @calledBy Admin
 */
import { corsHeaders, handleCors, errorResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "send-notification": {
        const { handleSendNotification } = await import("../_shared/email-notification.ts");
        return await handleSendNotification(req, params);
      }
      case "run-automation": {
        const { handleRunAutomation } = await import("../_shared/email-automation.ts");
        return await handleRunAutomation(req, params);
      }
      case "unsubscribe": {
        const { handleUnsubscribe } = await import("../_shared/email-unsub.ts");
        return await handleUnsubscribe(req, params);
      }
      default:
        return errorResponse(400, `Unknown action: ${action}`);
    }
  } catch (e: any) {
    console.error("email-system error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});
