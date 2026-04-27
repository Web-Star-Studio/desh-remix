/**
 * zernioClient — typed, namespaced façade over the apps/api `/workspaces/:id
 * /zernio/*` routes. Replaces the legacy `late-proxy` Supabase edge function
 * call site; the public surface is preserved so existing components keep
 * working.
 *
 * Workspace-scoped: the apps/api routes require a workspace id in the URL.
 * Use `zernioClient.forWorkspace(workspaceId).whatsapp.templates.list(...)`
 * to obtain a pre-bound builder. Hooks pull the id from `useWorkspace()`.
 */
import { ApiError, apiFetch } from "@/lib/api-client";
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
  zernioAccountId?: string;
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
  const accountId =
    raw.accountId || raw.zernioAccountId || raw._id || raw.id || raw.metadata?.phoneNumberId || raw.metadata?.wabaId || "";
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
 * Hooks branch on `code` (e.g. show upgrade modal on `insufficient_credits`).
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
  "transport_error",
]);

/** Adapt apps/api error envelopes into a ZernioApiError so existing toasts keep working. */
function adaptApiError(err: unknown): ZernioApiError {
  if (err instanceof ZernioApiError) return err;
  if (err instanceof ApiError) {
    const body = err.body as
      | { error?: string; code?: string; message?: string; retryable?: boolean; upstreamStatus?: number }
      | string
      | null;
    if (body && typeof body === "object") {
      const code = body.code ?? body.error ?? "api_error";
      return new ZernioApiError({
        message: body.message ?? body.error ?? `API ${err.status}`,
        code,
        status: body.upstreamStatus ?? err.status,
        retryable: body.retryable ?? RETRYABLE_CODES.has(code),
        details: body,
      });
    }
    return new ZernioApiError({
      message: typeof body === "string" ? body : `API ${err.status}`,
      code: "api_error",
      status: err.status,
    });
  }
  return new ZernioApiError({
    message: (err as Error)?.message ?? "Erro inesperado",
    code: "network_error",
    retryable: true,
  });
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (err) {
    throw adaptApiError(err);
  }
}

// ── Forward functions (no namespace) ────────────────────────────────────────

export type ZernioHealthResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export async function verifyZernioCredentials(
  workspaceId: string,
): Promise<ZernioHealthResult> {
  if (!workspaceId) return { ok: false, code: "no_workspace", message: "Selecione um workspace" };
  try {
    return await apiFetch<ZernioHealthResult>(`/workspaces/${workspaceId}/zernio/health`);
  } catch (err) {
    const z = adaptApiError(err);
    return { ok: false, code: z.code, message: z.message };
  }
}

// ── Workspace-scoped builder ────────────────────────────────────────────────

function buildWorkspaceClient(workspaceId: string) {
  const root = `/workspaces/${workspaceId}/zernio`;

  return {
    workspaceId,
    status: () =>
      call<{ configured: boolean; profileId: string | null; accountsCount: number }>(root),

    // ── Connection ──
    connect: {
      getAuthUrl: (redirectUrl: string) =>
        call<{ authUrl: string; state?: string }>(
          `${root}/whatsapp/connect/auth-url?redirectUrl=${encodeURIComponent(redirectUrl)}`,
        ),
      getSdkConfig: () =>
        call<{ appId: string; configId: string }>(`${root}/whatsapp/connect/sdk-config`),

      exchangeEmbeddedSignup: async (code: string, profileId: string) => {
        const response = await call<{ account: RawZernioAccount }>(
          `${root}/whatsapp/connect/embedded-signup`,
          { method: "POST", body: JSON.stringify({ code, profileId }) },
        );
        return { ...response, account: normalizeWabaAccount(response.account) };
      },

      connectCredentials: async (
        profileId: string,
        accessToken: string,
        wabaId: string,
        phoneNumberId: string,
      ) => {
        const response = await call<{ account: RawZernioAccount }>(
          `${root}/whatsapp/connect/credentials`,
          {
            method: "POST",
            body: JSON.stringify({ profileId, accessToken, wabaId, phoneNumberId }),
          },
        );
        return { ...response, account: normalizeWabaAccount(response.account) };
      },
    },

    // ── Accounts ──
    accounts: {
      /** Local social_accounts table for this workspace (post-sync). */
      list: async () => {
        const response = await call<{ accounts: RawZernioAccount[] }>(`${root}/accounts`);
        return {
          ...response,
          accounts: (response.accounts || [])
            .map(normalizeWabaAccount)
            .filter((account) => Boolean(account.accountId)),
        };
      },
      /** Pull from upstream Zernio + upsert into social_accounts. */
      sync: () =>
        call<{ synced: number; profileId: string; accounts: RawZernioAccount[] }>(
          `${root}/sync-accounts`,
          { method: "POST" },
        ),
    },

    whatsapp: {
      async sendText(input: Omit<ZernioSendTextInput, "workspaceId">): Promise<ZernioSendResult> {
        const { normalizeE164 } = await import("./normalize");
        const to = normalizeE164(input.to);
        const res = await call<{ messageId: string | null; latencyMs: number }>(
          `${root}/whatsapp/messages`,
          {
            method: "POST",
            body: JSON.stringify({ kind: "text", accountId: input.accountId, to, text: input.text }),
          },
        );
        return { messageId: res.messageId ?? undefined, raw: res };
      },

      async sendTemplate(
        input: Omit<ZernioSendTemplateInput, "workspaceId">,
      ): Promise<ZernioSendResult> {
        const { normalizeE164 } = await import("./normalize");
        const to = normalizeE164(input.to);
        const res = await call<{ messageId: string | null; latencyMs: number }>(
          `${root}/whatsapp/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              kind: "template",
              accountId: input.accountId,
              to,
              templateName: input.templateName,
              language: input.language,
              variables: input.variables ?? [],
            }),
          },
        );
        return { messageId: res.messageId ?? undefined, raw: res };
      },

      // ── Templates ──
      templates: {
        list: (accountId: string) =>
          call<{ templates: WABATemplate[] }>(
            `${root}/whatsapp/templates?accountId=${encodeURIComponent(accountId)}`,
          ),
        create: (
          accountId: string,
          name: string,
          category: string,
          language: string,
          components: unknown[],
        ) =>
          call<{ template: WABATemplate }>(`${root}/whatsapp/templates`, {
            method: "POST",
            body: JSON.stringify({ accountId, name, category, language, components }),
          }),
        remove: (accountId: string, templateName: string) =>
          call<unknown>(
            `${root}/whatsapp/templates?accountId=${encodeURIComponent(accountId)}&name=${encodeURIComponent(templateName)}`,
            { method: "DELETE" },
          ),
      },

      // ── Broadcasts ──
      broadcasts: {
        list: (accountId: string) =>
          call<{ broadcasts: WABABroadcast[] }>(
            `${root}/whatsapp/broadcasts?accountId=${encodeURIComponent(accountId)}`,
          ),
        create: (accountId: string, name: string, template: unknown, recipients: unknown[]) =>
          call<{ broadcast: WABABroadcast }>(`${root}/whatsapp/broadcasts`, {
            method: "POST",
            body: JSON.stringify({ accountId, name, template, recipients }),
          }),
        send: (broadcastId: string) =>
          call<{ sent: number; failed: number }>(
            `${root}/whatsapp/broadcasts/${encodeURIComponent(broadcastId)}/send`,
            { method: "POST" },
          ),
        schedule: async (broadcastId: string, scheduledAt: string | Date | number) => {
          const { normalizeIsoDate } = await import("./normalize");
          const iso = normalizeIsoDate(scheduledAt, { mustBeFuture: true, minLeadMs: 60_000 });
          return call<unknown>(
            `${root}/whatsapp/broadcasts/${encodeURIComponent(broadcastId)}/schedule`,
            { method: "POST", body: JSON.stringify({ scheduledAt: iso }) },
          );
        },
        addRecipients: (broadcastId: string, recipients: unknown[]) =>
          call<unknown>(
            `${root}/whatsapp/broadcasts/${encodeURIComponent(broadcastId)}/recipients`,
            { method: "PATCH", body: JSON.stringify({ recipients }) },
          ),
      },

      // ── Contacts ──
      contacts: {
        list: (accountId: string, page = 1) =>
          call<{ contacts: WABAContact[]; total: number }>(
            `${root}/whatsapp/contacts?accountId=${encodeURIComponent(accountId)}&page=${page}`,
          ),
        create: (accountId: string, contact: Partial<WABAContact>) =>
          call<{ contact: WABAContact }>(`${root}/whatsapp/contacts`, {
            method: "POST",
            body: JSON.stringify({ accountId, ...contact }),
          }),
        import: (accountId: string, contacts: Partial<WABAContact>[], defaultTags?: string[]) =>
          call<{ summary: { created: number; skipped: number } }>(
            `${root}/whatsapp/contacts/import`,
            {
              method: "POST",
              body: JSON.stringify({ accountId, contacts, defaultTags }),
            },
          ),
        bulkUpdate: (action: string, contactIds: string[], tags?: string[], groups?: string[]) =>
          call<{ modified: number }>(`${root}/whatsapp/contacts/bulk`, {
            method: "POST",
            body: JSON.stringify({ action, contactIds, tags, groups }),
          }),
      },

      // ── Business profile ──
      businessProfile: {
        get: (accountId: string) =>
          call<{ businessProfile: WABABusinessProfile }>(
            `${root}/whatsapp/business-profile?accountId=${encodeURIComponent(accountId)}`,
          ),
        update: (accountId: string, profile: Partial<WABABusinessProfile>) =>
          call<unknown>(`${root}/whatsapp/business-profile`, {
            method: "POST",
            body: JSON.stringify({ accountId, ...profile }),
          }),
      },

      // ── Phone numbers ──
      phoneNumbers: {
        list: () => call<{ numbers: WABAPhoneNumber[] }>(`${root}/whatsapp/phone-numbers`),
        purchase: (profileId?: string) =>
          call<{ phoneNumber?: WABAPhoneNumber; checkoutUrl?: string }>(
            `${root}/whatsapp/phone-numbers/purchase`,
            { method: "POST", body: JSON.stringify({ profileId }) },
          ),
      },
    },
  };
}

/**
 * Public surface. Use `zernioClient.forWorkspace(id)` to bind the workspace
 * scope, e.g. inside hooks that already have `useWorkspace()` in scope.
 */
export const zernioClient = {
  forWorkspace: buildWorkspaceClient,
};

export type ZernioWorkspaceClient = ReturnType<typeof buildWorkspaceClient>;
