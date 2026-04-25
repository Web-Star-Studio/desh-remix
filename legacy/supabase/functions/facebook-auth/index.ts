/**
 * @function facebook-auth
 * @description Auth OAuth Facebook/Instagram
 * @status active
 * @calledBy Social connections settings
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { corsHeaders } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, userID } = await req.json();

    if (!accessToken || !userID) {
      return new Response(
        JSON.stringify({ error: "accessToken and userID are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validate token with Graph API
    const graphRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`
    );
    const graphData = await graphRes.json();

    if (graphData.error) {
      console.error("Graph API error:", graphData.error);
      return new Response(
        JSON.stringify({ error: "Token do Facebook inválido." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Security: validate that the token belongs to the claimed userID
    if (graphData.id !== userID) {
      return new Response(
        JSON.stringify({ error: "userID não corresponde ao token." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fbEmail = graphData.email as string | undefined;
    const fbName = (graphData.name as string) || `Usuário Facebook`;
    // Use real email or generate a deterministic one from FB user ID
    const email = fbEmail || `fb_${userID}@meta.desh`;
    const displayName = fbName;

    // 3. Admin client to create/find user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if user already exists by email
    const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
    if (listErr) throw listErr;

    let targetUser = users.find((u) => u.email === email);
    let isNewUser = false;

    if (!targetUser) {
      // Create user
      isNewUser = true;
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { display_name: displayName, fb_user_id: userID },
      });
      if (createErr) throw createErr;
      targetUser = created.user!;
    } else {
      // Update fb_user_id in metadata if not set
      if (!targetUser.user_metadata?.fb_user_id) {
        await adminClient.auth.admin.updateUserById(targetUser.id, {
          user_metadata: { ...targetUser.user_metadata, fb_user_id: userID },
        });
      }
    }

    // 4. Generate a magic link to get a session token
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr) throw linkErr;

    // Extract the token from the link
    const url = new URL(linkData.properties.action_link);
    const token = url.searchParams.get("token") || linkData.properties.hashed_token;

    return new Response(
      JSON.stringify({
        email,
        displayName,
        isNewUser,
        token,
        userId: targetUser.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("facebook-auth error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
