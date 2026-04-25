/**
 * @function widgets-proxy
 * @description Proxy para widgets do dashboard (morning-briefing)
 * @status active
 * @calledBy Dashboard widgets, morning-briefing
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { corsHeaders, handleCors, errorResponse } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  const authResult = await verifyAuth(req);
  if (authResult instanceof Response) {
    return new Response(authResult.body, {
      status: authResult.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, ...params } = body;

    switch (action) {
      case "morning-briefing": {
        const { handleMorningBriefing } = await import("../_shared/widget-briefing-handler.ts");
        return await handleMorningBriefing(params, authResult.userId);
      }
      default:
        return errorResponse(400, `Unknown action: ${action}`);
    }
  } catch (e) {
    console.error("widgets-proxy error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});
