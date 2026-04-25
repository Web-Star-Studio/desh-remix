/**
 * @function late-proxy
 * @description Proxy para Late API (social media management) com isolamento por usuário
 * @status active
 * @calledBy useLateProxy hook
 */
import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import { deductCredits, insufficientCreditsResponse } from "../_shared/credits.ts";
import { corsHeaders } from "../_shared/utils.ts";

const LATE_BASE = "https://zernio.com/api/v1";

/** Map route prefixes to credit action names — social routes are now flat-rate (no credits) */
function creditAction(route: string, method: string): string | null {
  if (route.startsWith("/connect/")) return null;
  // Note: WhatsApp messages are sent via /posts with whatsappOptions — see /posts handler below.
  if (route.startsWith("/posts")) return null;
  if (route.includes("/analytics")) return null;
  if (route.includes("/follower-stats")) return null;
  if (route.includes("/health")) return null;
  if (route.startsWith("/media/presign")) return null;
  if (route.startsWith("/queue")) return null;
  if (route.startsWith("/twitter/")) return null;
  if (route.startsWith("/profiles")) return null;
  if (route.includes("/gmb-reviews")) return null;
  if (route.includes("/gmb-locations")) return null;
  if (route.includes("/gmb-food-menus")) return null;
  if (route.includes("/gmb-location-details")) return null;
  if (route.includes("/facebook-page")) return null;
  if (route.startsWith("/tools/validate")) return null;
  if (route.startsWith("/accounts")) return null;
  if (route.startsWith("/inbox/")) return null;

  if ((route.startsWith("/whatsapp/send") || route.startsWith("/whatsapp/messages")) && method === "POST") return "wa_message_send";
  if (route.startsWith("/whatsapp/bulk") && method === "POST") return "wa_broadcast_send";
  if (route.startsWith("/whatsapp/broadcasts") && method === "POST") return "wa_broadcast_create";
  if (route.startsWith("/whatsapp/broadcasts") && method === "GET") return null;
  if (route.includes("/broadcasts/") && route.includes("/send")) return "wa_broadcast_send";
  if (route.includes("/broadcasts/") && route.includes("/schedule")) return "wa_broadcast_schedule";
  if (route.includes("/broadcasts/") && route.includes("/recipients")) return null;
  if (route.startsWith("/whatsapp/templates") && method === "POST") return "wa_template_create";
  if (route.startsWith("/whatsapp/templates") && method === "GET") return null;
  if (route.startsWith("/whatsapp/templates") && method === "DELETE") return null;
  if (route.startsWith("/whatsapp/contacts/import")) return "wa_contact_import";
  if (route.startsWith("/whatsapp/contacts/bulk")) return null;
  if (route.startsWith("/whatsapp/contacts") && method === "POST") return "wa_contact_create";
  if (route.startsWith("/whatsapp/contacts") && method === "GET") return null;
  if (route.startsWith("/whatsapp/business-profile")) return null;
  if (route.startsWith("/whatsapp/phone-numbers")) return null;
  if (route.startsWith("/connect/whatsapp")) return "wa_connect";
  return null;
}

/**
 * Canonical aliases for "WhatsApp" across upstream/legacy/SDK payloads.
 * Matched after lowercasing + stripping non-alphanumerics, so:
 *   "WhatsApp", "whats_app", "Whats-App", "WHATSAPP_BUSINESS", "wa", "waba"
 * all collapse to the same token. Keeps detection resilient when callers
 * vary casing or use shorthand.
 */
const WHATSAPP_ALIASES = new Set([
  "whatsapp",
  "wa",
  "waba",
  "whatsappbusiness",
  "whatsappcloud",
  "whatsappcloudapi",
  "whatsappbusinessapi",
  "metawhatsapp",
]);

/** Normalize a free-form platform string to its canonical comparison token. */
function normalizePlatformToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True when the given value resolves to a WhatsApp platform alias. */
function isWhatsAppPlatform(value: unknown): boolean {
  const token = normalizePlatformToken(value);
  return token !== null && WHATSAPP_ALIASES.has(token);
}

/** True when value is a non-empty string (after trimming). */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Recipients can come as: array, comma/semicolon-separated string, or `to`
 * field on the options. Returns the count of distinct, non-empty entries.
 * Used to detect broadcasts (count > 1) safely against missing/empty fields.
 */
function countRecipients(value: unknown): number {
  if (value == null) return 0;
  if (Array.isArray(value)) {
    return value.filter((v) => isNonEmptyString(v) || (typeof v === "object" && v !== null)).length;
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean).length;
  }
  return 0;
}

/** Safely read an object/record field; returns null if not a plain object. */
function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Inspect a /posts payload and return which credit action would be charged
 * (`wa_message_send`, `wa_broadcast_send`, or `null`) along with the precise
 * payload fields that drove the decision. Pure function — no I/O, no charging.
 *
 * Robust against:
 *  • Missing/null/undefined fields at any depth
 *  • Non-object / non-array values where objects/arrays are expected
 *  • Casing and aliases for the platform name (WhatsApp, WA, WABA, …)
 *  • Empty strings/arrays for broadcast signals (treated as absent)
 *  • Recipients delivered as arrays OR delimited strings
 */
export function classifyPostsAction(reqBody: unknown): {
  action: "wa_message_send" | "wa_broadcast_send" | null;
  isWhatsApp: boolean;
  detectedFields: string[];
  reason: string;
  shape: {
    hasPlatformsArray: boolean;
    waPlatformIndex: number | null;
    hasTopLevelWhatsappOptions: boolean;
    waOptionKeys: string[];
  };
} {
  const detected: string[] = [];
  const body = asObject(reqBody);
  if (!body) {
    return {
      action: null,
      isWhatsApp: false,
      detectedFields: [],
      reason: "Payload vazio ou inválido — nenhuma cobrança.",
      shape: { hasPlatformsArray: false, waPlatformIndex: null, hasTopLevelWhatsappOptions: false, waOptionKeys: [] },
    };
  }

  // Platforms array — defend against null entries and non-object items.
  const rawPlatforms = Array.isArray(body.platforms) ? (body.platforms as unknown[]) : [];
  const platforms = rawPlatforms.map((p) => asObject(p) ?? {});
  const waPlatformIndex = platforms.findIndex((p) => isWhatsAppPlatform(p.platform));
  const waPlatform = waPlatformIndex >= 0 ? platforms[waPlatformIndex] : null;

  // Top-level WhatsApp signals — accept several legacy field names.
  const topLevelWaOptions =
    asObject(body.whatsappOptions) ??
    asObject(body.whatsapp) ??
    asObject((body as Record<string, unknown>).waOptions) ??
    null;
  const topLevelHasWa = !!topLevelWaOptions || isWhatsAppPlatform(body.platform);

  if (waPlatform) {
    detected.push(`platforms[${waPlatformIndex}].platform="${String(platforms[waPlatformIndex].platform)}"`);
  }
  if (topLevelWaOptions) detected.push("body.whatsappOptions");
  if (!waPlatform && isWhatsAppPlatform(body.platform)) {
    detected.push(`body.platform="${String(body.platform)}"`);
  }

  const isWhatsApp = !!waPlatform || topLevelHasWa;
  const waOptions =
    asObject(waPlatform?.whatsappOptions) ??
    asObject(waPlatform?.whatsapp) ??
    topLevelWaOptions ??
    {};
  const waOptionKeys = Object.keys(waOptions);

  const shape = {
    hasPlatformsArray: Array.isArray(body.platforms),
    waPlatformIndex: waPlatformIndex >= 0 ? waPlatformIndex : null,
    hasTopLevelWhatsappOptions: !!topLevelWaOptions,
    waOptionKeys,
  };

  if (!isWhatsApp) {
    return {
      action: null,
      isWhatsApp: false,
      detectedFields: detected,
      reason:
        "Nenhum sinal de WhatsApp encontrado (sem platforms[].whatsapp, sem whatsappOptions e sem platform=whatsapp). /posts não cobra créditos para outras plataformas.",
      shape,
    };
  }

  // Broadcast signals — only count when fields are *meaningfully* present
  // (non-empty strings, recipients with >1 entry). Empty values never trigger
  // a broadcast charge.
  const broadcastSignals: string[] = [];
  if (isNonEmptyString(waOptions.broadcastId)) {
    broadcastSignals.push("whatsappOptions.broadcastId");
  }
  if (isNonEmptyString(waOptions.audienceId)) {
    broadcastSignals.push("whatsappOptions.audienceId");
  }
  const optsRecipientCount = countRecipients(waOptions.recipients);
  if (optsRecipientCount > 1) {
    broadcastSignals.push(`whatsappOptions.recipients[${optsRecipientCount}]`);
  }
  const bodyRecipientCount = countRecipients(body.recipients);
  if (bodyRecipientCount > 1) {
    broadcastSignals.push(`body.recipients[${bodyRecipientCount}]`);
  }
  if (isNonEmptyString(body.broadcastId)) {
    broadcastSignals.push("body.broadcastId");
  }
  if (isNonEmptyString(body.audienceId)) {
    broadcastSignals.push("body.audienceId");
  }

  if (broadcastSignals.length > 0) {
    return {
      action: "wa_broadcast_send",
      isWhatsApp: true,
      detectedFields: [...detected, ...broadcastSignals],
      reason: `Sinais de broadcast detectados: ${broadcastSignals.join(", ")}. Cobra wa_broadcast_send.`,
      shape,
    };
  }

  return {
    action: "wa_message_send",
    isWhatsApp: true,
    detectedFields: detected,
    reason:
      "WhatsApp detectado sem sinais de broadcast (sem broadcastId/audienceId/recipients[>1]). Cobra wa_message_send.",
    shape,
  };
}

/**
 * Retry fetch with **exponential backoff + jitter** for transient failures.
 *
 * Retries on:
 *  - Network errors (fetch throws — DNS, TCP reset, abort)
 *  - HTTP 429 (honors `Retry-After` when present, capped at 30s)
 *  - HTTP 5xx (server-side transient)
 *
 * Backoff schedule (base 500ms, factor 2, jitter ±25%, cap 8s):
 *   attempt 1 → ~500ms · attempt 2 → ~1s · attempt 3 → ~2s · attempt 4 → ~4s
 *
 * Idempotency: only retries non-mutating methods (GET/HEAD) automatically.
 * For POST/PATCH/DELETE we still retry 429/503 since the upstream did NOT
 * accept the request, but skip retry on generic 5xx to avoid double-sends.
 */
async function fetchWithRetry(
  url: string,
  opts: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  const method = (opts.method ?? "GET").toUpperCase();
  const isIdempotent = method === "GET" || method === "HEAD";
  let lastResp: Response | null = null;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, opts);

      // Success or non-retryable client error
      if (resp.status < 500 && resp.status !== 429) return resp;

      // 429 — always honor Retry-After even on POSTs (request was rejected, safe)
      if (resp.status === 429) {
        if (attempt >= maxRetries) return resp;
        const retryAfter = resp.headers.get("Retry-After");
        const waitMs = retryAfter
          ? Math.min(parseInt(retryAfter, 10) * 1000, 30_000)
          : computeBackoff(attempt);
        console.log(`[late-proxy] 429 received, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(waitMs);
        continue;
      }

      // 5xx — only auto-retry idempotent + 503 (upstream definitely didn't process)
      lastResp = resp;
      const shouldRetry = isIdempotent || resp.status === 503;
      if (!shouldRetry || attempt >= maxRetries) return resp;
      const waitMs = computeBackoff(attempt);
      console.log(`[late-proxy] ${resp.status} received, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(waitMs);
    } catch (err) {
      // Network-level failure (TCP/DNS/abort). Always retry idempotent calls.
      lastErr = err;
      if (!isIdempotent || attempt >= maxRetries) throw err;
      const waitMs = computeBackoff(attempt);
      console.warn(`[late-proxy] network error, retrying in ${waitMs}ms:`, (err as Error).message);
      await sleep(waitMs);
    }
  }

  if (lastResp) return lastResp;
  throw lastErr ?? new Error("fetchWithRetry exhausted retries");
}

function computeBackoff(attempt: number): number {
  const base = 500;
  const exp = base * Math.pow(2, attempt); // 500, 1000, 2000, 4000…
  const capped = Math.min(exp, 8_000);
  // ±25% jitter to avoid thundering herd
  const jitter = capped * 0.25 * (Math.random() * 2 - 1);
  return Math.round(capped + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Check if this is an inbox route that needs filtering */
export function isInboxRoute(routePath: string): boolean {
  return routePath.startsWith("/inbox/");
}

/** Check if a route targets a specific accountId (already scoped) */
export function extractAccountIdFromRoute(route: string): string | null {
  const match = route.match(/[?&]accountId=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Redact user-generated content from request bodies before persisting to
 * `whatsapp_proxy_logs`. Keeps structural/diagnostic fields (accountId,
 * platform, recipient phone, template name) but blanks free-form text the
 * user typed (message body, captions, story replies). Privacy-preserving.
 *
 * Configurável via env vars:
 *  • `LATE_PROXY_REDACT_FIELDS_EXTRA="field1,field2"` — adiciona campos à lista
 *    padrão (caso novos canais introduzam novos nomes de campo de conteúdo).
 *  • `LATE_PROXY_REDACT_FIELDS_OVERRIDE="msg,note"` — substitui a lista inteira
 *    (use com cuidado; o fallback seguro nunca é menor que `DEFAULT_*`).
 *
 * Fallback de segurança: se a env var contiver lixo (apenas vírgulas/espaços)
 * ou uma OVERRIDE vazia, voltamos à lista DEFAULT — preferimos sobre-redigir
 * a sub-redigir.
 */
export const DEFAULT_SENSITIVE_BODY_FIELDS: ReadonlyArray<string> = [
  "message",
  "text",
  "content",
  "caption",
  "body",
  "comment",
  "reply",
];

/** Parse comma-separated env var → trimmed lowercase list (deduped). */
function parseFieldList(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0 && s.length <= 64),
    ),
  );
}

/**
 * Resolve the active redaction set from env, applying the safe fallback.
 * Pure function — exported for tests so we can validate every override branch.
 */
export function resolveSensitiveBodyFields(env: {
  extra?: string;
  override?: string;
}): Set<string> {
  const overrideList = parseFieldList(env.override);
  if (overrideList.length > 0) {
    // Override mode: use exactly what the operator specified, but still
    // keep DEFAULT as a *floor* — we never let an operator accidentally
    // disable redaction of known-sensitive fields.
    return new Set([...DEFAULT_SENSITIVE_BODY_FIELDS, ...overrideList]);
  }
  const extraList = parseFieldList(env.extra);
  return new Set([...DEFAULT_SENSITIVE_BODY_FIELDS, ...extraList]);
}

export const SENSITIVE_BODY_FIELDS: Set<string> = resolveSensitiveBodyFields({
  extra: Deno.env.get("LATE_PROXY_REDACT_FIELDS_EXTRA") ?? undefined,
  override: Deno.env.get("LATE_PROXY_REDACT_FIELDS_OVERRIDE") ?? undefined,
});

/**
 * Redact a payload using the given field set (defaults to the active
 * SENSITIVE_BODY_FIELDS). Accepting an explicit set makes the function
 * trivially testable across configuration scenarios without env mutation.
 */
export function redactSensitiveBody(
  input: unknown,
  fields: Set<string> = SENSITIVE_BODY_FIELDS,
): unknown {
  if (input == null) return input;
  if (Array.isArray(input)) return input.map((v) => redactSensitiveBody(v, fields));
  if (typeof input !== "object") return input;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (fields.has(k) && typeof v === "string") {
      out[k] = `[REDACTED:${v.length}]`;
    } else if (v && typeof v === "object") {
      out[k] = redactSensitiveBody(v, fields);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const handleRequest = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LATE_API_KEY = Deno.env.get("LATE_API_KEY");

    // Parse request body early so we can short-circuit __health without auth
    let parsed: { route?: string; method?: string; body?: unknown; workspace_id?: string } = {};
    try {
      parsed = await req.json();
    } catch {
      parsed = {};
    }
    const { route, method = "GET", body: reqBody, workspace_id } = parsed as {
      route?: string;
      method?: string;
      body?: Record<string, unknown>;
      workspace_id?: string;
    };

    // ── Health probe: validates server-side credentials presence (no upstream call). ──
    // Used by the client at startup to surface a clear notification when the
    // Zernio API key is missing/misconfigured before any send is attempted.
    if (route === "__health") {
      const ok = !!LATE_API_KEY && LATE_API_KEY.trim().length >= 10;
      return new Response(
        JSON.stringify(
          ok
            ? { ok: true, code: "ok" }
            : { error: "Zernio API key não configurada no servidor", code: "missing_api_key", status: 503, retryable: false },
        ),
        {
          status: ok ? 200 : 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Classify action (dry-run): inspects a /posts payload and returns the
    // credit action that would be charged plus the exact fields that drove the
    // decision. Pure — no upstream call, no charging, no logging. Useful for
    // the UI to preview wa_message_send vs wa_broadcast_send before sending.
    if (route === "__classify_action") {
      const inspected = (parsed as { body?: unknown }).body ?? null;
      const result = classifyPostsAction(inspected);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Route verifier: probes upstream Zernio for the existence of one or more
    // candidate paths (e.g. /posts, /whatsapp/send) by issuing a HEAD then
    // falling back to GET. Returns per-route status so the UI can confirm the
    // canonical send route before attempting an actual message send.
    if (route === "__verify_route") {
      if (!LATE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "missing_api_key", code: "missing_api_key" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const candidates = Array.isArray((parsed as { body?: { candidates?: unknown } }).body?.candidates)
        ? ((parsed as { body: { candidates: unknown[] } }).body.candidates.filter((c) => typeof c === "string") as string[])
        : ["/posts"];

      const checks = await Promise.all(
        candidates.map(async (candidate) => {
          const probeUrl = `${LATE_BASE}${candidate.startsWith("/") ? candidate : "/" + candidate}`;
          try {
            let probe = await fetch(probeUrl, {
              method: "HEAD",
              headers: { Authorization: `Bearer ${LATE_API_KEY}` },
            });
            if (probe.status === 405 || probe.status === 501) {
              probe = await fetch(probeUrl, {
                method: "GET",
                headers: { Authorization: `Bearer ${LATE_API_KEY}` },
              });
            }
            return {
              route: candidate,
              status: probe.status,
              exists: probe.status !== 404,
            };
          } catch (err) {
            return {
              route: candidate,
              status: 0,
              exists: false,
              error: (err as Error).message,
            };
          }
        }),
      );

      return new Response(JSON.stringify({ checks }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!LATE_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "Zernio API key não configurada no servidor",
          code: "missing_api_key",
          status: 503,
          retryable: false,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    // Test-only bypass: local JWT payload decode (NEVER set in production).
    if (Deno.env.get("LATE_PROXY_TEST_MODE") === "1") {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        userId = payload.sub as string;
        if (!userId) throw new Error("missing sub");
      } catch {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
    }

    if (!route) throw new Error("Missing 'route'");


    const routePath = route.split("?")[0];

    // ── SECURITY: Build user's allowed account IDs set ──────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let allowedAccountIds: Set<string> | null = null;

    // For inbox and social routes, load user's social accounts for filtering
    if (isInboxRoute(routePath) || routePath.startsWith("/accounts") || routePath.startsWith("/posts")) {
      const { data: userAccounts } = await supabaseAdmin
        .from("social_accounts")
        .select("late_account_id")
        .eq("user_id", userId);

      allowedAccountIds = new Set(
        (userAccounts || []).map((a: { late_account_id: string }) => a.late_account_id).filter(Boolean)
      );

      // If user has no social accounts, return empty data for inbox
      if (allowedAccountIds.size === 0 && isInboxRoute(routePath)) {
        return new Response(JSON.stringify({ data: [], conversations: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── SECURITY: Validate accountId in route belongs to user ────────────
      const routeAccountId = extractAccountIdFromRoute(route);
      if (routeAccountId && !allowedAccountIds.has(routeAccountId)) {
        console.warn(`[late-proxy] BLOCKED: User ${userId} tried to access accountId ${routeAccountId} they don't own`);
        return new Response(JSON.stringify({ error: "Forbidden: account does not belong to you" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── SECURITY: Inbox routes MUST be scoped to a specific accountId.
      // EXCEÇÃO (allowlist): `/inbox/conversations` (listagem global) é
      // permitida sem accountId, pois a resposta é filtrada server-side
      // contra `allowedAccountIds` (ver bloco em ~L810). Isso mantém o
      // contrato com `useLateProxy.ACCOUNT_OPTIONAL_ROUTES`.
      const inboxAccountOptional = routePath === "/inbox/conversations";
      if (isInboxRoute(routePath) && !routeAccountId && !inboxAccountOptional) {
        console.warn(`[late-proxy] BLOCKED: inbox route ${routePath} missing accountId for user ${userId}`);
        return new Response(
          JSON.stringify({
            error: "accountId é obrigatório para rotas /inbox/",
            code: "missing_account_id",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Social routes (non-WhatsApp) require active social subscription
    const isSocialRoute = !routePath.startsWith("/whatsapp/") && !routePath.startsWith("/connect/whatsapp");
    if (isSocialRoute && workspace_id) {
      const { data: sub } = await supabaseAdmin
        .from("social_subscriptions")
        .select("status")
        .eq("user_id", userId)
        .eq("workspace_id", workspace_id)
        .single();

      if (!sub || !["active", "grace"].includes(sub.status)) {
        return new Response(
          JSON.stringify({
            error: "social_subscription_required",
            message: "Ative o plano de Redes Sociais para usar este recurso",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Deduct credits (only WhatsApp actions have credits now)
    let action = creditAction(routePath, method);

    // ── /posts WhatsApp detection: covers all WhatsApp variations ──────────
    // Delegates to classifyPostsAction (single source of truth, also exposed
    // via the __classify_action dry-run route for UI preview).
    if (!action && routePath.startsWith("/posts") && method === "POST" && reqBody) {
      action = classifyPostsAction(reqBody).action;
    }

    if (action) {
      const cr = await deductCredits(userId, action);
      if (!cr.success) return insufficientCreditsResponse(corsHeaders, cr.error!);
    }

    // Proxy to Late API with retry
    const url = `${LATE_BASE}${route.startsWith("/") ? route : "/" + route}`;
    const fetchOpts: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${LATE_API_KEY}`,
        "Content-Type": "application/json",
      },
    };
    if (reqBody && method !== "GET") {
      fetchOpts.body = JSON.stringify(reqBody);
    }

    const startedAt = Date.now();
    const resp = await fetchWithRetry(url, fetchOpts);
    const data = await resp.text();
    const durationMs = Date.now() - startedAt;

    // ── Diagnostic logging for WhatsApp-related routes (incl. /posts sends) ──
    const isWhatsAppRoute =
      routePath.startsWith("/whatsapp/") ||
      routePath.startsWith("/connect/whatsapp") ||
      action === "wa_message_send" ||
      action === "wa_broadcast_send";
    if (isWhatsAppRoute) {
      let parsedResponse: unknown = null;
      try {
        parsedResponse = JSON.parse(data);
      } catch {
        parsedResponse = null;
      }
      // Truncate to keep rows compact
      const truncatedText = data.length > 8000 ? data.slice(0, 8000) + "…[truncated]" : data;
      const errorCode =
        resp.status >= 400
          ? (parsedResponse as { code?: string } | null)?.code ?? mapStatusToCode(resp.status)
          : null;
      // Fire-and-forget: do not block the response on logging.
      // request_body is redacted to avoid persisting raw user-typed content
      // (message text, captions, replies) — see SENSITIVE_BODY_FIELDS.
      void supabaseAdmin
        .from("whatsapp_proxy_logs")
        .insert({
          user_id: userId,
          workspace_id: workspace_id ?? null,
          route_path: routePath,
          external_url: url,
          method,
          request_body: redactSensitiveBody(reqBody ?? null) as unknown,
          response_status: resp.status,
          response_body: parsedResponse,
          response_text: parsedResponse ? null : truncatedText,
          duration_ms: durationMs,
          error_code: errorCode,
          action: action ?? null,
        })
        .then(({ error }) => {
          if (error) console.warn("[late-proxy] log insert failed:", error.message);
        });
    }


    // Forward rate limit headers if present
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": "application/json",
    };
    const rlRemaining = resp.headers.get("X-RateLimit-Remaining");
    const rlReset = resp.headers.get("X-RateLimit-Reset");
    if (rlRemaining) responseHeaders["X-RateLimit-Remaining"] = rlRemaining;
    if (rlReset) responseHeaders["X-RateLimit-Reset"] = rlReset;

    // Graceful fallback for non-critical endpoints
    if (resp.status >= 400 && routePath.includes("/gmb-food-menus")) {
      return new Response(JSON.stringify({ menus: [] }), {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Detect HTML responses
    const contentType = resp.headers.get("content-type") || "";
    const isHtml = contentType.includes("text/html") || data.trimStart().startsWith("<!DOCTYPE") || data.trimStart().startsWith("<html");

    // Parse error for better messaging on 4xx
    if (resp.status >= 400 && resp.status < 500) {
      if (isHtml) {
        return new Response(
          JSON.stringify({
            error: `Rota não encontrada na API externa (${resp.status})`,
            code: "route_not_found",
            status: resp.status,
            route: routePath,
          }),
          { status: resp.status, headers: responseHeaders },
        );
      }
      try {
        const parsed = JSON.parse(data);
        const errorMsg = parsed.error ?? parsed.message ?? `Erro da API (${resp.status})`;
        let code = parsed.code ?? mapStatusToCode(resp.status);
        // Upstream 401/403 means OUR server-side LATE_API_KEY is invalid/expired
        // (the user-side auth already passed before reaching here).
        if (resp.status === 401 || resp.status === 403) code = "invalid_api_key";
        return new Response(
          JSON.stringify({ error: errorMsg, code, status: resp.status, details: parsed.details }),
          { status: resp.status, headers: responseHeaders },
        );
      } catch {
        const code =
          resp.status === 401 || resp.status === 403
            ? "invalid_api_key"
            : mapStatusToCode(resp.status);
        return new Response(
          JSON.stringify({ error: `Erro da API (${resp.status})`, code, status: resp.status }),
          { status: resp.status, headers: responseHeaders },
        );
      }
    }

    // Guard 5xx — even after retry, upstream is still down
    if (resp.status >= 500) {
      return new Response(
        JSON.stringify({
          error: `Erro do servidor externo (${resp.status})`,
          code: "upstream_unavailable",
          status: resp.status,
          retryable: true,
        }),
        { status: 502, headers: responseHeaders },
      );
    }

    // ── SECURITY: Filter inbox responses to only show user's accounts ──────
    if (allowedAccountIds && allowedAccountIds.size > 0 && isInboxRoute(routePath) && routePath === "/inbox/conversations") {
      try {
        const parsed = JSON.parse(data);
        const rawConvos = parsed.data || parsed.conversations || [];
        if (Array.isArray(rawConvos)) {
          const filtered = rawConvos.filter((c: Record<string, unknown>) =>
            allowedAccountIds!.has(c.accountId as string)
          );
          const result = parsed.data ? { ...parsed, data: filtered } : { ...parsed, conversations: filtered };
          console.log(`[late-proxy] Inbox filtered: ${rawConvos.length} → ${filtered.length} conversations for user ${userId}`);
          return new Response(JSON.stringify(result), {
            status: resp.status,
            headers: responseHeaders,
          });
        }
      } catch {
        // If parse fails, return as-is
      }
    }

    // Filter posts/accounts responses too
    if (allowedAccountIds && allowedAccountIds.size > 0 && routePath.startsWith("/accounts")) {
      try {
        const parsed = JSON.parse(data);
        const rawAccounts = Array.isArray(parsed) ? parsed : (parsed.data || parsed.accounts || []);
        if (Array.isArray(rawAccounts)) {
          const filtered = rawAccounts.filter((a: Record<string, unknown>) =>
            allowedAccountIds!.has(a.id as string) || allowedAccountIds!.has(a._id as string)
          );
          const result = Array.isArray(parsed) ? filtered : (parsed.data ? { ...parsed, data: filtered } : { ...parsed, accounts: filtered });
          return new Response(JSON.stringify(result), {
            status: resp.status,
            headers: responseHeaders,
          });
        }
      } catch {
        // pass through
      }
    }

    return new Response(data, {
      status: resp.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error("late-proxy error:", err);
    const isAbort = err?.name === "AbortError";
    const isNetwork = /network|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND/i.test(err?.message ?? "");
    return new Response(
      JSON.stringify({
        error: err.message ?? "Erro interno do proxy",
        code: isAbort ? "timeout" : isNetwork ? "network_error" : "proxy_error",
        retryable: isAbort || isNetwork,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
};

if (Deno.env.get("LATE_PROXY_TEST_MODE") !== "1") {
  Deno.serve(handleRequest);
}

/** Map upstream HTTP status to a stable, machine-readable code for the client. */
function mapStatusToCode(status: number): string {
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthorized";
  if (status === 402) return "insufficient_credits";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 408) return "timeout";
  if (status === 409) return "conflict";
  if (status === 422) return "validation_error";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_unavailable";
  return "api_error";
}
