/**
 * Shared MCP/Composio helpers for Pandora
 * Used by pandora-mcp and pandora-whatsapp
 */

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";

let cachedServerId: string | null = null;

/**
 * Create or retrieve the shared MCP server config for DESH Pandora.
 */
export async function getOrCreateMcpServer(composioApiKey: string): Promise<string> {
  if (cachedServerId) return cachedServerId;

  // Try to find existing server
  try {
    const listResp = await fetch(`${COMPOSIO_BASE}/mcp/servers?limit=50`, {
      headers: { "x-api-key": composioApiKey },
    });

    if (listResp.ok) {
      const listData = await listResp.json();
      const items = listData.items || listData.data || [];
      const existing = items.find((s: any) => s.name === "desh-pandora");
      if (existing?.id) {
        cachedServerId = existing.id;
        console.log("[mcp-composio] Found existing server:", existing.id);
        return existing.id;
      }
    }
  } catch (e) {
    console.warn("[mcp-composio] List servers failed:", e);
  }

  // Fetch auth configs to get IDs
  let authConfigIds: string[] = [];
  try {
    const authResp = await fetch(`${COMPOSIO_BASE.replace('/v3', '/v1')}/auth-configs?limit=50`, {
      headers: { "x-api-key": composioApiKey },
    });
    if (authResp.ok) {
      const authData = await authResp.json();
      const items = authData.items || authData.data || authData || [];
      authConfigIds = (Array.isArray(items) ? items : []).map((c: any) => c.id).filter(Boolean);
    }
  } catch (e) {
    console.warn("[mcp-composio] Failed to fetch auth configs:", e);
  }

  // Create server
  const createResp = await fetch(`${COMPOSIO_BASE}/mcp/servers/custom`, {
    method: "POST",
    headers: { "x-api-key": composioApiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "desh-pandora",
      toolkits: ["gmail", "googlecalendar", "googletasks", "googledrive"],
      ...(authConfigIds.length > 0 ? { auth_config_ids: authConfigIds } : {}),
    }),
  });

  if (!createResp.ok) {
    const errText = await createResp.text();
    console.error("[mcp-composio] Create MCP server failed:", createResp.status, errText);
    throw new Error(`Failed to create MCP server: ${createResp.status} - ${errText}`);
  }

  const created = await createResp.json();
  cachedServerId = created.id;
  console.log("[mcp-composio] Created MCP server:", created.id);
  return created.id;
}

/**
 * Get or create per-user MCP instance URL.
 */
export async function getMcpUrl(entityId: string, serverId: string, composioApiKey: string): Promise<string> {
  // Try to create instance (may already exist)
  const resp = await fetch(`${COMPOSIO_BASE}/mcp/servers/${serverId}/instances`, {
    method: "POST",
    headers: { "x-api-key": composioApiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: entityId }),
  });

  if (resp.ok) {
    const data = await resp.json();
    if (data.mcp_url) return data.mcp_url;
    if (data.url) return data.url;
  } else {
    const errText = await resp.text();
    if (!errText.includes("InstanceAlreadyExists")) {
      console.error("[mcp-composio] Create instance error:", resp.status, errText);
    }
  }

  // Construct URL from documented pattern
  return `https://mcp.composio.dev/composio/server/${serverId}?user_id=${entityId}&transport=sse`;
}
