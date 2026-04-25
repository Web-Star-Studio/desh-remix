/**
 * @function zernio-sync-accounts
 * @description One-shot sync: fetch accounts from Zernio for the user's social_profile
 *              (per workspace) and UPSERT them into public.social_accounts so the rest of
 *              the system (late-proxy filter, WABA UI, Universal Inbox) sees them.
 * @status active
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";

const ZERNIO_BASE = "https://zernio.com/api/v1";

interface ZernioAccount {
  _id?: string;
  id?: string;
  platform?: string;
  username?: string;
  name?: string;
  profilePicture?: string;
  avatar?: string;
  profileId?: string;
  status?: string;
}

function normalizePlatform(raw?: string): string {
  const p = (raw || "").toLowerCase().trim();
  if (!p) return "unknown";
  if (p.includes("whatsapp")) return "whatsapp";
  if (p.includes("instagram")) return "instagram";
  if (p.includes("linkedin")) return "linkedin";
  if (p.includes("google") || p.includes("gmb")) return "google_business";
  if (p.includes("facebook")) return "facebook";
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("youtube")) return "youtube";
  if (p.includes("twitter") || p === "x") return "twitter";
  if (p.includes("threads")) return "threads";
  if (p.includes("pinterest")) return "pinterest";
  return p;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ZERNIO_API_KEY = Deno.env.get("LATE_API_KEY") || Deno.env.get("ZERNIO_API_KEY");
    if (!ZERNIO_API_KEY) {
      return new Response(JSON.stringify({ error: "ZERNIO_API_KEY/LATE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Body
    const { workspace_id } = await req.json().catch(() => ({}));
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve social_profile for this workspace
    const { data: profile, error: profileErr } = await admin
      .from("social_profiles")
      .select("id, late_profile_id, workspace_id")
      .eq("user_id", userId)
      .eq("workspace_id", workspace_id)
      .maybeSingle();

    if (profileErr) throw profileErr;
    if (!profile?.late_profile_id) {
      return new Response(JSON.stringify({
        error: "no_profile",
        message: "Nenhum perfil Zernio vinculado a este workspace.",
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch accounts from Zernio
    const url = `${ZERNIO_BASE}/accounts?profileId=${encodeURIComponent(profile.late_profile_id)}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${ZERNIO_API_KEY}`, "Content-Type": "application/json" },
    });
    const text = await resp.text();
    let raw: any = null;
    try { raw = JSON.parse(text); } catch { raw = { accounts: [] }; }

    if (!resp.ok) {
      console.error("[zernio-sync-accounts] Zernio API error", resp.status, text);
      return new Response(JSON.stringify({
        error: "zernio_api_error",
        status: resp.status,
        message: raw?.message || raw?.error || text,
      }), { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const list: ZernioAccount[] = Array.isArray(raw)
      ? raw
      : (raw?.accounts || raw?.data || []);

    const synced: { platform: string; username: string; late_account_id: string }[] = [];
    for (const acc of list) {
      const lateAccountId = acc._id || acc.id;
      if (!lateAccountId) continue;
      const platform = normalizePlatform(acc.platform);
      const username = acc.username || acc.name || platform;
      const avatar = acc.profilePicture || acc.avatar || null;

      const { error: upErr } = await admin
        .from("social_accounts")
        .upsert({
          user_id: userId,
          workspace_id,
          profile_id: profile.id,
          late_account_id: lateAccountId,
          platform,
          username,
          avatar_url: avatar,
          status: acc.status || "connected",
        }, { onConflict: "user_id,late_account_id" });

      if (upErr) {
        console.error("[zernio-sync-accounts] upsert error", upErr, lateAccountId);
        continue;
      }
      synced.push({ platform, username, late_account_id: lateAccountId });
    }

    return new Response(JSON.stringify({
      synced: synced.length,
      profile_id: profile.late_profile_id,
      accounts: synced,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[zernio-sync-accounts] fatal", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
