/**
 * @function db-maintenance
 * @description Executa limpezas periódicas no banco de dados (cron semanal)
 * @status active
 * @calledBy pg_cron (semanal) ou admin manual
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Run the maintenance function
    const { data, error } = await supabase.rpc("run_db_maintenance");

    if (error) {
      console.error("db-maintenance error:", error);
      return errorResponse(500, error.message);
    }

    // Clean expired api_cache entries
    const { error: cacheErr } = await supabase
      .from("api_cache")
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (cacheErr) {
      console.warn("db-maintenance api_cache cleanup error:", cacheErr.message);
    }

    console.log("db-maintenance completed:", JSON.stringify(data));
    return jsonResponse({ success: true, results: data, cache_cleaned: !cacheErr, ran_at: new Date().toISOString() });
  } catch (e: any) {
    console.error("db-maintenance error:", e);
    return errorResponse(500, e.message || "Internal error");
  }
});
