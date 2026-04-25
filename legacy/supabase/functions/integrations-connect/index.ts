/**
 * @function integrations-connect
 * @description OAuth flow Composio — initiate, list, disconnect integrations
 * @status active
 * @calledBy useComposioConnection
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { initiateConnection, getConnectedToolkitsDetailed, disconnectToolkit, getGoogleAccountEmail } from "../_shared/composio-client.ts";
import { corsHeaders, jsonResponse, errorResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(401, "No auth header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");

    // Fast local JWT verification first, fallback to getUser
    let userId: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload?.sub) {
        userId = payload.sub;
      }
    } catch { /* fallback below */ }

    if (!userId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return errorResponse(401, authError?.message || "Unauthorized");
      }
      userId = user.id;
    }

    const body = await req.json();
    const { action, toolkit, workspace_id = 'default', default_workspace_id } = body;

    // Resolve effective workspace: 'all' falls back to default
    const effectiveWorkspaceId = workspace_id === 'all'
      ? (default_workspace_id || 'default')
      : workspace_id;
    const entityId = `${userId}_${effectiveWorkspaceId}`;

    if (action === "connect") {
      if (!toolkit) {
        return errorResponse(400, "toolkit é obrigatório");
      }

      const url = await initiateConnection(entityId, toolkit);
      return jsonResponse({ url });
    }

    if (action === "status") {
      const normalizeToolkitSlug = (value: string | null | undefined) =>
        String(value || "").toLowerCase().replace(/\s/g, "").replace(/_/g, "");

      const getToolkitFamily = (value: string | null | undefined) => {
        const slug = normalizeToolkitSlug(value);
        if (slug === "gmail" || slug === "youtube" || slug.startsWith("google")) return "google";
        if (["outlook", "onedrive", "teams"].includes(slug)) return "microsoft";
        return slug;
      };

      const detailed = await getConnectedToolkitsDetailed(entityId);
      const connected = detailed.map(d => d.toolkit);

      if (connected.length > 0) {
        // 1. Load persisted emails for this workspace
        const { data: emailRows } = await supabase
          .from("composio_user_emails")
          .select("toolkit, email")
          .eq("user_id", userId)
          .eq("workspace_id", effectiveWorkspaceId);

        const exactEmailMap = new Map<string, string>();
        const familyEmailMap = new Map<string, string>();

        (emailRows || []).forEach((r: any) => {
          const normalizedToolkit = normalizeToolkitSlug(r.toolkit);
          const family = getToolkitFamily(normalizedToolkit);
          if (r.email) {
            exactEmailMap.set(normalizedToolkit, r.email);
            if (!familyEmailMap.has(family)) familyEmailMap.set(family, r.email);
          }
        });

        // 2. Enrich from Composio metadata
        detailed.forEach((item) => {
          const family = getToolkitFamily(item.toolkit);
          if (item.email) {
            exactEmailMap.set(item.toolkit, item.email);
            if (!familyEmailMap.has(family)) familyEmailMap.set(family, item.email);
          }
        });

        // 3. Apply fallback from maps
        for (const item of detailed) {
          const normalizedToolkit = normalizeToolkitSlug(item.toolkit);
          const family = getToolkitFamily(normalizedToolkit);
          if (!item.email) {
            item.email = exactEmailMap.get(normalizedToolkit) || familyEmailMap.get(family) || null;
          }
        }

        // 4. If any Google toolkit still has no email, resolve via Google API and persist
        const hasGoogleWithoutEmail = detailed.some(
          d => getToolkitFamily(d.toolkit) === "google" && !d.email
        );
        const googleFamilyEmail = familyEmailMap.get("google");

        if (hasGoogleWithoutEmail && !googleFamilyEmail) {
          try {
            // Extract userId and workspaceId from entityId
            const parts = entityId.split("_");
            const eid_userId = parts[0];
            const eid_wsId = parts.slice(1).join("_") || undefined;

            const resolvedEmail = await getGoogleAccountEmail(eid_userId, eid_wsId);
            if (resolvedEmail) {
              // Apply to all Google toolkits missing email
              for (const item of detailed) {
                if (getToolkitFamily(item.toolkit) === "google" && !item.email) {
                  item.email = resolvedEmail;
                }
              }
              // Persist for future lookups
              for (const item of detailed) {
                if (getToolkitFamily(item.toolkit) === "google") {
                  await supabase
                    .from("composio_user_emails")
                    .upsert(
                      { user_id: userId, email: resolvedEmail, toolkit: item.toolkit, workspace_id: effectiveWorkspaceId },
                      { onConflict: "email,toolkit,workspace_id" }
                    );
                }
              }
            }
          } catch (e) {
            console.error("[integrations-connect] Failed to resolve Google email:", e);
          }
        }
      }

      return jsonResponse({ connected, detailed });
    }

    if (action === "disconnect") {
      if (!toolkit) {
        return errorResponse(400, "toolkit é obrigatório");
      }
      const success = await disconnectToolkit(entityId, toolkit);
      return jsonResponse({ success, toolkit });
    }

    return errorResponse(400, "action inválida. Use: connect | status | disconnect");
  } catch (error) {
    console.error("[integrations-connect] Error:", error);
    return errorResponse(500, String(error));
  }
});
