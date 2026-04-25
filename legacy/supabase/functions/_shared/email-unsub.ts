// Handler: email-unsubscribe — delegates to original function
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "./utils.ts";

export async function handleUnsubscribe(req: Request, params: any) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await supabase.functions.invoke("email-unsubscribe", {
    body: params,
    headers: { Authorization: req.headers.get("Authorization") || "" },
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
