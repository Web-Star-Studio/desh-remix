import { createClient } from "npm:@supabase/supabase-js@2.95.3";

export async function verifyAuth(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Try getClaims first (fast, local JWT verification)
  const token = authHeader.replace("Bearer ", "");
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (!error && data?.claims?.sub) {
      return { userId: data.claims.sub };
    }
  } catch {
    // getClaims not available or failed, fall through to getUser
  }

  // Fallback: server-side session lookup
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user?.id) {
    console.error("Auth error:", userError?.message ?? "No user");
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return { userId: userData.user.id };
}
