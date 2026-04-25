import { Composio } from 'npm:@composio/core@0.6.10'
import { createClient } from 'npm:@supabase/supabase-js@2.95.3'

let _composio: InstanceType<typeof Composio> | null = null;
let _apiKey: string | null = null;

function getApiKey(): string {
  if (!_apiKey) {
    _apiKey = Deno.env.get('COMPOSIO_API_KEY') || null;
    if (!_apiKey) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }
  }
  return _apiKey;
}

function getComposio() {
  if (!_composio) {
    _composio = new Composio({ apiKey: getApiKey() });
  }
  return _composio;
}

// Keep backward-compatible reference
const composio = new Proxy({} as InstanceType<typeof Composio>, {
  get(_target, prop) {
    return (getComposio() as any)[prop];
  },
});

/**
 * Resolve workspace ID for Composio entityId construction.
 * If workspaceId is provided and not 'all', use it directly.
 * Otherwise, query the user's default workspace.
 */
export async function resolveWorkspaceId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  workspaceId?: string | null,
): Promise<string> {
  if (workspaceId && workspaceId !== 'all' && workspaceId !== 'default') {
    return workspaceId
  }
  const { data } = await supabase
    .from('workspaces')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single()
  return data?.id || 'default'
}

/** Build composite entityId from userId + workspaceId */
function buildEntityId(userId: string, workspaceId?: string): string {
  if (workspaceId && workspaceId !== 'default') {
    return `${userId}_${workspaceId}`
  }
  return userId
}

function parseJsonSafely(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeToolkitSlug(toolkit: string | null | undefined): string {
  const slug = String(toolkit || '').toLowerCase().replace(/\s/g, '').replace(/_/g, '')

  const aliases: Record<string, string> = {
    googlecalendar: 'googlecalendar',
    googcalendar: 'googlecalendar',
    googlecal: 'googlecalendar',
    google_calendar: 'googlecalendar',
    googlemeet: 'googlemeet',
    google_meet: 'googlemeet',
    googletasks: 'googletasks',
    google_tasks: 'googletasks',
    googledrive: 'googledrive',
    google_drive: 'googledrive',
    googledocs: 'googledocs',
    google_docs: 'googledocs',
    googlesheets: 'googlesheets',
    google_sheets: 'googlesheets',
    googlephotos: 'googlephotos',
    google_photos: 'googlephotos',
  }

  return aliases[slug] || slug
}

function getToolkitFamily(toolkit: string | null | undefined): string {
  const slug = normalizeToolkitSlug(toolkit)
  if (slug === 'gmail' || slug === 'youtube' || slug.startsWith('google')) return 'google'
  if (slug === 'outlook' || slug === 'onedrive' || slug === 'teams') return 'microsoft'
  return slug
}

function getHeaderBearerToken(headers: any[] | undefined): string | null {
  if (!Array.isArray(headers)) return null
  const authHeader = headers.find((header: any) =>
    String(header?.name || '').toLowerCase() === 'authorization'
  )

  const value = authHeader?.value
  if (typeof value !== 'string') return null

  return value.replace(/^Bearer\s+/i, '') || null
}

function extractAccessToken(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null

  return (
    payload.access_token ||
    payload.accessToken ||
    payload.connectionParams?.access_token ||
    payload.connectionParams?.accessToken ||
    payload.data?.access_token ||
    payload.data?.accessToken ||
    payload.data?.connectionParams?.access_token ||
    payload.data?.connectionParams?.accessToken ||
    getHeaderBearerToken(payload.headers) ||
    getHeaderBearerToken(payload.data?.headers) ||
    null
  )
}

async function getConnectedAccount(userId: string, toolkit: string, workspaceId?: string): Promise<any | null> {
  const entityId = buildEntityId(userId, workspaceId)
  const listUrl = `https://backend.composio.dev/api/v1/connectedAccounts?user_uuid=${entityId}&appName=${toolkit}&status=ACTIVE&limit=1`

  const listRes = await fetch(listUrl, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
    },
  })

  const listText = await listRes.text()
  if (!listRes.ok) {
    console.error(`[Composio] List accounts failed: ${listRes.status}`, listText.substring(0, 300))
    return null
  }

  const listData = parseJsonSafely(listText)
  return listData?.items?.[0] || null
}

async function getConnectedAccountV3(userId: string, toolkit: string, workspaceId?: string): Promise<any | null> {
  const entityId = buildEntityId(userId, workspaceId)
  const listUrl = `https://backend.composio.dev/api/v3/connected_accounts?user_id=${entityId}`

  const listRes = await fetch(listUrl, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
    },
  })

  const listText = await listRes.text()
  if (!listRes.ok) {
    console.error(`[Composio] List v3 accounts failed: ${listRes.status}`, listText.substring(0, 300))
    return null
  }

  const listData = parseJsonSafely(listText)
  const items = Array.isArray(listData?.items) ? listData.items : []
  const toolkitSlug = toolkit.toLowerCase()
  const toolkitAccounts = items.filter((item: any) => String(item?.toolkit?.slug || item?.appName || '').toLowerCase() === toolkitSlug)

  const account =
    toolkitAccounts.find((item: any) => String(item?.status || item?.data?.status || '').toUpperCase() === 'ACTIVE') ||
    toolkitAccounts.find((item: any) => ['INITIATED', 'CONNECTED'].includes(String(item?.status || item?.data?.status || '').toUpperCase())) ||
    toolkitAccounts[0] ||
    null

  return account
}

async function getConnectedAccountDetails(accountId: string): Promise<any | null> {
  const detailsUrl = `https://backend.composio.dev/api/v3/connected_accounts/${accountId}`

  const detailsRes = await fetch(detailsUrl, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
    },
  })

  const detailsText = await detailsRes.text()

  if (!detailsRes.ok) {
    console.error(`[Composio] connected_account details failed: ${detailsRes.status}`, detailsText.substring(0, 300))
    return null
  }

  return parseJsonSafely(detailsText)
}

export async function getOrCreateSession(userId: string, authConfigs?: Record<string, string>) {
  const session = await composio.create(userId, {
    authConfigs,
    manageConnections: false,
  })
  return session
}

export async function initiateConnection(
  entityId: string,
  toolkit: string,
  authConfigId?: string
): Promise<string> {
  const authConfigs = authConfigId ? { [toolkit]: authConfigId } : undefined
  const session = await getOrCreateSession(entityId, authConfigs)

  const connectionRequest = await session.authorize(toolkit)
  return connectionRequest.redirectUrl
}

export interface ConnectedToolkitInfo {
  toolkit: string;
  email: string | null;
  connectedAt: string | null;
}

export async function getConnectedToolkits(entityId: string): Promise<string[]> {
  const detailed = await getConnectedToolkitsDetailed(entityId);
  return detailed.map(d => d.toolkit);
}

export async function getConnectedToolkitsDetailed(entityId: string): Promise<ConnectedToolkitInfo[]> {
  try {
    const url = `https://backend.composio.dev/api/v1/connectedAccounts?user_uuid=${entityId}&status=ACTIVE`
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
      },
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`[Composio] getConnectedToolkitsDetailed failed: ${res.status}`, text.substring(0, 300))
      return []
    }
    const data = JSON.parse(text)
    const items = data.items || [];

    // For each account, try to extract email from list data first,
    // then fetch individual details if needed
    const results: ConnectedToolkitInfo[] = [];

    for (const a of items) {
      const toolkit = normalizeToolkitSlug(a.appName || a.appSlug || a.slug)
      if (!toolkit) continue;

      let email =
        a.connectionParams?.user_email ||
        a.connectionParams?.userName ||
        a.connectionParams?.email ||
        a.metadata?.email ||
        null;

      const connectedAt = a.createdAt || a.created_at || a.connectedAt || a.updatedAt || null;

      if (!email && a.id) {
        try {
          const detailUrl = `https://backend.composio.dev/api/v1/connectedAccounts/${a.id}`
          const detailRes = await fetch(detailUrl, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': getApiKey(),
            },
          })
          if (detailRes.ok) {
            const detail = await detailRes.json()
            email =
              detail.connectionParams?.user_email ||
              detail.connectionParams?.userName ||
              detail.connectionParams?.email ||
              detail.metadata?.email ||
              null;
          }
        } catch (e) {
          console.error(`[Composio] Failed to fetch detail for ${toolkit}:`, e)
        }
      }

      results.push({ toolkit, email, connectedAt });
    }

    return results;
  } catch (err) {
    console.error('[Composio] getConnectedToolkitsDetailed error:', err)
    return []
  }
}

export async function refreshComposioConnection(
  userId: string,
  toolkit: string,
  workspaceId?: string,
): Promise<{ accessToken: string | null; redirectUrl: string | null }> {
  try {
    const accountV3 = await getConnectedAccountV3(userId, toolkit, workspaceId)
    if (!accountV3?.id) {
      return { accessToken: null, redirectUrl: null }
    }

    const refreshUrl = `https://backend.composio.dev/api/v3/connected_accounts/${accountV3.id}/refresh`

    const refreshRes = await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
      },
      body: JSON.stringify({ validate_credentials: false }),
    })

    const refreshText = await refreshRes.text()

    if (!refreshRes.ok) {
      console.error(`[Composio] refresh failed: ${refreshRes.status}`, refreshText.substring(0, 300))
      return { accessToken: null, redirectUrl: null }
    }

    const refreshData = parseJsonSafely(refreshText)
    const redirectUrl = refreshData?.redirect_url || refreshData?.redirectUrl || null
    if (redirectUrl) {
      console.warn(`[Composio] Refresh requires re-authentication for ${toolkit}`)
      return { accessToken: null, redirectUrl }
    }

    const refreshedDetails = await getConnectedAccountDetails(accountV3.id)
    const accessToken =
      extractAccessToken(refreshedDetails) ||
      extractAccessToken(refreshData) ||
      extractAccessToken(accountV3)

    return { accessToken, redirectUrl: null }
  } catch (err) {
    console.error('[Composio] refreshComposioConnection error:', err)
    return { accessToken: null, redirectUrl: null }
  }
}

export async function getComposioAccessToken(
  userId: string,
  toolkit: string,
  workspaceId?: string,
): Promise<string | null> {
  try {
    const accountV3 = await getConnectedAccountV3(userId, toolkit, workspaceId)
    const tokenV3 = extractAccessToken(accountV3)

    if (tokenV3) {
      return tokenV3
    }

    const account = await getConnectedAccount(userId, toolkit, workspaceId)
    if (!account) {
      return null
    }

    const token = extractAccessToken(account)

    if (!token) {
      console.error(`[Composio] No token found in connected account payload for ${toolkit}`)
    }

    return token
  } catch (err) {
    console.error('[Composio] getComposioAccessToken error:', err)
    return null
  }
}

export async function getGoogleAccountEmail(
  userId: string,
  workspaceId?: string,
): Promise<string | null> {
  const googleToolkits = [
    'gmail',
    'googledrive',
    'googlecalendar',
    'googletasks',
    'googlecontacts',
    'googledocs',
    'googlesheets',
    'googlephotos',
    'googlemeet',
    'youtube',
  ]

  const profileUrls = [
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    'https://openidconnect.googleapis.com/v1/userinfo',
    'https://www.googleapis.com/oauth2/v2/userinfo',
  ]

  for (const toolkit of googleToolkits) {
    const token = await getComposioAccessToken(userId, toolkit, workspaceId)
    if (!token) continue

    for (const url of profileUrls) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) continue

        const data = await res.json()
        const email = data?.emailAddress || data?.email || null
        if (email) return String(email).toLowerCase()
      } catch (err) {
        console.error(`[Composio] Failed to resolve Google account email via ${url}:`, err)
      }
    }
  }

  return null
}

export async function getMcpUrl(userId: string, authConfigs?: Record<string, string>): Promise<string> {
  const session = await getOrCreateSession(userId, authConfigs)
  return session.mcp.url
}

export async function disconnectToolkit(entityId: string, toolkit: string): Promise<boolean> {
  try {
    // Find connected accounts for this entity + toolkit
    const url = `https://backend.composio.dev/api/v1/connectedAccounts?user_uuid=${entityId}&appName=${toolkit}&status=ACTIVE`
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
      },
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`[Composio] disconnect list failed: ${res.status}`, text.substring(0, 300))
      return false
    }
    const data = parseJsonSafely(text)
    const items = data?.items || []

    // Delete each connected account
    for (const item of items) {
      const accountId = item.id
      if (!accountId) continue
      const delRes = await fetch(`https://backend.composio.dev/api/v1/connectedAccounts/${accountId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': getApiKey(),
        },
      })
      if (!delRes.ok) {
        console.error(`[Composio] delete account ${accountId} failed: ${delRes.status}`)
      } else {
      }
    }
    return items.length > 0
  } catch (err) {
    console.error('[Composio] disconnectToolkit error:', err)
    return false
  }
}

export { composio }
