import { env } from "../config/env.js";

/**
 * Composio MCP wiring.
 *
 * Two-tier model:
 *   - GLOBAL: one custom MCP server registered with Composio that bundles
 *     every toolkit Pandora can use (gmail, calendar, drive, etc.). One-shot
 *     per deployment — `serverId` cached in env (`COMPOSIO_MCP_SERVER_ID`).
 *   - PER-WORKSPACE: each workspace mints an *instance URL* against that
 *     shared server, scoped to the workspace's entityId. URL is what gets
 *     registered with the workspace's Hermes profile via `hermes mcp add`.
 *
 * Composio's docs confirm `user_id` (== our entityId) is the canonical
 * tenant boundary. Tools, auth, and execution are isolated per-user.
 *
 * Endpoints used (REST, x-api-key header):
 *   POST /api/v3/mcp/servers/custom    — create the global server
 *   POST /api/v3/mcp/servers/{id}/instances  — mint per-entity instance URL
 *   GET  /api/v3/mcp/servers/{id}      — sanity check (idempotent reads)
 */

const COMPOSIO_API_BASE = "https://backend.composio.dev/api/v3";

const SERVER_NAME = "desh-pandora";

let cachedServerId: string | null = null;

export function isMcpConfigured(): boolean {
  return Boolean(env.COMPOSIO_API_KEY);
}

function authHeaders(): Record<string, string> {
  if (!env.COMPOSIO_API_KEY) {
    throw new Error("composio-mcp: COMPOSIO_API_KEY not configured");
  }
  return {
    "Content-Type": "application/json",
    "x-api-key": env.COMPOSIO_API_KEY,
  };
}

function toolkitList(): string[] {
  return env.COMPOSIO_MCP_TOOLKITS.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the global custom MCP server's id. Creates the server on first call
 * (per process) if env var isn't set or sanity-check fails. Cache-only — no
 * persistence beyond the env var the operator copies into .env after boot.
 */
export async function ensureCustomMcpServer(): Promise<string> {
  if (cachedServerId) return cachedServerId;

  // If env has a serverId, trust it. (Sanity-check could call GET to verify,
  // but Composio's API charges for it — accept fail-on-first-mint instead.)
  if (env.COMPOSIO_MCP_SERVER_ID) {
    cachedServerId = env.COMPOSIO_MCP_SERVER_ID;
    return cachedServerId;
  }

  // Create a new custom server with the configured toolkit list.
  const res = await fetch(`${COMPOSIO_API_BASE}/mcp/servers/custom`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      name: SERVER_NAME,
      toolkits: toolkitList(),
      // Keep `manage_connections: false` — connections are managed via our
      // own /composio-connections routes; the MCP server just exposes tools.
      manage_connections: false,
    }),
  });

  if (res.ok) {
    const data = (await res.json()) as { id?: string; server_id?: string };
    const id = data.id ?? data.server_id;
    if (!id) {
      throw new Error(
        `composio-mcp: server creation succeeded but response had no id: ${JSON.stringify(data).slice(0, 300)}`,
      );
    }
    cachedServerId = id;
    // eslint-disable-next-line no-console
    console.log(
      `[composio-mcp] custom MCP server created — copy into apps/api/.env to skip recreation:\n  COMPOSIO_MCP_SERVER_ID=${id}`,
    );
    return id;
  }

  // Self-heal the common dev case: the server was created by a previous run
  // but COMPOSIO_MCP_SERVER_ID was never copied into .env. Composio returns
  // 400 with code MCP_DuplicateServerName — recover by looking up the
  // existing server by name.
  const errBody = await res.text().catch(() => "");
  const isDuplicate =
    res.status === 400 &&
    /MCP_DuplicateServerName|already exists/i.test(errBody);
  if (!isDuplicate) {
    throw new Error(
      `composio-mcp: failed to create custom MCP server (${res.status}): ${errBody.slice(0, 300)}`,
    );
  }

  const found = await findServerByName(SERVER_NAME);
  if (!found) {
    throw new Error(
      `composio-mcp: server "${SERVER_NAME}" reported as duplicate but lookup returned nothing. Body: ${errBody.slice(0, 300)}`,
    );
  }
  cachedServerId = found;
  // eslint-disable-next-line no-console
  console.log(
    `[composio-mcp] reused existing MCP server — set this in apps/api/.env to skip the lookup:\n  COMPOSIO_MCP_SERVER_ID=${found}`,
  );
  return found;
}

/**
 * GET the list of MCP servers and find the one matching `name`. Used as a
 * recovery path when create returns 400 MCP_DuplicateServerName.
 *
 * Composio's list endpoint may paginate; we scan up to a few pages so a
 * project with many servers still resolves.
 */
async function findServerByName(name: string): Promise<string | null> {
  const limit = 50;
  for (let page = 1; page <= 5; page++) {
    const url = `${COMPOSIO_API_BASE}/mcp/servers?limit=${limit}&page=${page}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `composio-mcp: list servers failed (${res.status}): ${body.slice(0, 300)}`,
      );
    }
    const data = (await res.json()) as {
      items?: Array<{ id?: string; server_id?: string; name?: string }>;
      data?: Array<{ id?: string; server_id?: string; name?: string }>;
    };
    const items = data.items ?? data.data ?? [];
    const match = items.find((s) => s.name === name);
    if (match) return match.id ?? match.server_id ?? null;
    if (items.length < limit) return null;
  }
  return null;
}

/**
 * Mints a per-entity instance URL for the workspace's Hermes profile to
 * register via `hermes mcp add`. Composio dedupes by `user_id` — calling
 * twice with the same entityId returns the same URL.
 *
 * Returns null if Composio isn't configured (the gateway still works, just
 * without Composio tools).
 */
export async function mintInstanceUrlForEntity(entityId: string): Promise<string | null> {
  if (!isMcpConfigured()) return null;

  const serverId = await ensureCustomMcpServer();

  const res = await fetch(`${COMPOSIO_API_BASE}/mcp/servers/${encodeURIComponent(serverId)}/instances`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ user_id: entityId }),
  });

  // The current per-entity MCP URL pattern (Composio docs as of 2026):
  //   https://backend.composio.dev/v3/mcp/<serverId>?user_id=<entity>
  // Composio's gateway 307-redirects to the proper SSE endpoint based on the
  // client's `Accept: text/event-stream` header — no transport= flag needed.
  // The older `mcp.composio.dev/composio/server/...` form is deprecated and
  // now redirects to a marketing page, breaking the MCP handshake.
  const deterministicUrl = `https://backend.composio.dev/v3/mcp/${encodeURIComponent(serverId)}?user_id=${encodeURIComponent(entityId)}`;

  if (res.ok) {
    const data = (await res.json()) as {
      mcp_url?: string;
      url?: string;
      instance_url?: string;
    };
    return data.mcp_url ?? data.url ?? data.instance_url ?? deterministicUrl;
  }

  // 400 MCP_InstanceAlreadyExists: an instance for this user_id was already
  // provisioned (likely by a prior workspace creation that crashed before
  // hermes mcp add). Composio dedupes by user_id, so the deterministic URL
  // resolves to the same instance — safe to use directly.
  const body = await res.text().catch(() => "");
  if (res.status === 400 && /MCP_InstanceAlreadyExists|already exists/i.test(body)) {
    return deterministicUrl;
  }

  throw new Error(
    `composio-mcp: failed to mint instance URL for ${entityId} (${res.status}): ${body.slice(0, 300)}`,
  );
}
