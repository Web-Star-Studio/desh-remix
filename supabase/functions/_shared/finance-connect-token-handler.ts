import { corsHeaders, jsonResponse, errorResponse } from "./utils.ts";
import { getPluggyApiKey, buildServiceClient } from "./pluggy-utils.ts";

/**
 * Generate a Pluggy Connect Token for the widget.
 * Optionally receives `itemId` to update an existing connection.
 * Passes oauthRedirectUri and clientUserId per Pluggy docs.
 */
export async function handleGetConnectToken(req: Request, params: Record<string, any>) {
  const supabase = buildServiceClient();

  // Resolve user from auth header
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return errorResponse(401, "Unauthorized");

  try {
    const apiKey = await getPluggyApiKey();

    // Build connect token request body per Pluggy API docs
    const body: Record<string, any> = {
      options: {
        clientUserId: user.id,
      },
    };

    // Determine OAuth redirect URI from the request origin or fallback
    const origin = req.headers.get("Origin") || req.headers.get("Referer");
    if (origin) {
      try {
        const url = new URL(origin);
        const redirectUri = `${url.protocol}//${url.host}/finances`;
        // Only set if it's HTTPS (Pluggy requirement)
        if (url.protocol === "https:") {
          body.options.oauthRedirectUri = redirectUri;
        }
      } catch {
        // Invalid origin, skip oauthRedirectUri
      }
    }

    if (params.itemId) {
      // Verify the item still exists at Pluggy before passing updateItem
      const checkRes = await fetch(`https://api.pluggy.ai/items/${params.itemId}`, {
        headers: { "X-API-KEY": apiKey },
      });
      if (!checkRes.ok) {
        await checkRes.text(); // consume body
        return jsonResponse({ error: "ITEM_NOT_FOUND" });
      }
      await checkRes.text(); // consume body
      body.itemId = params.itemId;
    }

    const res = await fetch("https://api.pluggy.ai/connect_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Pluggy connect_token error:", errBody);
      return errorResponse(res.status, `Pluggy connect_token failed: ${errBody}`);
    }

    const data = await res.json();
    return jsonResponse({
      provider: "pluggy",
      token: data.accessToken,
    });
  } catch (err: any) {
    console.error("Connect token error:", err);
    return errorResponse(500, err.message || "Failed to generate connect token");
  }
}
