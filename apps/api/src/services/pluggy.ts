import { env } from "../config/env.js";

/**
 * Pluggy REST client — minimal surface required by Finance Wave B.
 *
 * Auth model: Pluggy's API takes an `X-API-KEY` header containing a 2-hour
 * access token. The token is fetched from `POST /auth` with our org-wide
 * CLIENT_ID + CLIENT_SECRET. We cache it for ~110 minutes (10-min buffer)
 * so steady-state syncs don't re-auth on every read.
 *
 * Pluggy returns 401 when a token expires mid-request. We treat that as
 * "refresh + retry once" so a transient expiry doesn't fail a sync that
 * happened to span the boundary.
 */

export class PluggyApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(opts: {
    message: string;
    code: string;
    status?: number;
    retryable?: boolean;
    details?: unknown;
  }) {
    super(opts.message);
    this.name = "PluggyApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
    this.details = opts.details;
  }
}

const RETRYABLE_CODES = new Set(["rate_limited", "upstream_unavailable", "timeout", "network_error"]);

export function isPluggyConfigured(): boolean {
  return Boolean(env.PLUGGY_CLIENT_ID && env.PLUGGY_CLIENT_SECRET);
}

// ── Token cache ────────────────────────────────────────────────────────────
// Pluggy access tokens last 2h. We hold one in module scope and refresh on
// the 110-minute mark (or when we get a 401). Module-scope is fine because
// the token is org-wide — every workspace's sync uses the same one.

let cachedToken: { value: string; expiresAt: number } | null = null;
const TOKEN_TTL_MS = 110 * 60 * 1000;

async function fetchAccessToken(): Promise<string> {
  if (!env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET) {
    throw new PluggyApiError({
      message: "PLUGGY_CLIENT_ID/SECRET not configured",
      code: "not_configured",
    });
  }
  const res = await fetch(`${env.PLUGGY_API_BASE.replace(/\/$/, "")}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      clientId: env.PLUGGY_CLIENT_ID,
      clientSecret: env.PLUGGY_CLIENT_SECRET,
    }),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    // fall through
  }
  if (!res.ok) {
    throw classify(res.status, data);
  }
  const token = (data as { apiKey?: string; accessToken?: string } | null)?.apiKey
    ?? (data as { apiKey?: string; accessToken?: string } | null)?.accessToken;
  if (!token) {
    throw new PluggyApiError({ message: "Pluggy /auth returned no apiKey", code: "bad_response" });
  }
  return token;
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.value;
  }
  const token = await fetchAccessToken();
  cachedToken = { value: token, expiresAt: now + TOKEN_TTL_MS };
  return token;
}

// ── Generic fetch wrapper ──────────────────────────────────────────────────

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
  /** Set to false to skip the 401-refresh-and-retry dance (used by /auth itself). */
  authRequired?: boolean;
}

function classify(status: number, payload: unknown): PluggyApiError {
  let message = `Pluggy request failed (${status})`;
  let code: string;
  if (status === 429) code = "rate_limited";
  else if (status === 408 || status === 504) code = "timeout";
  else if (status === 401) code = "unauthorized";
  else if (status === 403) code = "forbidden";
  else if (status === 404) code = "not_found";
  else if (status >= 500) code = "upstream_unavailable";
  else if (status === 422 || status === 400) code = "validation_error";
  else code = "api_error";

  const p = payload as { message?: string; error?: string; code?: string } | null | undefined;
  if (p) {
    if (typeof p.message === "string") message = p.message;
    else if (typeof p.error === "string") message = p.error;
    if (typeof p.code === "string") code = p.code;
  }
  return new PluggyApiError({
    message,
    code,
    status,
    retryable: RETRYABLE_CODES.has(code),
    details: payload,
  });
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = env.PLUGGY_API_BASE.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(base + cleanPath);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const url = buildUrl(path, opts.query);
  const authRequired = opts.authRequired ?? true;

  const doFetch = async (token: string): Promise<{ res: Response; text: string }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (authRequired) headers["X-API-KEY"] = token;
      if (opts.body !== undefined) headers["Content-Type"] = "application/json";
      const res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      return { res, text };
    } finally {
      clearTimeout(timer);
    }
  };

  let token = authRequired ? await getAccessToken() : "";
  let { res, text } = await doFetch(token);

  // Token expired between cache check and request — refresh once and retry.
  if (authRequired && res.status === 401 && cachedToken) {
    cachedToken = null;
    token = await getAccessToken(true);
    ({ res, text } = await doFetch(token));
  }

  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) throw classify(res.status, data);
  return data as T;
}

// ── Connect token ──────────────────────────────────────────────────────────
// The SPA's Pluggy Connect widget needs a short-lived token bound to either
// a fresh connection (no itemId) or an existing one (for reconnect). We
// pass `clientUserId` so Pluggy can correlate items back to the workspace
// even before the SPA persists the resulting itemId.

export async function createConnectToken(input: {
  clientUserId: string;
  itemId?: string;
  webhookUrl?: string;
}): Promise<{ accessToken: string }> {
  const body: Record<string, unknown> = { clientUserId: input.clientUserId };
  if (input.itemId) body.itemId = input.itemId;
  if (input.webhookUrl) body.webhookUrl = input.webhookUrl;
  const res = await request<{ accessToken?: string }>("/connect_token", {
    method: "POST",
    body,
  });
  if (!res.accessToken) {
    throw new PluggyApiError({ message: "Pluggy /connect_token returned no accessToken", code: "bad_response" });
  }
  return { accessToken: res.accessToken };
}

// ── Item (connection) ─────────────────────────────────────────────────────

export interface PluggyItem {
  id: string;
  status: string;
  connector?: { name?: string; imageUrl?: string };
  updatedAt?: string;
  error?: { code?: string; message?: string };
  webhookUrl?: string | null;
}

export async function getItem(itemId: string): Promise<PluggyItem> {
  return request<PluggyItem>(`/items/${encodeURIComponent(itemId)}`);
}

export async function deleteItem(itemId: string): Promise<void> {
  await request(`/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}

// ── Accounts ──────────────────────────────────────────────────────────────

export interface PluggyAccount {
  id: string;
  type?: string;
  subtype?: string;
  name?: string;
  marketingName?: string;
  number?: string;
  balance?: number;
  currencyCode?: string;
  bankData?: Record<string, unknown>;
  creditData?: { availableCreditLimit?: number; creditLimit?: number };
}

export async function listAccounts(itemId: string): Promise<PluggyAccount[]> {
  const res = await request<{ results?: PluggyAccount[] } | PluggyAccount[]>("/accounts", {
    query: { itemId },
  });
  return Array.isArray(res) ? res : res.results ?? [];
}

// ── Transactions ──────────────────────────────────────────────────────────

export interface PluggyTransaction {
  id: string;
  date: string;
  description?: string;
  descriptionRaw?: string;
  amount: number;
  type?: "DEBIT" | "CREDIT";
  category?: string;
  categoryId?: string;
  merchant?: { name?: string };
  status?: string;
  currencyCode?: string;
}

export interface ListTransactionsOpts {
  /** ISO date YYYY-MM-DD, inclusive. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listTransactions(
  accountId: string,
  opts: ListTransactionsOpts = {},
): Promise<{ items: PluggyTransaction[]; total: number; totalPages: number }> {
  const res = await request<{
    results?: PluggyTransaction[];
    total?: number;
    totalPages?: number;
  }>("/transactions", {
    query: {
      accountId,
      from: opts.from,
      to: opts.to,
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 200,
    },
  });
  return {
    items: res.results ?? [],
    total: res.total ?? (res.results?.length ?? 0),
    totalPages: res.totalPages ?? 1,
  };
}

// ── Investments ───────────────────────────────────────────────────────────

export interface PluggyInvestment {
  id: string;
  itemId?: string;
  name?: string;
  type?: string;
  code?: string;
  ticker?: string;
  quantity?: number;
  balance?: number;
  amount?: number;
  amountOriginal?: number;
  currencyCode?: string;
}

export async function listInvestments(itemId: string): Promise<PluggyInvestment[]> {
  const res = await request<{ results?: PluggyInvestment[] } | PluggyInvestment[]>("/investments", {
    query: { itemId },
  });
  return Array.isArray(res) ? res : res.results ?? [];
}

// ── Loans ─────────────────────────────────────────────────────────────────

export interface PluggyLoan {
  id: string;
  contractNumber?: string;
  productName?: string;
  loanType?: string;
  contractDate?: string;
  contractAmount?: number;
  outstandingBalance?: number;
  currencyCode?: string;
  dueDate?: string;
  cet?: number;
  installmentPeriodicity?: string;
  totalInstallments?: number;
  paidInstallments?: number;
  dueInstallments?: number;
  status?: string;
}

export async function listLoans(itemId: string): Promise<PluggyLoan[]> {
  const res = await request<{ results?: PluggyLoan[] } | PluggyLoan[]>("/loans", {
    query: { itemId },
  });
  return Array.isArray(res) ? res : res.results ?? [];
}
