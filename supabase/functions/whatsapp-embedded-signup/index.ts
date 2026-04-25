/**
 * @function whatsapp-embedded-signup
 * @description Signup embarcado WhatsApp Business
 * @status active
 * @calledBy WhatsApp onboarding
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";

interface PhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
}

interface WABAWithPhones {
  wabaId: string;
  wabaName: string;
  phoneNumbers: PhoneNumber[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the user JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accessToken } = await req.json();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "accessToken is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get user's Meta Business accounts
    const bizRes = await fetch(
      `https://graph.facebook.com/v20.0/me/businesses?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
    );
    const bizData = await bizRes.json();

    if (bizData.error) {
      console.error("Graph API businesses error:", bizData.error);
      return new Response(
        JSON.stringify({ error: `Graph API: ${bizData.error.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const businesses: { id: string; name: string }[] = bizData.data || [];
    const result: WABAWithPhones[] = [];

    // 2. For each business, fetch connected WhatsApp Business Accounts
    for (const biz of businesses) {
      const wabaRes = await fetch(
        `https://graph.facebook.com/v20.0/${biz.id}/owned_whatsapp_business_accounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
      );
      const wabaData = await wabaRes.json();
      if (wabaData.error || !wabaData.data) continue;

      for (const waba of wabaData.data as { id: string; name: string }[]) {
        // 3. For each WABA, fetch phone numbers
        const phonesRes = await fetch(
          `https://graph.facebook.com/v20.0/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&access_token=${encodeURIComponent(accessToken)}`
        );
        const phonesData = await phonesRes.json();
        const phones: PhoneNumber[] = phonesData.data || [];

        result.push({
          wabaId: waba.id,
          wabaName: waba.name || `WABA ${waba.id}`,
          phoneNumbers: phones,
        });
      }
    }

    // Also try direct WABA access (for tokens that already have waba scope without businesses endpoint)
    if (result.length === 0) {
      const directWabaRes = await fetch(
        `https://graph.facebook.com/v20.0/me/whatsapp_business_accounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
      );
      const directWabaData = await directWabaRes.json();
      if (!directWabaData.error && directWabaData.data) {
        for (const waba of directWabaData.data as { id: string; name: string }[]) {
          const phonesRes = await fetch(
            `https://graph.facebook.com/v20.0/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&access_token=${encodeURIComponent(accessToken)}`
          );
          const phonesData = await phonesRes.json();
          result.push({
            wabaId: waba.id,
            wabaName: waba.name || `WABA ${waba.id}`,
            phoneNumbers: phonesData.data || [],
          });
        }
      }
    }

    return new Response(JSON.stringify({ accounts: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("whatsapp-embedded-signup error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
