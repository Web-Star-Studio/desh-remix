/**
 * Zernio API typed contracts.
 *
 * Single source of truth for inputs and outputs across the Zernio integration
 * (`zernioClient`, `useSendWhatsAppMessage`, broadcast/contact hooks).
 *
 * These mirror the shape of the official Zernio REST API. The legacy WABA*
 * interfaces live here (instead of inside the hook) to avoid a circular
 * dependency between the hooks layer and this types module — `useZernioWhatsApp`
 * re-exports them for backwards compatibility.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Legacy WABA* surface (kept for backwards compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export interface WABATemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: any[];
}

export interface WABABroadcast {
  id: string;
  name: string;
  status: string;
  recipientCount?: number;
  sent?: number;
  failed?: number;
  scheduledAt?: string;
  createdAt?: string;
}

export interface WABAContact {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  tags?: string[];
  groups?: string[];
  optedIn?: boolean;
}

export interface WABABusinessProfile {
  about?: string;
  description?: string;
  email?: string;
  websites?: string[];
  address?: string;
  profilePictureUrl?: string;
}

export interface WABAPhoneNumber {
  id: string;
  phoneNumber: string;
  displayName?: string;
  status: string;
  qualityRating?: string;
  verifiedName?: string;
}

export interface WABAAccount {
  id: string;
  accountId: string;
  platform: string;
  status: string;
  name?: string;
  phoneNumber?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/** E.164-formatted phone number (e.g. "+5511999999999"). */
export type ZernioPhone = string;

/** ISO-8601 timestamp string. */
export type ZernioISODate = string;

/** Sender identification for any Zernio call. */
export interface ZernioBaseInput {
  /** WABA accountId returned by Zernio (NOT the Supabase row id). */
  accountId: string;
  /** Workspace scope, forwarded to the proxy for isolation/credit metering. */
  workspaceId?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified result envelope (WABAResult)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical `{ data, error, errorInfo }` envelope used by every WhatsApp/
 * Zernio hook. Designed to be backwards compatible with the historical
 * `{ data, error }` shape — `error` is still a plain string (or `null`) so
 * existing JSX like `{result.error && <p>{result.error}</p>}` keeps working.
 *
 * New code that needs to branch on a stable error code (rate_limited,
 * insufficient_credits, missing_api_key, validation_error…) should read
 * `errorInfo`, which mirrors `ZernioApiError`.
 *
 * Invariants:
 *   • `error === null`      ⇔ `errorInfo === null` ⇔ `data !== null`
 *   • `error !== null`      ⇔ `errorInfo !== null` ⇔ `data === null`
 */
export interface WABAResultError {
  message: string;
  code: string;
  status?: number;
  retryable?: boolean;
  details?: unknown;
}

export interface WABAResult<T> {
  data: T | null;
  /** Plain user-facing message (or `null`). Safe to render directly in JSX. */
  error: string | null;
  /** Structured error metadata. `null` on success. */
  errorInfo: WABAResultError | null;
}

/** Build a success envelope. */
export function okResult<T>(data: T): WABAResult<T> {
  return { data, error: null, errorInfo: null };
}

/** Build a failure envelope from a string or partial error description. */
export function errResult<T = never>(error: WABAResultError | string): WABAResult<T> {
  const info: WABAResultError =
    typeof error === "string" ? { message: error, code: "unknown" } : error;
  return { data: null, error: info.message, errorInfo: info };
}

/**
 * Convert any thrown value into a `WABAResultError`. Recognises:
 *   • `ZernioApiError` (preserves code/status/retryable/details)
 *   • Standard `Error` (code: "unknown")
 *   • Anything else (stringified)
 */
export function toWABAError(err: unknown): WABAResultError {
  // Structural-typed to avoid a circular import with `client.ts`.
  if (
    err &&
    typeof err === "object" &&
    "code" in err &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    const e = err as {
      message: string;
      code: string;
      status?: number;
      retryable?: boolean;
      details?: unknown;
    };
    return {
      message: e.message,
      code: e.code ?? "unknown",
      status: e.status,
      retryable: e.retryable,
      details: e.details,
    };
  }
  if (err instanceof Error) {
    return { message: err.message || "Erro desconhecido", code: "unknown" };
  }
  return { message: String(err ?? "Erro desconhecido"), code: "unknown" };
}

/** Wrap a throwing async function into a `WABAResult` envelope. */
export async function wrapResult<T>(promise: Promise<T>): Promise<WABAResult<T>> {
  try {
    return okResult(await promise);
  } catch (err) {
    return errResult<T>(toWABAError(err));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Messages
// ─────────────────────────────────────────────────────────────────────────────

export type ZernioMessageType = "text" | "template" | "image" | "document" | "audio" | "video";

export type ZernioMessageDirection = "inbound" | "outbound";

export type ZernioMessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "expired";

/** Canonical representation of a WhatsApp message returned by Zernio. */
export interface ZernioMessage {
  id: string;
  accountId: string;
  conversationId?: string;
  contactId?: string;
  from: ZernioPhone;
  to: ZernioPhone;
  type: ZernioMessageType;
  direction: ZernioMessageDirection;
  status: ZernioMessageStatus;
  text?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: string[];
  errorCode?: string;
  errorMessage?: string;
  createdAt: ZernioISODate;
  updatedAt?: ZernioISODate;
}

/** Free-text send (allowed only inside the 24h conversation window). */
export interface ZernioSendTextInput extends ZernioBaseInput {
  to: ZernioPhone;
  text: string;
}

/** Pre-approved template send (works outside the 24h window). */
export interface ZernioSendTemplateInput extends ZernioBaseInput {
  to: ZernioPhone;
  templateName: string;
  language: string;
  /** Variable values in the order required by the template. */
  variables?: string[];
}

/** Media (image/document/audio/video) send. */
export interface ZernioSendMediaInput extends ZernioBaseInput {
  to: ZernioPhone;
  mediaUrl: string;
  mediaType: Exclude<ZernioMessageType, "text" | "template">;
  caption?: string;
  fileName?: string;
}

/** Discriminated union of all supported send payloads. */
export type ZernioSendInput =
  | ({ kind: "text" } & ZernioSendTextInput)
  | ({ kind: "template" } & ZernioSendTemplateInput)
  | ({ kind: "media" } & ZernioSendMediaInput);

export interface ZernioSendResult {
  /** Provider-side message ID (use to dedupe). */
  messageId?: string;
  /** Initial status reported by upstream, when present. */
  status?: ZernioMessageStatus;
  /** Raw response surface for debugging. */
  raw?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

export type ZernioTemplateStatus = "approved" | "pending" | "rejected" | "paused" | "disabled";

export type ZernioTemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export interface ZernioTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: { body_text?: string[][]; header_text?: string[] };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface ZernioTemplate {
  id: string;
  accountId: string;
  name: string;
  language: string;
  status: ZernioTemplateStatus;
  category: ZernioTemplateCategory;
  components?: ZernioTemplateComponent[];
  createdAt?: ZernioISODate;
  updatedAt?: ZernioISODate;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────────────────────────────────────────

export interface ZernioContact {
  id: string;
  accountId: string;
  phone: ZernioPhone;
  name?: string;
  profilePictureUrl?: string;
  tags?: string[];
  /** Whether the contact is currently inside the 24h conversation window. */
  inSession?: boolean;
  /** When the 24h session window expires (if applicable). */
  sessionExpiresAt?: ZernioISODate;
  createdAt?: ZernioISODate;
  updatedAt?: ZernioISODate;
}

export interface ZernioContactImportInput extends ZernioBaseInput {
  contacts: Array<{ phone: ZernioPhone; name?: string; tags?: string[] }>;
}

export interface ZernioContactImportResult {
  imported: number;
  skipped: number;
  errors?: Array<{ phone: ZernioPhone; reason: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Broadcasts
// ─────────────────────────────────────────────────────────────────────────────

export type ZernioBroadcastStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "canceled";

export interface ZernioBroadcastStats {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface ZernioBroadcast {
  id: string;
  accountId: string;
  name: string;
  status: ZernioBroadcastStatus;
  templateName: string;
  templateLanguage: string;
  variables?: string[];
  audienceTags?: string[];
  audienceContactIds?: string[];
  scheduledFor?: ZernioISODate;
  stats?: ZernioBroadcastStats;
  createdAt: ZernioISODate;
  updatedAt?: ZernioISODate;
}

export interface ZernioCreateBroadcastInput extends ZernioBaseInput {
  name: string;
  templateName: string;
  templateLanguage: string;
  variables?: string[];
  /** Either filter by tags OR pass explicit contact ids. */
  audienceTags?: string[];
  audienceContactIds?: string[];
  scheduledFor?: ZernioISODate;
}

export interface ZernioSendBroadcastInput extends ZernioBaseInput {
  broadcastId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/** Stable, machine-readable error codes returned by `late-proxy`. */
export type ZernioErrorCode =
  | "rate_limited"
  | "upstream_unavailable"
  | "timeout"
  | "aborted"
  | "network_error"
  | "transport_error"
  | "proxy_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "bad_request"
  | "insufficient_credits"
  | "missing_api_key"
  | "invalid_api_key"
  | "api_error"
  | "unknown";

export interface ZernioErrorPayload {
  status?: number;
  code: ZernioErrorCode | string;
  message: string;
  retryable?: boolean;
  details?: unknown;
}
