/**
 * zernioClient — typed, namespaced façade over the `late-proxy` edge function.
 *
 * Why not the npm SDK? `zernio-node` is server-only and cannot run in the browser
 * without leaking ZERNIO_API_KEY. All calls flow through our credit-metered proxy.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  WABAAccount,
  WABABroadcast,
  WABABusinessProfile,
  WABAContact,
  WABAPhoneNumber,
  WABATemplate,
  ZernioSendTextInput,
  ZernioSendTemplateInput,
  ZernioSendResult,
} from "./types";

type RawZernioAccount = Partial<WABAAccount> & {
  _id?: string;
  displayName?: string;
  username?: string;
  metadata?: {
    displayPhoneNumber?: string;
    verifiedName?: string;
    phoneNumberId?: string;
    wabaId?: string;
  };
  platformStatus?: string;
  enabled?: boolean;
  isActive?: boolean;
};

function normalizeWabaAccount(raw: RawZernioAccount): WABAAccount {
  const accountId = raw.accountId || raw._id || raw.id || raw.metadata?.phoneNumberId || raw.metadata?.wabaId || "";
  const phoneNumber = raw.phoneNumber || raw.metadata?.displayPhoneNumber || raw.username;
  const status =
    raw.status ||
    (raw.platformStatus === "active" || raw.enabled || raw.isActive ? "connected" : raw.platformStatus || "unknown");

  return {
    id: raw.id || raw._id || accountId,
    accountId,
    platform: raw.platform || "whatsapp",
    status,
    name: raw.name || raw.displayName || raw.metadata?.verifiedName || phoneNumber || accountId,
    phoneNumber,
  };
}

/**
 * Zernio-specific error with stable code, status and retryability metadata.
 * Hooks can branch on `code` (e.g. show upgrade modal on `insufficient_credits`).
 */
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

/** Codes the proxy returns that we treat as transient. */
const RETRYABLE_CODES = new Set([
  "rate_limited",
  "upstream_unavailable",
  "timeout",
  "network_error",
  "proxy_error",
]);

/** Compute exponential-backoff delay (base 400ms, factor 2, ±25% jitter, cap 6s). */
function computeBackoff(attempt: number): number {
  const base = 400;
  const exp = Math.min(base * Math.pow(2, attempt), 6_000);
  const jitter = exp * 0.25 * (Math.random() * 2 - 1);
  return Math.round(exp + jitter);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function invokeProxy<T = unknown>(
  route: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
  workspaceId?: string | null,
  options?: { maxRetries?: number },
): Promise<T> {
  const isMutation = method !== "GET";
  // Mutations get fewer retries to avoid duplicate sends; reads can retry harder.
  const maxRetries = options?.maxRetries ?? (isMutation ? 1 : 3);

  let lastError: ZernioApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke("late-proxy", {
        body: { route, method, body, workspace_id: workspaceId ?? undefined },
      });

      // supabase.functions.invoke transport-level error
      if (error) {
        lastError = new ZernioApiError({
          message: error.message || "Falha na comunicação com o servidor",
          code: "transport_error",
          retryable: true,
        });
      } else if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
        const payload = data as { error: string; code?: string; status?: number; retryable?: boolean; details?: unknown };
        const code = payload.code ?? "api_error";
        lastError = new ZernioApiError({
          message: payload.error,
          code,
          status: payload.status,
          retryable: payload.retryable ?? RETRYABLE_CODES.has(code),
          details: payload.details,
        });
      } else {
        return data as T;
      }
    } catch (err) {
      // Hard JS exception — treat as retryable network failure
      lastError = new ZernioApiError({
        message: (err as Error)?.message ?? "Erro inesperado",
        code: "network_error",
        retryable: true,
      });
    }

    // Decide whether to retry
    if (attempt >= maxRetries || !lastError.retryable) break;
    // For mutations, only retry rate-limit & upstream-unavailable
    if (isMutation && !["rate_limited", "upstream_unavailable"].includes(lastError.code)) break;

    const wait = computeBackoff(attempt);
    console.warn(`[zernioClient] ${lastError.code} on ${method} ${route}, retry ${attempt + 1}/${maxRetries} in ${wait}ms`);
    await sleep(wait);
  }

  throw lastError ?? new ZernioApiError({ message: "Erro desconhecido", code: "unknown" });
}

/** Public escape-hatch: call any proxy route with the same retry/error semantics. */
export async function zernioRequest<T = unknown>(
  route: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, unknown>,
  workspaceId?: string | null,
): Promise<T> {
  return invokeProxy<T>(route, method, body, workspaceId);
}

/**
 * Lightweight server-side credentials probe.
 *
 * Calls `late-proxy` with the special `__health` route which only checks
 * whether `LATE_API_KEY` is present (no upstream Zernio call, no credits).
 *
 * Returns `{ ok: true }` when the key is configured, or
 * `{ ok: false, code, message }` when missing/invalid.
 *
 * Designed for app-startup notification — does NOT throw on `missing_api_key`
 * so the caller can surface a friendly toast instead of a runtime crash.
 */
export type ZernioHealthResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export async function verifyZernioCredentials(): Promise<ZernioHealthResult> {
  try {
    await invokeProxy<{ ok: true }>("__health", "GET", undefined, undefined, { maxRetries: 0 });
    return { ok: true } as ZernioHealthResult;
  } catch (err) {
    if (err instanceof ZernioApiError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return {
      ok: false,
      code: "unknown",
      message: (err as Error)?.message ?? "Falha ao verificar credenciais Zernio",
    };
  }
}

/**
 * Probes Zernio's API to discover & confirm the canonical WhatsApp send route.
 *
 * Tries common candidates (in order) via the proxy's `__verify_route` echo,
 * which makes a lightweight `OPTIONS`/`GET` against each path and reports the
 * first one that returns 2xx/4xx (i.e. exists, even if the verb doesn't match)
 * vs. 404 (route truly missing).
 *
 * Returns the active route the client should POST to, or a structured
 * diagnostic when no candidate is reachable.
 */
export type ZernioRouteCheck = {
  route: string;
  status: number;
  exists: boolean;
};

export type ZernioSendRouteResult =
  | {
      ok: true;
      activeRoute: string;
      checked: ZernioRouteCheck[];
    }
  | {
      ok: false;
      code: string;
      message: string;
      checked: ZernioRouteCheck[];
    };

const CANDIDATE_SEND_ROUTES = ["/posts", "/whatsapp/send", "/whatsapp/messages"] as const;

export async function verifyZernioSendRoute(): Promise<ZernioSendRouteResult> {
  try {
    const res = await invokeProxy<{ checks: ZernioRouteCheck[] }>(
      "__verify_route",
      "POST",
      { candidates: CANDIDATE_SEND_ROUTES },
      undefined,
      { maxRetries: 0 },
    );
    const checks = res.checks ?? [];
    // The canonical Zernio endpoint per docs is /posts (with whatsappOptions).
    // Pick /posts if it exists, otherwise fall back to first existing route.
    const posts = checks.find((c) => c.route === "/posts" && c.exists);
    const fallback = checks.find((c) => c.exists);
    const active = posts ?? fallback;
    if (active) {
      return { ok: true, activeRoute: active.route, checked: checks };
    }
    return {
      ok: false,
      code: "no_route",
      message: "Nenhuma rota de envio do WhatsApp respondeu na API Zernio.",
      checked: checks,
    };
  } catch (err) {
    if (err instanceof ZernioApiError) {
      return { ok: false, code: err.code, message: err.message, checked: [] };
    }
    return {
      ok: false,
      code: "unknown",
      message: (err as Error)?.message ?? "Falha ao verificar rota de envio",
      checked: [],
    };
  }
}

export const zernioClient = {
  // ── Connection ────────────────────────────────────────────────────────────
  connect: {
    getSdkConfig: () =>
      invokeProxy<{ appId: string; configId: string }>("/connect/whatsapp/sdk-config"),

    exchangeEmbeddedSignup: async (code: string, profileId: string) => {
      const response = await invokeProxy<{ account: RawZernioAccount }>("/connect/whatsapp/embedded-signup", "POST", { code, profileId });
      return { ...response, account: normalizeWabaAccount(response.account) };
    },

    connectCredentials: async (profileId: string, accessToken: string, wabaId: string, phoneNumberId: string) => {
      const response = await invokeProxy<{ account: RawZernioAccount }>("/connect/whatsapp/credentials", "POST", {
        profileId,
        accessToken,
        wabaId,
        phoneNumberId,
      });
      return { ...response, account: normalizeWabaAccount(response.account) };
    },
  },

  // ── Accounts ──────────────────────────────────────────────────────────────
  accounts: {
    list: async () => {
      const response = await invokeProxy<{ accounts: RawZernioAccount[] }>("/accounts?platform=whatsapp");
      return {
        ...response,
        accounts: (response.accounts || []).map(normalizeWabaAccount).filter((account) => Boolean(account.accountId)),
      };
    },
  },

  whatsapp: {
    /** Send a free-text message (must be within the 24h conversation window). */
    async sendText(input: ZernioSendTextInput): Promise<ZernioSendResult> {
      // Lazy import — keeps tree-shaking happy and avoids circular deps.
      const { normalizeE164 } = await import("./normalize");
      const to = normalizeE164(input.to);
      const res = await invokeProxy<{ post?: { _id?: string; platforms?: Array<{ _id?: string }> } }>(
        "/posts",
        "POST",
        {
          content: input.text,
          publishNow: true,
          platforms: [
            {
              platform: "whatsapp",
              accountId: input.accountId,
              whatsappOptions: {
                to,
                type: "text",
                text: input.text,
              },
            },
          ],
        },
        input.workspaceId,
      );
      const messageId = res.post?.platforms?.[0]?._id ?? res.post?._id;
      return { messageId, raw: res };
    },

    /** Send a pre-approved WABA template (works outside the 24h window). */
    async sendTemplate(input: ZernioSendTemplateInput): Promise<ZernioSendResult> {
      const { normalizeE164 } = await import("./normalize");
      const to = normalizeE164(input.to);
      const res = await invokeProxy<{ post?: { _id?: string; platforms?: Array<{ _id?: string }> } }>(
        "/posts",
        "POST",
        {
          content: input.templateName,
          publishNow: true,
          platforms: [
            {
              platform: "whatsapp",
              accountId: input.accountId,
              whatsappOptions: {
                to,
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
        input.workspaceId,
      );
      const messageId = res.post?.platforms?.[0]?._id ?? res.post?._id;
      return { messageId, raw: res };
    },

    // ── Templates ──────────────────────────────────────────────────────────
    templates: {
      list: (accountId: string) =>
        invokeProxy<{ templates: WABATemplate[] }>(
          `/whatsapp/templates?accountId=${encodeURIComponent(accountId)}`,
        ),

      create: (accountId: string, name: string, category: string, language: string, components: unknown[]) =>
        invokeProxy<{ template: WABATemplate }>("/whatsapp/templates", "POST", {
          accountId,
          name,
          category,
          language,
          components,
        }),

      remove: (accountId: string, templateName: string) =>
        invokeProxy(
          `/whatsapp/templates?accountId=${encodeURIComponent(accountId)}&name=${encodeURIComponent(templateName)}`,
          "DELETE",
        ),
    },

    // ── Broadcasts ─────────────────────────────────────────────────────────
    broadcasts: {
      list: (accountId: string) =>
        invokeProxy<{ broadcasts: WABABroadcast[] }>(
          `/whatsapp/broadcasts?accountId=${encodeURIComponent(accountId)}`,
        ),

      create: (accountId: string, name: string, template: unknown, recipients: unknown[]) =>
        invokeProxy<{ broadcast: WABABroadcast }>("/whatsapp/broadcasts", "POST", {
          accountId,
          name,
          template,
          recipients,
        }),

      send: (broadcastId: string) =>
        invokeProxy<{ sent: number; failed: number }>(`/whatsapp/broadcasts/${broadcastId}/send`, "POST"),

      schedule: async (broadcastId: string, scheduledAt: string | Date | number) => {
        const { normalizeIsoDate } = await import("./normalize");
        const iso = normalizeIsoDate(scheduledAt, { mustBeFuture: true, minLeadMs: 60_000 });
        return invokeProxy(`/whatsapp/broadcasts/${broadcastId}/schedule`, "POST", { scheduledAt: iso });
      },

      addRecipients: (broadcastId: string, recipients: unknown[]) =>
        invokeProxy(`/whatsapp/broadcasts/${broadcastId}/recipients`, "PATCH", { recipients }),
    },

    // ── Contacts ───────────────────────────────────────────────────────────
    contacts: {
      list: (accountId: string, page = 1) =>
        invokeProxy<{ contacts: WABAContact[]; total: number }>(
          `/whatsapp/contacts?accountId=${encodeURIComponent(accountId)}&page=${page}`,
        ),

      create: (accountId: string, contact: Partial<WABAContact>) =>
        invokeProxy<{ contact: WABAContact }>("/whatsapp/contacts", "POST", { accountId, ...contact }),

      import: (accountId: string, contacts: Partial<WABAContact>[], defaultTags?: string[]) =>
        invokeProxy<{ summary: { created: number; skipped: number } }>(
          "/whatsapp/contacts/import",
          "POST",
          { accountId, contacts, defaultTags, skipDuplicates: true },
        ),

      bulkUpdate: (action: string, contactIds: string[], tags?: string[], groups?: string[]) =>
        invokeProxy<{ modified: number }>("/whatsapp/contacts/bulk", "POST", {
          action,
          contactIds,
          tags,
          groups,
        }),
    },

    // ── Business profile ───────────────────────────────────────────────────
    businessProfile: {
      get: (accountId: string) =>
        invokeProxy<{ businessProfile: WABABusinessProfile }>(
          `/whatsapp/business-profile?accountId=${encodeURIComponent(accountId)}`,
        ),

      update: (accountId: string, profile: Partial<WABABusinessProfile>) =>
        invokeProxy("/whatsapp/business-profile", "POST", { accountId, ...profile }),
    },

    // ── Phone numbers ──────────────────────────────────────────────────────
    phoneNumbers: {
      list: () => invokeProxy<{ numbers: WABAPhoneNumber[] }>("/whatsapp/phone-numbers"),

      purchase: (profileId: string) =>
        invokeProxy<{ phoneNumber?: WABAPhoneNumber; checkoutUrl?: string }>(
          "/whatsapp/phone-numbers/purchase",
          "POST",
          { profileId },
        ),
    },

    // ── Bulk send (legacy bulk template send) ──────────────────────────────
    sendBulk: (accountId: string, recipients: unknown[], template: unknown) =>
      invokeProxy<{ summary: { sent: number; failed: number } }>("/whatsapp/bulk", "POST", {
        accountId,
        recipients,
        template,
      }),
  },
} as const;
