/**
 * Zernio — input normalization helpers.
 *
 * Garante que todo `ZernioPhone` enviado ao proxy esteja em E.164
 * (`+<country><number>`, apenas dígitos após o `+`) e que todo
 * `ZernioISODate` seja uma string ISO-8601 válida em UTC.
 *
 * Estes helpers NÃO fazem chamadas — são puros e seguros para uso em qualquer
 * camada (UI, hooks, edge wrappers). Quando o input não puder ser normalizado,
 * uma `ZernioValidationError` é lançada com `code = "validation_error"`, no
 * mesmo formato que o `late-proxy` retornaria.
 *
 * Convenções:
 *   • Default country code é `55` (Brasil) — pode ser sobrescrito por chamada.
 *   • Aceita inputs com `+`, `00`, espaços, `-`, `(`, `)` e `.` como ruído.
 *   • Para BR, normaliza celulares antigos sem o `9` adicionado, quando
 *     possível detectar pelo DDD + tamanho.
 */

import { ZernioApiError } from "./client";
import type { ZernioISODate, ZernioPhone } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/** Lançado quando o input não pode ser normalizado para E.164 / ISO-8601. */
export class ZernioValidationError extends ZernioApiError {
  constructor(message: string, details?: unknown) {
    super({
      message,
      code: "validation_error",
      status: 422,
      retryable: false,
      details,
    });
    this.name = "ZernioValidationError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone (E.164)
// ─────────────────────────────────────────────────────────────────────────────

/** Limites do padrão E.164: 8–15 dígitos, sem o `+`. */
const E164_MIN_DIGITS = 8;
const E164_MAX_DIGITS = 15;

/** DDDs móveis do Brasil que historicamente exigem o `9` extra. */
const BR_MOBILE_DDDS = new Set<string>([
  "11","12","13","14","15","16","17","18","19",
  "21","22","24","27","28",
  "31","32","33","34","35","37","38",
  "41","42","43","44","45","46","47","48","49",
  "51","53","54","55",
  "61","62","63","64","65","66","67","68","69",
  "71","73","74","75","77","79",
  "81","82","83","84","85","86","87","88","89",
  "91","92","93","94","95","96","97","98","99",
]);

export interface NormalizePhoneOptions {
  /** Default country code if missing (digits only, sem `+`). Default: `"55"`. */
  defaultCountry?: string;
}

/**
 * Normaliza um número para E.164 (`+<country><number>`).
 *
 * Regras aplicadas (em ordem):
 *  1. Trim + remoção de qualquer caractere que não seja `+` ou dígito.
 *  2. `00` inicial é tratado como prefixo internacional → vira `+`.
 *  3. Se já começa com `+`, mantém o country code informado.
 *  4. Caso contrário, prefixa com `defaultCountry` (default `55`).
 *  5. Para Brasil (`55`), corrige celulares antigos sem o `9`.
 *  6. Valida tamanho final (8–15 dígitos após o `+`).
 *
 * @throws {ZernioValidationError} quando o input não puder ser normalizado.
 */
export function normalizeE164(
  raw: string | null | undefined,
  options: NormalizePhoneOptions = {},
): ZernioPhone {
  if (raw === null || raw === undefined) {
    throw new ZernioValidationError("Telefone é obrigatório.", { field: "to" });
  }
  const defaultCountry = (options.defaultCountry ?? "55").replace(/\D+/g, "");
  if (!defaultCountry) {
    throw new ZernioValidationError("defaultCountry inválido.", { defaultCountry });
  }

  // 1. Limpeza — preserva o `+` apenas no início
  const trimmed = String(raw).trim();
  if (!trimmed) {
    throw new ZernioValidationError("Telefone é obrigatório.", { field: "to" });
  }
  let cleaned = trimmed.replace(/[^\d+]/g, "");
  // `+` só é válido na primeira posição
  cleaned = cleaned.replace(/(?!^)\+/g, "");

  // 2. `00` internacional → `+`
  if (!cleaned.startsWith("+") && cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // 3/4. Garante o `+` e o country code
  if (!cleaned.startsWith("+")) {
    cleaned = `+${defaultCountry}${cleaned}`;
  }

  // 5. Correção BR: celular antigo sem o `9`
  if (cleaned.startsWith("+55")) {
    const rest = cleaned.slice(3); // após o country code
    if (rest.length === 10) {
      const ddd = rest.slice(0, 2);
      const subscriber = rest.slice(2);
      // Subscriber de 8 dígitos começando com 6/7/8/9 = celular legado → adiciona 9
      if (BR_MOBILE_DDDS.has(ddd) && /^[6789]/.test(subscriber)) {
        cleaned = `+55${ddd}9${subscriber}`;
      }
    }
  }

  // 6. Validação final
  const digits = cleaned.slice(1);
  if (!/^\d+$/.test(digits)) {
    throw new ZernioValidationError("Telefone contém caracteres inválidos.", {
      field: "to",
      value: raw,
    });
  }
  if (digits.length < E164_MIN_DIGITS || digits.length > E164_MAX_DIGITS) {
    throw new ZernioValidationError(
      `Telefone fora do padrão E.164 (esperado ${E164_MIN_DIGITS}–${E164_MAX_DIGITS} dígitos).`,
      { field: "to", value: raw, normalized: cleaned, length: digits.length },
    );
  }

  return cleaned as ZernioPhone;
}

/** Variante segura — devolve `null` em vez de lançar. */
export function tryNormalizeE164(
  raw: string | null | undefined,
  options?: NormalizePhoneOptions,
): ZernioPhone | null {
  try {
    return normalizeE164(raw, options);
  } catch {
    return null;
  }
}

/** `true` se o input já é (ou pode virar) um E.164 válido. */
export function isValidE164(
  raw: string | null | undefined,
  options?: NormalizePhoneOptions,
): boolean {
  return tryNormalizeE164(raw, options) !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timestamp (ISO-8601 UTC)
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizeIsoOptions {
  /** Se `true`, exige timestamps no futuro (útil para `scheduledFor`). */
  mustBeFuture?: boolean;
  /** Margem mínima em ms aceita no futuro. Default: `0`. */
  minLeadMs?: number;
}

/**
 * Normaliza um timestamp para ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
 *
 * Aceita:
 *   • `Date`
 *   • `number` (epoch ms)
 *   • `string` em qualquer formato parseável por `new Date(...)`
 *
 * @throws {ZernioValidationError} se o input for inválido / NaN / fora da
 *         política de `mustBeFuture`.
 */
export function normalizeIsoDate(
  raw: Date | string | number | null | undefined,
  options: NormalizeIsoOptions = {},
): ZernioISODate {
  if (raw === null || raw === undefined || raw === "") {
    throw new ZernioValidationError("Data é obrigatória.", { field: "scheduledFor" });
  }

  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ZernioValidationError("Data inválida (não parseável).", {
      field: "scheduledFor",
      value: raw,
    });
  }

  if (options.mustBeFuture) {
    const lead = options.minLeadMs ?? 0;
    if (date.getTime() <= Date.now() + lead) {
      throw new ZernioValidationError(
        "Data deve estar no futuro.",
        { field: "scheduledFor", value: raw, minLeadMs: lead },
      );
    }
  }

  return date.toISOString();
}

/** Variante segura — devolve `null` em vez de lançar. */
export function tryNormalizeIsoDate(
  raw: Date | string | number | null | undefined,
  options?: NormalizeIsoOptions,
): ZernioISODate | null {
  try {
    return normalizeIsoDate(raw, options);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza o input de envio (text/template) garantindo que `to` esteja em
 * E.164. Mantém o resto do payload intacto.
 */
export function normalizeSendInput<T extends { to: string }>(
  input: T,
  options?: NormalizePhoneOptions,
): T & { to: ZernioPhone } {
  return { ...input, to: normalizeE164(input.to, options) };
}

/**
 * Normaliza um array de destinatários (broadcasts/import). Telefones
 * inválidos são separados em `invalid` ao invés de abortar tudo.
 */
export function normalizeRecipients(
  recipients: Array<{ phone: string; [k: string]: unknown }>,
  options?: NormalizePhoneOptions,
): {
  valid: Array<{ phone: ZernioPhone; [k: string]: unknown }>;
  invalid: Array<{ phone: string; reason: string }>;
} {
  const valid: Array<{ phone: ZernioPhone; [k: string]: unknown }> = [];
  const invalid: Array<{ phone: string; reason: string }> = [];

  for (const r of recipients) {
    const normalized = tryNormalizeE164(r.phone, options);
    if (normalized) {
      valid.push({ ...r, phone: normalized });
    } else {
      invalid.push({ phone: r.phone, reason: "invalid_e164" });
    }
  }

  return { valid, invalid };
}
