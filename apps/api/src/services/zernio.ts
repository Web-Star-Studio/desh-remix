import { env } from "../config/env.js";

// Zernio is the upstream multi-platform social + WhatsApp Business provider
// (formerly proxied via the `late-proxy` Supabase edge function). All calls
// authenticate with a single shared `ZERNIO_API_KEY`; tenancy across our
// workspaces is enforced by passing the workspace's `zernio_profile_id` into
// the agent's SOUL.md so Pandora always scopes its calls. See
// TODO(zernio-tenancy) — a Desh-side MCP shim would make the boundary hard.

export class ZernioApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(opts: { message: string; code: string; status?: number; retryable?: boolean; details?: unknown }) {
    super(opts.message);
    this.name = "ZernioApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
    this.details = opts.details;
  }
}

const RETRYABLE_CODES = new Set([
  "rate_limited",
  "upstream_unavailable",
  "timeout",
  "network_error",
  "transport_error",
]);

export function isZernioConfigured(): boolean {
  return Boolean(env.ZERNIO_API_KEY);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  /** Per-attempt timeout. Default 15s — matches the legacy whatsappMessenger. */
  timeoutMs?: number;
  /** Retries on top of the initial attempt. Reads default 3, mutations default 1. */
  maxRetries?: number;
}

/** Compute exponential-backoff delay (base 400ms, factor 2, ±25% jitter, cap 6s). */
function computeBackoff(attempt: number): number {
  const base = 400;
  const exp = Math.min(base * Math.pow(2, attempt), 6_000);
  const jitter = exp * 0.25 * (Math.random() * 2 - 1);
  return Math.round(exp + jitter);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = env.ZERNIO_API_BASE.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const u = new URL(base + cleanPath);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue;
      u.searchParams.set(k, String(v));
    }
  }
  return u.toString();
}

function classify(status: number, payload: unknown): ZernioApiError {
  let message = `Zernio request failed (${status})`;
  let code: string;
  if (status === 429) code = "rate_limited";
  else if (status === 408 || status === 504) code = "timeout";
  else if (status === 401) code = "unauthorized";
  else if (status === 403) code = "forbidden";
  else if (status === 404) code = "not_found";
  else if (status >= 500) code = "upstream_unavailable";
  else if (status === 422 || status === 400) code = "validation_error";
  else code = "api_error";

  const p = payload as { error?: string; message?: string; code?: string } | null | undefined;
  if (p) {
    if (typeof p.message === "string") message = p.message;
    else if (typeof p.error === "string") message = p.error;
    if (typeof p.code === "string") code = p.code;
  }
  return new ZernioApiError({
    message,
    code,
    status,
    retryable: RETRYABLE_CODES.has(code),
    details: payload,
  });
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!env.ZERNIO_API_KEY) {
    throw new ZernioApiError({
      message: "ZERNIO_API_KEY is not configured",
      code: "not_configured",
    });
  }
  const method = opts.method ?? "GET";
  const isMutation = method !== "GET";
  const maxRetries = opts.maxRetries ?? (isMutation ? 1 : 3);
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const url = buildUrl(path, opts.query);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.ZERNIO_API_KEY}`,
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let lastError: ZernioApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await res.text();
      const data = text ? safeJson(text) : null;
      if (res.ok) return data as T;
      lastError = classify(res.status, data);
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error & { name?: string }).name === "AbortError") {
        lastError = new ZernioApiError({ message: "Zernio request timed out", code: "timeout", retryable: true });
      } else {
        lastError = new ZernioApiError({
          message: (err as Error).message ?? "network error",
          code: "network_error",
          retryable: true,
        });
      }
    }

    if (attempt >= maxRetries || !lastError.retryable) break;
    // For mutations, only retry on rate-limit / upstream-unavailable to avoid double-sends.
    if (isMutation && !["rate_limited", "upstream_unavailable"].includes(lastError.code)) break;
    await sleep(computeBackoff(attempt));
  }

  throw lastError ?? new ZernioApiError({ message: "Zernio request failed", code: "unknown" });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ── Profiles ────────────────────────────────────────────────────────────────

interface RawProfile {
  _id?: string;
  id?: string;
  name?: string;
  description?: string;
}

export interface ZernioProfile {
  profileId: string;
  name: string;
  description: string | null;
}

function asProfileId(p: RawProfile | undefined): string {
  const id = p?._id ?? p?.id;
  if (!id) throw new ZernioApiError({ message: "Zernio profile response missing _id", code: "bad_response" });
  return id;
}

export async function createProfile(input: { name: string; description?: string }): Promise<ZernioProfile> {
  const res = await request<{ profile?: RawProfile } | RawProfile>("/profiles", {
    method: "POST",
    body: { name: input.name, description: input.description },
  });
  const raw = (res as { profile?: RawProfile }).profile ?? (res as RawProfile);
  return {
    profileId: asProfileId(raw),
    name: raw.name ?? input.name,
    description: raw.description ?? null,
  };
}

export async function getProfile(profileId: string): Promise<ZernioProfile> {
  const res = await request<{ profile?: RawProfile } | RawProfile>(`/profiles/${encodeURIComponent(profileId)}`);
  const raw = (res as { profile?: RawProfile }).profile ?? (res as RawProfile);
  return {
    profileId: asProfileId(raw),
    name: raw.name ?? "",
    description: raw.description ?? null,
  };
}

export async function updateProfile(
  profileId: string,
  patch: { name?: string; description?: string },
): Promise<ZernioProfile> {
  const res = await request<{ profile?: RawProfile } | RawProfile>(
    `/profiles/${encodeURIComponent(profileId)}`,
    { method: "PATCH", body: patch },
  );
  const raw = (res as { profile?: RawProfile }).profile ?? (res as RawProfile);
  return {
    profileId: asProfileId(raw),
    name: raw.name ?? "",
    description: raw.description ?? null,
  };
}

// ── Accounts ────────────────────────────────────────────────────────────────

interface RawAccount {
  _id?: string;
  id?: string;
  accountId?: string;
  platform?: string;
  username?: string;
  avatarUrl?: string;
  status?: string;
  enabled?: boolean;
  isActive?: boolean;
  platformStatus?: string;
  metadata?: Record<string, unknown>;
}

export interface ZernioAccount {
  zernioAccountId: string;
  platform: string;
  username: string | null;
  avatarUrl: string | null;
  status: string;
  meta: Record<string, unknown>;
}

function normalizeAccount(raw: RawAccount): ZernioAccount {
  const id = raw.accountId || raw._id || raw.id;
  if (!id) {
    throw new ZernioApiError({ message: "Zernio account missing id", code: "bad_response" });
  }
  const status =
    raw.status ||
    (raw.platformStatus === "active" || raw.enabled || raw.isActive
      ? "active"
      : raw.platformStatus || "unknown");
  return {
    zernioAccountId: id,
    platform: (raw.platform ?? "unknown").toLowerCase(),
    username: raw.username ?? null,
    avatarUrl: raw.avatarUrl ?? null,
    status,
    meta: raw.metadata ?? {},
  };
}

export async function listAccounts(input: { profileId: string; platform?: string }): Promise<ZernioAccount[]> {
  const res = await request<{ accounts?: RawAccount[] } | RawAccount[]>("/accounts", {
    query: { profileId: input.profileId, platform: input.platform },
  });
  const list = Array.isArray(res) ? res : res.accounts ?? [];
  return list.map(normalizeAccount).filter((a) => Boolean(a.zernioAccountId));
}

export async function disconnectAccount(zernioAccountId: string): Promise<void> {
  await request<unknown>(`/accounts/${encodeURIComponent(zernioAccountId)}`, { method: "DELETE" });
}

// ── WhatsApp send ────────────────────────────────────────────────────────────
//
// Zernio routes WhatsApp sends through the generic `/posts` endpoint with a
// `whatsappOptions` block — same shape the legacy late-proxy submitted. The
// returned `post.platforms[0]._id` is the Zernio message id we persist on
// `whatsapp_send_logs.zernio_message_id` and that the webhook later matches on.

interface PostsResponse {
  post?: {
    _id?: string;
    platforms?: Array<{ _id?: string }>;
  };
}

function extractMessageId(res: PostsResponse): string | null {
  return res.post?.platforms?.[0]?._id ?? res.post?._id ?? null;
}

export interface SendTextInput {
  accountId: string;
  to: string;
  text: string;
}

export interface SendTemplateInput {
  accountId: string;
  to: string;
  templateName: string;
  language: string;
  variables?: Array<unknown>;
}

export interface SendResult {
  messageId: string | null;
  raw: unknown;
}

export async function sendWhatsAppText(input: SendTextInput): Promise<SendResult> {
  const res = await request<PostsResponse>("/posts", {
    method: "POST",
    body: {
      content: input.text,
      publishNow: true,
      platforms: [
        {
          platform: "whatsapp",
          accountId: input.accountId,
          whatsappOptions: { to: input.to, type: "text", text: input.text },
        },
      ],
    },
  });
  return { messageId: extractMessageId(res), raw: res };
}

export async function sendWhatsAppTemplate(input: SendTemplateInput): Promise<SendResult> {
  const res = await request<PostsResponse>("/posts", {
    method: "POST",
    body: {
      content: input.templateName,
      publishNow: true,
      platforms: [
        {
          platform: "whatsapp",
          accountId: input.accountId,
          whatsappOptions: {
            to: input.to,
            type: "template",
            template: {
              name: input.templateName,
              language: input.language,
              variables: input.variables ?? [],
            },
          },
        },
      ],
    },
  });
  return { messageId: extractMessageId(res), raw: res };
}

// ── WhatsApp templates / broadcasts / contacts / business / phone numbers ──
//
// These passthroughs preserve the Zernio response shape — adapter logic stays
// in apps/web/src/services/zernio/client.ts so component code doesn't change.

export const whatsappTemplates = {
  list: (accountId: string) =>
    request<unknown>("/whatsapp/templates", { query: { accountId } }),
  create: (input: { accountId: string; name: string; category: string; language: string; components: unknown[] }) =>
    request<unknown>("/whatsapp/templates", { method: "POST", body: input }),
  remove: (accountId: string, templateName: string) =>
    request<unknown>("/whatsapp/templates", {
      method: "DELETE",
      query: { accountId, name: templateName },
    }),
};

export const whatsappBroadcasts = {
  list: (input: { profileId: string; accountId?: string; platform?: string }) =>
    request<unknown>("/broadcasts", {
      query: { profileId: input.profileId, accountId: input.accountId, platform: input.platform ?? "whatsapp" },
    }),
  create: (input: { profileId: string; accountId: string; name: string; template: unknown }) =>
    request<unknown>("/broadcasts", {
      method: "POST",
      body: { ...input, platform: "whatsapp" },
    }),
  send: (broadcastId: string) =>
    request<unknown>(`/broadcasts/${encodeURIComponent(broadcastId)}/send`, { method: "POST" }),
  schedule: (broadcastId: string, scheduledAt: string) =>
    request<unknown>(`/broadcasts/${encodeURIComponent(broadcastId)}/schedule`, {
      method: "POST",
      body: { scheduledAt },
    }),
  addRecipients: (
    broadcastId: string,
    recipients: { phones?: string[]; contactIds?: string[]; useSegment?: boolean },
  ) =>
    request<unknown>(`/broadcasts/${encodeURIComponent(broadcastId)}/recipients`, {
      method: "POST",
      body: recipients,
    }),
};

export const whatsappContacts = {
  list: (input: { profileId: string; accountId: string; page?: number }) =>
    request<unknown>("/contacts", {
      query: { profileId: input.profileId, accountId: input.accountId, platform: "whatsapp", page: input.page ?? 1 },
    }),
  create: (input: { profileId: string; accountId: string; phone: string } & Record<string, unknown>) => {
    const { phone, ...rest } = input;
    return request<unknown>("/contacts", {
      method: "POST",
      body: { ...rest, platform: "whatsapp", platformIdentifier: phone },
    });
  },
  import: (input: { profileId: string; accountId: string; contacts: unknown[]; defaultTags?: string[] }) =>
    request<unknown>("/contacts/bulk", {
      method: "POST",
      body: {
        profileId: input.profileId,
        accountId: input.accountId,
        platform: "whatsapp",
        contacts: input.contacts.map((contact) => {
          if (!contact || typeof contact !== "object") return contact;
          const { phone, tags, ...rest } = contact as Record<string, unknown>;
          const mergedTags = [
            ...(Array.isArray(tags) ? tags : []),
            ...(input.defaultTags ?? []),
          ];
          return {
            ...rest,
            platformIdentifier: phone,
            ...(mergedTags.length > 0 ? { tags: Array.from(new Set(mergedTags)) } : {}),
          };
        }),
      },
    }),
  bulkUpdate: (input: { action: string; contactIds: string[]; tags?: string[]; groups?: string[] }) =>
    request<unknown>("/contacts/bulk-update", { method: "POST", body: input }),
};

export const whatsappBusinessProfile = {
  get: (accountId: string) =>
    request<unknown>("/whatsapp/business-profile", { query: { accountId } }),
  update: (accountId: string, profile: Record<string, unknown>) =>
    request<unknown>("/whatsapp/business-profile", { method: "POST", body: { accountId, ...profile } }),
};

export const whatsappPhoneNumbers = {
  list: () => request<unknown>("/whatsapp/phone-numbers"),
  purchase: (profileId: string) =>
    request<unknown>("/whatsapp/phone-numbers/purchase", { method: "POST", body: { profileId } }),
};

// ── Cross-platform posts ────────────────────────────────────────────────────
//
// Zernio's `/posts` endpoint is the canonical entry point for publishing or
// scheduling content across any supported platform. WhatsApp sends use
// `whatsappOptions`; other platforms use platform-specific options blocks
// when needed but accept defaults otherwise.

export interface SocialPostPlatform {
  /** Zernio platform slug — twitter, instagram, facebook, linkedin, etc. */
  platform: string;
  /** Account id of the connected social account on this platform. */
  accountId: string;
  /** Per-platform options passthrough (whatsappOptions, instagramOptions, etc.). */
  [key: string]: unknown;
}

export interface CreatePostInput {
  content: string;
  platforms: SocialPostPlatform[];
  /** ISO-8601 future timestamp. Mutually exclusive with `publishNow`. */
  scheduledAt?: string;
  publishNow?: boolean;
  mediaIds?: string[];
}

export const posts = {
  create: (input: CreatePostInput) =>
    request<unknown>("/posts", { method: "POST", body: input }),
  publishNow: (input: Omit<CreatePostInput, "publishNow" | "scheduledAt">) =>
    request<unknown>("/posts", {
      method: "POST",
      body: { ...input, publishNow: true },
    }),
  list: (input: { profileId: string; status?: string; limit?: number; page?: number }) =>
    request<unknown>("/posts", {
      query: {
        profileId: input.profileId,
        status: input.status,
        limit: input.limit ?? 20,
        page: input.page ?? 1,
      },
    }),
  get: (postId: string) => request<unknown>(`/posts/${encodeURIComponent(postId)}`),
  retry: (postId: string) =>
    request<unknown>(`/posts/${encodeURIComponent(postId)}/retry`, { method: "POST" }),
  cancel: (postId: string) =>
    request<unknown>(`/posts/${encodeURIComponent(postId)}/cancel`, { method: "POST" }),
};

// ── Inbox (DMs + comments across platforms) ─────────────────────────────────

export const inbox = {
  conversationsList: (input: { profileId: string; accountId?: string; page?: number }) =>
    request<unknown>("/inbox/conversations", {
      query: { profileId: input.profileId, accountId: input.accountId, page: input.page ?? 1 },
    }),
  messagesList: (input: { conversationId: string; page?: number }) =>
    request<unknown>(`/inbox/conversations/${encodeURIComponent(input.conversationId)}/messages`, {
      query: { page: input.page ?? 1 },
    }),
  sendMessage: (input: { conversationId: string; text: string; accountId?: string }) =>
    request<unknown>(`/inbox/conversations/${encodeURIComponent(input.conversationId)}/messages`, {
      method: "POST",
      body: { text: input.text, accountId: input.accountId },
    }),
  replyToComment: (input: { commentId: string; text: string; accountId?: string }) =>
    request<unknown>(`/inbox/comments/${encodeURIComponent(input.commentId)}/reply`, {
      method: "POST",
      body: { text: input.text, accountId: input.accountId },
    }),
};

// ── Media (presigned upload flow) ───────────────────────────────────────────

export const media = {
  generateUploadLink: (input: { profileId: string; mimeType: string; sizeBytes?: number }) =>
    request<unknown>("/media/upload-link", { method: "POST", body: input }),
  checkUploadStatus: (mediaId: string) =>
    request<unknown>(`/media/${encodeURIComponent(mediaId)}/status`),
};

// ── Generic per-platform connect URL ────────────────────────────────────────
//
// Zernio's `/connect/<platform>` endpoint returns an OAuth authorization URL
// scoped to a profileId. The SPA opens this URL; on success Zernio redirects
// back with the account already attached to the profile.

export const connect = {
  /**
   * Zernio's documented API: `GET /api/v1/connect/<platform>?profileId=<id>`.
   * Returns `{ authUrl }`. The post-OAuth redirect URL is configured server-
   * side in the Zernio app settings — not per-call — so we deliberately
   * don't forward a `redirect_url` query param even when the SPA passes one
   * through (some Zernio backends reject unknown query keys with 400/502).
   */
  getAuthUrl: (input: { platform: string; profileId: string; redirectUrl?: string }) =>
    request<{ authUrl?: string; url?: string } | unknown>(
      `/connect/${encodeURIComponent(input.platform)}`,
      {
        query: { profileId: input.profileId },
      },
    ),
};

export const whatsappConnect = {
  getAuthUrl: (input: { profileId: string; redirectUrl: string }) =>
    request<unknown>("/connect/whatsapp", {
      query: { profileId: input.profileId, redirect_url: input.redirectUrl },
    }),
  getSdkConfig: () => request<unknown>("/connect/whatsapp/sdk-config"),
  exchangeEmbeddedSignup: (code: string, profileId: string) =>
    request<unknown>("/connect/whatsapp/embedded-signup", { method: "POST", body: { code, profileId } }),
  connectCredentials: (input: {
    profileId: string;
    accessToken: string;
    wabaId: string;
    phoneNumberId: string;
  }) =>
    request<unknown>("/connect/whatsapp/credentials", { method: "POST", body: input }),
};

// ── Health probe ────────────────────────────────────────────────────────────
//
// Cheap call used by the SPA to gate WhatsApp UI: lists profiles with limit=1.
// Avoids burning a Zernio post and confirms both the API key and network are good.
export async function probeHealth(): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  try {
    await request<unknown>("/profiles", { query: { limit: 1 }, maxRetries: 0, timeoutMs: 5_000 });
    return { ok: true };
  } catch (err) {
    if (err instanceof ZernioApiError) return { ok: false, code: err.code, message: err.message };
    return { ok: false, code: "unknown", message: (err as Error).message ?? "probe failed" };
  }
}
