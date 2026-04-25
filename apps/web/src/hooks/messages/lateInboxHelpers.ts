/**
 * lateInboxHelpers — Centraliza a montagem de URLs e payloads para a Late Inbox API.
 *
 * Por que existe:
 * - Garante que `accountId` seja anexado de forma consistente em query string E body
 *   para todos os métodos mutativos (POST, PUT, DELETE) da Late.
 * - Evita drift entre callers diferentes (sendMessage, updateConversationStatus, etc).
 * - Remove o prefixo interno `late_` antes de chamar a API real.
 */

/** Remove o prefixo interno `late_` usado para namespacing local. */
export function stripLatePrefix(conversationId: string): string {
  return conversationId.replace(/^late_/, "");
}

/** Anexa `accountId` à query string de uma rota Late de forma idempotente. */
export function withAccountIdQuery(route: string, accountId: string): string {
  const sep = route.includes("?") ? "&" : "?";
  return `${route}${sep}accountId=${encodeURIComponent(accountId)}`;
}

/**
 * Mescla `accountId` no body. Late exige que o accountId esteja presente
 * no payload de mutações (POST/PUT) além da query string.
 */
export function withAccountIdBody<T extends object>(
  body: T,
  accountId: string,
): T & { accountId: string } {
  return { ...body, accountId };
}

/** Valida que o accountId está presente; lança erro padronizado caso contrário. */
export function assertAccountId(accountId: string | undefined | null): asserts accountId is string {
  if (!accountId) {
    throw new Error(
      "accountId ausente: a conversa social não está vinculada a uma conta conectada.",
    );
  }
}

/**
 * Detecta se uma conversa Late está sem `accountId` vinculado.
 * Use sempre este helper em UIs (banners, badges, bloqueios de envio) para que
 * toda tela aplique a mesma regra de "integração desconectada".
 *
 * Aceita um shape mínimo para não acoplar o helper ao tipo de conversa de
 * cada tela.
 */
export function isMissingLateAccountId(
  conversation:
    | { isLateInbox?: boolean | null; accountId?: string | null }
    | null
    | undefined,
): boolean {
  if (!conversation) return false;
  if (!conversation.isLateInbox) return false;
  return !conversation.accountId;
}

/**
 * Constrói uma chamada Late completa (rota + body) com accountId já anexado
 * em ambos os lugares. Use para qualquer mutação na Inbox API.
 */
export function buildLateInboxCall<T extends object>(
  baseRoute: string,
  accountId: string,
  body: T,
): { route: string; body: T & { accountId: string } } {
  return {
    route: withAccountIdQuery(baseRoute, accountId),
    body: withAccountIdBody(body, accountId),
  };
}

/**
 * Métodos HTTP suportados pela Late API que exigem `accountId` tanto em query
 * string quanto em body. GET é incluído por consistência (apenas query).
 */
export type LateHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Métodos mutativos que exigem `accountId` no body além da query string. */
const MUTATIVE_METHODS: ReadonlySet<LateHttpMethod> = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

/**
 * Constrói uma chamada Late completa de forma uniforme para qualquer método.
 * - GET: apenas anexa `accountId` na query string.
 * - POST/PUT/PATCH/DELETE: anexa `accountId` em query E body.
 *
 * Use este helper em vez de `buildLateInboxCall` quando o método não for
 * conhecido em tempo de escrita (ex: handlers genéricos).
 */
export function buildLateInboxRequest<T extends Record<string, unknown> = Record<string, unknown>>(
  baseRoute: string,
  accountId: string,
  method: LateHttpMethod,
  body?: T,
): { route: string; body: (T & { accountId: string }) | undefined } {
  const route = withAccountIdQuery(baseRoute, accountId);
  if (!MUTATIVE_METHODS.has(method)) {
    return { route, body: undefined };
  }
  return {
    route,
    body: withAccountIdBody((body ?? {}) as T, accountId),
  };
}

/** Rotas pré-construídas da Late Inbox API. */
export const lateInboxRoutes = {
  // Conversations
  listConversations: () => `/inbox/conversations`,
  getConversation: (conversationId: string) =>
    `/inbox/conversations/${stripLatePrefix(conversationId)}`,
  updateConversation: (conversationId: string) =>
    `/inbox/conversations/${stripLatePrefix(conversationId)}`,
  deleteConversation: (conversationId: string) =>
    `/inbox/conversations/${stripLatePrefix(conversationId)}`,

  // Messages
  listMessages: (conversationId: string) =>
    `/inbox/conversations/${stripLatePrefix(conversationId)}/messages`,
  sendMessage: (conversationId: string) =>
    `/inbox/conversations/${stripLatePrefix(conversationId)}/messages`,
  deleteMessage: (conversationId: string, messageId: string) =>
    `/inbox/conversations/${stripLatePrefix(conversationId)}/messages/${messageId}`,
};

// ─── Payload Types & Schemas ──────────────────────────────────────────────────
//
// Tipos estritos para os dois fluxos mais usados da Inbox API. Os schemas são
// validadores leves (sem dependência externa) que rodam **antes** de chamar
// o proxy: garantem que campos obrigatórios estão presentes e bem formados,
// reduzindo erros 400 vindos da Late.

/** Status válidos para `updateConversation`. */
export const LATE_CONVERSATION_STATUSES = ["read", "unread", "archived", "active"] as const;
export type LateConversationStatus = (typeof LATE_CONVERSATION_STATUSES)[number];

/** Payload para enviar uma mensagem em uma conversa. */
export interface SendMessagePayload {
  message: string;
}

/** Payload para atualizar o status de uma conversa. */
export interface UpdateConversationPayload {
  status: LateConversationStatus;
}

/** Payload final enviado à Late (após `withAccountIdBody`). */
export type WithAccountId<T> = T & { accountId: string };

/** Resultado padronizado de validação. */
export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Valida o payload de envio de mensagem. Garante que `message` é uma string
 * não-vazia (após trim) e dentro do limite suportado pela Late (4096 chars).
 */
export function validateSendMessagePayload(
  payload: unknown,
): ValidationResult<SendMessagePayload> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Payload inválido: objeto esperado." };
  }
  const { message } = payload as Record<string, unknown>;
  if (!isNonEmptyString(message)) {
    return { ok: false, error: "Campo 'message' obrigatório e não-vazio." };
  }
  if (message.length > 4096) {
    return { ok: false, error: "Mensagem excede o limite de 4096 caracteres." };
  }
  return { ok: true, value: { message } };
}

/** Valida o payload de atualização de status de conversa. */
export function validateUpdateConversationPayload(
  payload: unknown,
): ValidationResult<UpdateConversationPayload> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Payload inválido: objeto esperado." };
  }
  const { status } = payload as Record<string, unknown>;
  if (typeof status !== "string" || !LATE_CONVERSATION_STATUSES.includes(status as LateConversationStatus)) {
    return {
      ok: false,
      error: `Campo 'status' deve ser um de: ${LATE_CONVERSATION_STATUSES.join(", ")}.`,
    };
  }
  return { ok: true, value: { status: status as LateConversationStatus } };
}

/**
 * Erro especializado para falhas de validação de payload Late. Permite que
 * call-sites diferenciem erros de formato (não devem ser retried) de erros
 * de rede/servidor.
 */
export class LatePayloadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LatePayloadValidationError";
  }
}

/** Variante throwing dos validadores, útil em call-sites imperativos. */
export function assertSendMessagePayload(payload: unknown): SendMessagePayload {
  const r = validateSendMessagePayload(payload);
  if (r.ok === true) {
    return r.value;
  } else {
    throw new LatePayloadValidationError(r.error);
  }
}

export function assertUpdateConversationPayload(payload: unknown): UpdateConversationPayload {
  const r = validateUpdateConversationPayload(payload);
  if (r.ok === true) {
    return r.value;
  } else {
    throw new LatePayloadValidationError(r.error);
  }
}
