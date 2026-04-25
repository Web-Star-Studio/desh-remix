/**
 * @function serp-proxy
 * @description Proxy para SERP API (search, monitor-check)
 * @status active
 * @calledBy SEO tools, serp-search, serp-monitor-check
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "search": {
        // Forward full request to serp-search handler
        const { handleSerpSearch } = await import("../_shared/serp-search-handler.ts");
        return await handleSerpSearch(req, params);
      }
      case "monitor-check": {
        const { handleMonitorCheck } = await import("../_shared/serp-monitor-handler.ts");
        return await handleMonitorCheck(req, params);
      }
      default:
        return errorResponse(400, `Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("serp-proxy error:", error);
    return errorResponse(500, error.message);
  }
});
