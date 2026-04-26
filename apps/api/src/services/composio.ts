import { Composio } from "@composio/core";
import { env } from "../config/env.js";

// Composio is the upstream OAuth/action provider. We don't store its OAuth
// tokens — Composio holds them server-side. We only persist the (workspace_id,
// user_id, toolkit, composio_entity_id) tuple in `composio_connections` for
// our own FK joins and audit needs.
//
// entityId convention: `${workspaceId}_${userDbId}`. Workspace scope can be
// added later by dropping the userDbId — see `composio_connections.scope`.

const REST_BASE = "https://backend.composio.dev/api/v1";

let cached: Composio | null = null;

export function isComposioConfigured(): boolean {
  return Boolean(env.COMPOSIO_API_KEY);
}

function getClient(): Composio {
  if (!env.COMPOSIO_API_KEY) {
    throw new Error("COMPOSIO_API_KEY is not configured");
  }
  cached ??= new Composio({ apiKey: env.COMPOSIO_API_KEY });
  return cached;
}

export function entityIdFor(workspaceId: string, userDbId: string): string {
  return `${workspaceId}_${userDbId}`;
}

/** Lowercase, strip whitespace and underscores, e.g. "google_drive" → "googledrive" */
export function normalizeToolkitSlug(value: string): string {
  return value.toLowerCase().replace(/\s/g, "").replace(/_/g, "");
}

export interface InitiateResult {
  redirectUrl: string;
  connectionId: string | null;
}

export async function initiateConnection(
  entityId: string,
  toolkit: string,
): Promise<InitiateResult> {
  const c = getClient();
  // toolkits.authorize() auto-creates an auth config if one doesn't exist
  // and initiates a connection request. authConfigId can be passed explicitly
  // later if we need per-toolkit overrides.
  const req = await c.toolkits.authorize(entityId, toolkit);
  const reqAny = req as unknown as { redirectUrl?: string; id?: string };
  if (!reqAny.redirectUrl) {
    throw new Error(`Composio authorize returned no redirect URL for ${toolkit}`);
  }
  return { redirectUrl: reqAny.redirectUrl, connectionId: reqAny.id ?? null };
}

export interface ConnectedToolkit {
  toolkit: string;
  status: string;
  connectionId: string;
  email: string | null;
  connectedAt: string | null;
}

export async function listConnectedToolkits(entityId: string): Promise<ConnectedToolkit[]> {
  if (!env.COMPOSIO_API_KEY) return [];
  const url = `${REST_BASE}/connectedAccounts?user_uuid=${encodeURIComponent(entityId)}&status=ACTIVE`;
  const res = await fetch(url, {
    headers: { "x-api-key": env.COMPOSIO_API_KEY, "Content-Type": "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: Array<Record<string, unknown>> };
  return (data.items ?? []).map((item) => {
    const raw = (item.appName ?? item.appSlug ?? item.slug ?? "") as string;
    const cp = (item.connectionParams ?? {}) as Record<string, unknown>;
    const meta = (item.metadata ?? {}) as Record<string, unknown>;
    return {
      toolkit: normalizeToolkitSlug(raw),
      status: typeof item.status === "string" ? item.status : "ACTIVE",
      connectionId: String(item.id ?? ""),
      email:
        (cp.user_email as string | undefined) ??
        (cp.email as string | undefined) ??
        (cp.userName as string | undefined) ??
        (meta.email as string | undefined) ??
        null,
      connectedAt:
        (item.createdAt as string | undefined) ??
        (item.connectedAt as string | undefined) ??
        (item.updatedAt as string | undefined) ??
        null,
    };
  });
}

export async function disconnectToolkit(entityId: string, toolkit: string): Promise<number> {
  if (!env.COMPOSIO_API_KEY) return 0;
  const listUrl = `${REST_BASE}/connectedAccounts?user_uuid=${encodeURIComponent(
    entityId,
  )}&appName=${encodeURIComponent(toolkit)}&status=ACTIVE`;
  const res = await fetch(listUrl, {
    headers: { "x-api-key": env.COMPOSIO_API_KEY, "Content-Type": "application/json" },
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as { items?: Array<{ id?: string }> };
  const items = data.items ?? [];
  let removed = 0;
  for (const item of items) {
    if (!item.id) continue;
    const del = await fetch(`${REST_BASE}/connectedAccounts/${item.id}`, {
      method: "DELETE",
      headers: { "x-api-key": env.COMPOSIO_API_KEY, "Content-Type": "application/json" },
    });
    if (del.ok) removed++;
  }
  return removed;
}

export async function executeAction(
  entityId: string,
  action: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const c = getClient();
  // Composio SDK >=0.6 throws `ComposioToolVersionRequiredError` ("Toolkit
  // version not specified") when an action is called without an explicit
  // `version` because their default is `"latest"`. We pass the skip flag —
  // the alternative would be pinning per-toolkit versions (e.g.
  // `version: "20250909_00"`) which becomes its own ongoing maintenance
  // burden. Revisit if/when we want pinned-version reproducibility in prod.
  return c.tools.execute(action, {
    userId: entityId,
    arguments: args,
    dangerouslySkipVersionCheck: true,
  });
}
