/**
 * @function mapbox-proxy
 * @description Proxy para Mapbox APIs (geocode, reverse, directions, token)
 * @status active
 * @calledBy MapPage, mapbox-geocode, mapbox-reverse-geocode, mapbox-directions, mapbox-token
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
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "token": {
        const { handleToken } = await import("../_shared/mapbox-handlers.ts");
        return handleToken();
      }
      case "geocode": {
        const { handleGeocode } = await import("../_shared/mapbox-handlers.ts");
        return await handleGeocode(params as any);
      }
      case "reverse": {
        const { handleReverse } = await import("../_shared/mapbox-handlers.ts");
        return await handleReverse(params as any);
      }
      case "directions": {
        const { handleDirections } = await import("../_shared/mapbox-handlers.ts");
        return await handleDirections(params as any);
      }
      default:
        return errorResponse(400, `Unknown action: ${action}`);
    }
  } catch (e) {
    console.error("mapbox-proxy error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});
