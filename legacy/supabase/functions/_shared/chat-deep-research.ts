// Handler: deep-research — delegates to original function (streaming)
import { corsHeaders } from "./utils.ts";

export async function handleDeepResearch(req: Request, authResult: any, params: any) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-research`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: req.headers.get("Authorization") || "",
      apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
    },
    body: JSON.stringify({ topic: params.topic, lang: params.lang || "pt" }),
  });

  // Proxy the streaming response
  return new Response(resp.body, {
    status: resp.status,
    headers: {
      ...corsHeaders,
      "Content-Type": resp.headers.get("Content-Type") || "text/plain",
    },
  });
}
