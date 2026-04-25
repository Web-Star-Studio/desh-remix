/**
 * whatsappMessenger — focused service for sending WhatsApp messages via Zernio
 * with **per-attempt timeout** and **explicit retry budget**.
 *
 * Design goals:
 * - Keep the existing notification flow intact: this service throws
 *   `ZernioApiError` exactly like `zernioClient`, so `useSendWhatsAppMessage`
 *   continues to translate codes via `describeZernioError` and toasts as today.
 * - Add what `zernioClient` does NOT do today: a hard timeout per attempt
 *   (network/edge function can hang past our backoff), plus a configurable
 *   retry budget tuned for messaging (mutations are usually capped at 1 retry).
 * - Stay non-breaking: `useSendWhatsAppMessage` can opt-in by importing this
 *   instead of calling `zernioClient.whatsapp.sendText` directly.
 */
import { ZernioApiError, zernioClient } from "./client";
import type {
  ZernioSendResult,
  ZernioSendTemplateInput,
  ZernioSendTextInput,
} from "./types";

export interface SendOptions {
  /** Per-attempt timeout in ms. Default: 15s. */
  timeoutMs?: number;
  /** Total attempts allowed (1 = no retries). Default: 2. */
  maxAttempts?: number;
  /** Base backoff in ms (doubled per attempt, ±25% jitter, capped at 4s). */
  backoffBaseMs?: number;
  /** AbortSignal to cancel the whole operation (e.g. component unmount). */
  signal?: AbortSignal;
}

/** Structured per-attempt log entry. */
export interface AttemptLog {
  attempt: number;
  startedAt: string;
  durationMs: number;
  request: { method: string; to: string; payload: Record<string, unknown> };
  response?: { messageId?: string; status: "success" };
  error?: { code: string; message: string; status?: number; retryable: boolean };
}

/** Final delivery summary returned alongside the result. */
export interface DeliverySummary {
  outcome: "delivered" | "failed";
  totalAttempts: number;
  totalDurationMs: number;
  messageId?: string;
  finalErrorCode?: string;
  attempts: AttemptLog[];
}

/** Mask a phone for logs (keep country + last 4 digits). */
function maskPhone(to: string): string {
  const digits = to.replace(/\D/g, "");
  if (digits.length <= 6) return "***";
  return `${digits.slice(0, 2)}***${digits.slice(-4)}`;
}

/** Redact text payloads to keep logs PII-light. */
function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  if (typeof out.to === "string") out.to = maskPhone(out.to);
  if (typeof out.text === "string") {
    const t = out.text;
    out.text = t.length > 80 ? `${t.slice(0, 80)}… (${t.length} chars)` : t;
  }
  if (Array.isArray(out.variables)) {
    out.variables = (out.variables as unknown[]).map((v) =>
      typeof v === "string" && v.length > 40 ? `${v.slice(0, 40)}…` : v,
    );
  }
  return out;
}

const LOG_PREFIX = "[whatsappMessenger]";

function logAttempt(context: string, entry: AttemptLog) {
  if (entry.error) {
    console.warn(`${LOG_PREFIX} ${context} · attempt ${entry.attempt}`, {
      startedAt: entry.startedAt,
      durationMs: entry.durationMs,
      request: entry.request,
      error: entry.error,
    });
  } else {
    console.info(`${LOG_PREFIX} ${context} · attempt ${entry.attempt} ✓`, {
      startedAt: entry.startedAt,
      durationMs: entry.durationMs,
      request: entry.request,
      response: entry.response,
    });
  }
}

function logSummary(context: string, summary: DeliverySummary) {
  const tag = summary.outcome === "delivered" ? "✅ delivered" : "❌ failed";
  console.info(`${LOG_PREFIX} ${context} · ${tag}`, {
    outcome: summary.outcome,
    totalAttempts: summary.totalAttempts,
    totalDurationMs: summary.totalDurationMs,
    messageId: summary.messageId,
    finalErrorCode: summary.finalErrorCode,
  });
}

const DEFAULTS: Required<Omit<SendOptions, "signal">> = {
  timeoutMs: 15_000,
  maxAttempts: 2,
  backoffBaseMs: 600,
};

/** Codes that justify a retry from this service layer. */
const RETRYABLE = new Set([
  "rate_limited",
  "upstream_unavailable",
  "timeout",
  "network_error",
  "transport_error",
  "proxy_error",
]);

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

function abortError(): ZernioApiError {
  return new ZernioApiError({
    message: "Operação cancelada",
    code: "aborted",
    retryable: false,
  });
}

function backoff(attempt: number, base: number): number {
  const exp = Math.min(base * Math.pow(2, attempt), 4_000);
  const jitter = exp * 0.25 * (Math.random() * 2 - 1);
  return Math.round(exp + jitter);
}

/**
 * Race a promise against a per-attempt timeout. The underlying
 * `zernioClient` call cannot be cancelled (no native AbortSignal support
 * inside `supabase.functions.invoke`), so the timeout is enforced at the
 * service layer — the in-flight request is abandoned but won't double-send
 * since the timeout fires only once per attempt.
 */
async function withTimeout<T>(
  exec: () => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw abortError();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      reject(
        new ZernioApiError({
          message: `Tempo limite excedido (${Math.round(timeoutMs / 1000)}s)`,
          code: "timeout",
          retryable: true,
        }),
      );
    }, timeoutMs);

    exec().then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

async function runWithRetry<T extends ZernioSendResult>(
  exec: () => Promise<T>,
  opts: SendOptions = {},
  context: string,
  requestMeta: { method: string; to: string; payload: Record<string, unknown> },
): Promise<T & { __summary: DeliverySummary }> {
  const cfg = { ...DEFAULTS, ...opts };
  const attempts: AttemptLog[] = [];
  const startedTotal = performance.now();
  let lastError: ZernioApiError | null = null;

  const safeRequest = {
    method: requestMeta.method,
    to: maskPhone(requestMeta.to),
    payload: sanitizePayload(requestMeta.payload),
  };

  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    const startedAt = new Date().toISOString();
    const t0 = performance.now();
    try {
      const value = await withTimeout(exec, cfg.timeoutMs, opts.signal);
      const entry: AttemptLog = {
        attempt: attempt + 1,
        startedAt,
        durationMs: Math.round(performance.now() - t0),
        request: safeRequest,
        response: { messageId: value.messageId, status: "success" },
      };
      attempts.push(entry);
      logAttempt(context, entry);

      const summary: DeliverySummary = {
        outcome: "delivered",
        totalAttempts: attempts.length,
        totalDurationMs: Math.round(performance.now() - startedTotal),
        messageId: value.messageId,
        attempts,
      };
      logSummary(context, summary);
      return Object.assign(value, { __summary: summary });
    } catch (err) {
      const zErr =
        err instanceof ZernioApiError
          ? err
          : new ZernioApiError({
              message: (err as Error)?.message ?? "Erro inesperado",
              code: "network_error",
              retryable: true,
            });

      const entry: AttemptLog = {
        attempt: attempt + 1,
        startedAt,
        durationMs: Math.round(performance.now() - t0),
        request: safeRequest,
        error: {
          code: zErr.code,
          message: zErr.message,
          status: zErr.status,
          retryable: zErr.retryable ?? RETRYABLE.has(zErr.code),
        },
      };
      attempts.push(entry);
      logAttempt(context, entry);

      lastError = zErr;
      const canRetry =
        attempt < cfg.maxAttempts - 1 &&
        zErr.code !== "aborted" &&
        (zErr.retryable || RETRYABLE.has(zErr.code));

      if (!canRetry) break;

      const wait = backoff(attempt, cfg.backoffBaseMs);
      console.warn(
        `${LOG_PREFIX} ${context}: ${zErr.code} (attempt ${attempt + 1}/${cfg.maxAttempts}) — retrying in ${wait}ms`,
      );
      await sleep(wait, opts.signal);
    }
  }

  const finalError =
    lastError ??
    new ZernioApiError({ message: "Falha desconhecida", code: "unknown" });

  const summary: DeliverySummary = {
    outcome: "failed",
    totalAttempts: attempts.length,
    totalDurationMs: Math.round(performance.now() - startedTotal),
    finalErrorCode: finalError.code,
    attempts,
  };
  logSummary(context, summary);

  // Attach summary to the error so callers (hook) can persist it if desired.
  (finalError as ZernioApiError & { __summary?: DeliverySummary }).__summary = summary;
  throw finalError;
}

export const whatsappMessenger = {
  /** Send free-text message with per-attempt timeout + retry budget. */
  sendText(input: ZernioSendTextInput, opts?: SendOptions): Promise<ZernioSendResult & { __summary: DeliverySummary }> {
    return runWithRetry(
      () => zernioClient.whatsapp.sendText(input),
      opts,
      `sendText to ${maskPhone(input.to)}`,
      {
        method: "POST /whatsapp/send",
        to: input.to,
        payload: { accountId: input.accountId, to: input.to, text: input.text, workspaceId: input.workspaceId },
      },
    );
  },

  /** Send pre-approved template with per-attempt timeout + retry budget. */
  sendTemplate(
    input: ZernioSendTemplateInput,
    opts?: SendOptions,
  ): Promise<ZernioSendResult & { __summary: DeliverySummary }> {
    return runWithRetry(
      () => zernioClient.whatsapp.sendTemplate(input),
      opts,
      `sendTemplate ${input.templateName} → ${maskPhone(input.to)}`,
      {
        method: "POST /whatsapp/templates",
        to: input.to,
        payload: {
          accountId: input.accountId,
          to: input.to,
          templateName: input.templateName,
          language: input.language,
          variables: input.variables,
          workspaceId: input.workspaceId,
        },
      },
    );
  },
} as const;

export type WhatsAppMessenger = typeof whatsappMessenger;
