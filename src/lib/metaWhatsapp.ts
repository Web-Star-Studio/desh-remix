// ─── Meta WhatsApp Business Cloud API — Config & HTTP Helpers ────────────────
// Pure TypeScript — no Supabase imports. Safe to use in edge functions too.

export const META_GRAPH_VERSION = "v20.0";
export const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetaRequestOptions {
  /** Phone Number ID registered in Meta dashboard */
  phoneNumberId?: string;
  /** Bearer token — comes from whatsapp_connections.meta_access_token */
  accessToken: string;
  /** Sub-path after /{phoneNumberId}, e.g. "/messages" */
  path?: string;
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  /** Query string params for GET requests */
  params?: Record<string, string>;
  /** Request body for POST/PATCH */
  body?: unknown;
}

export interface MetaApiError {
  message: string;
  code: number;
  type: string;
  fbtrace_id?: string;
}

export interface MetaSendResult {
  messaging_product: "whatsapp";
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface MetaPhoneInfo {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  platform_type: string;
  throughput: { level: string };
}

export interface MetaTemplateComponent {
  type: string;
  parameters?: Array<{ type: string; text?: string }>;
}

export interface MetaTemplate {
  name: string;
  language: { code: string };
  components?: MetaTemplateComponent[];
}

// ─── URL Builder ──────────────────────────────────────────────────────────────

/**
 * Returns the Meta Graph API base URL, optionally scoped to a phone number ID.
 * e.g. metaBaseUrl("123456") → "https://graph.facebook.com/v20.0/123456"
 */
export function metaBaseUrl(phoneNumberId?: string): string {
  return phoneNumberId
    ? `${META_BASE_URL}/${phoneNumberId}`
    : META_BASE_URL;
}

// ─── Core HTTP Helper ─────────────────────────────────────────────────────────

/**
 * Generic authenticated fetch wrapper for the Meta Graph API.
 * Uses the connection's metaAccessToken as Bearer — NOT the app secret.
 * Throws a structured error on non-2xx responses.
 */
export async function metaRequest<T>(opts: MetaRequestOptions): Promise<T> {
  const { phoneNumberId, accessToken, path = "", method = "GET", params, body } = opts;

  const base = metaBaseUrl(phoneNumberId);
  const url = new URL(`${base}${path}`);

  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await res.json() as Record<string, unknown>;

  if (!res.ok) {
    const err = (json.error ?? { message: res.statusText, code: res.status, type: "unknown" }) as MetaApiError;
    throw Object.assign(new Error(err.message), { code: err.code, type: err.type, fbtrace_id: err.fbtrace_id });
  }

  return json as T;
}

// ─── Convenience Functions ────────────────────────────────────────────────────

/**
 * Send a plain text message via WhatsApp Cloud API.
 * POST /{phoneNumberId}/messages
 */
export async function sendTextMessage(
  phoneNumberId: string,
  to: string,
  text: string,
  accessToken: string,
): Promise<MetaSendResult> {
  return metaRequest<MetaSendResult>({
    phoneNumberId,
    accessToken,
    path: "/messages",
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    },
  });
}

/**
 * Send a template message via WhatsApp Cloud API.
 * POST /{phoneNumberId}/messages
 */
export async function sendTemplateMessage(
  phoneNumberId: string,
  to: string,
  template: MetaTemplate,
  accessToken: string,
): Promise<MetaSendResult> {
  return metaRequest<MetaSendResult>({
    phoneNumberId,
    accessToken,
    path: "/messages",
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template,
    },
  });
}

/**
 * Retrieve phone number info to verify a connection is valid.
 * GET /{phoneNumberId}
 */
export async function getPhoneNumberInfo(
  phoneNumberId: string,
  accessToken: string,
): Promise<MetaPhoneInfo> {
  return metaRequest<MetaPhoneInfo>({
    phoneNumberId,
    accessToken,
    method: "GET",
    params: {
      fields: "id,display_phone_number,verified_name,quality_rating,platform_type,throughput",
    },
  });
}

/**
 * Mark an inbound message as read.
 * POST /{phoneNumberId}/messages  { status: "read" }
 */
export async function markMessageAsRead(
  phoneNumberId: string,
  messageId: string,
  accessToken: string,
): Promise<void> {
  await metaRequest<Record<string, unknown>>({
    phoneNumberId,
    accessToken,
    path: "/messages",
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    },
  });
}
