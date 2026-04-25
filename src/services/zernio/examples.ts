/**
 * Zernio — payload & response examples
 *
 * Ready-to-use, fully typed fixtures for every supported operation:
 *   • Messages   (text / template / media + result)
 *   • Templates  (creation + listing)
 *   • Contacts   (single + import + result)
 *   • Broadcasts (creation + listing + send result)
 *   • Errors     (every ZernioErrorCode with a sample payload)
 *
 * Use these as:
 *   - Reference when wiring new UI / hooks
 *   - Mock data for Storybook / Vitest
 *   - Documentation that stays in sync with the type system (any drift breaks
 *     the build, since every example is annotated with its real type)
 *
 * Nothing here is executed at runtime — pure constants only.
 */

import type {
  ZernioBroadcast,
  ZernioContact,
  ZernioContactImportInput,
  ZernioContactImportResult,
  ZernioCreateBroadcastInput,
  ZernioErrorCode,
  ZernioErrorPayload,
  ZernioMessage,
  ZernioSendBroadcastInput,
  ZernioSendMediaInput,
  ZernioSendResult,
  ZernioSendTemplateInput,
  ZernioSendTextInput,
  ZernioTemplate,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Common identifiers reused across examples
// ─────────────────────────────────────────────────────────────────────────────

export const EXAMPLE_ACCOUNT_ID = "acc_01HZ8VWB3FQ2MNXR4K9JT5SE7P";
export const EXAMPLE_WORKSPACE_ID = "ws_01HZ8VWBA1B2C3D4E5F6G7H8J9";
export const EXAMPLE_CONTACT_ID = "con_01HZ8VWBJKMN3PQRSTUV4WX5Y6";
export const EXAMPLE_TEMPLATE_NAME = "order_confirmation";
export const EXAMPLE_TO_PHONE = "+5511999990001";
export const EXAMPLE_FROM_PHONE = "+5511933334444";

// ─────────────────────────────────────────────────────────────────────────────
// Messages — request payloads
// ─────────────────────────────────────────────────────────────────────────────

/** Free text — only valid inside the 24h conversation window. */
export const sendTextPayload: ZernioSendTextInput = {
  accountId: EXAMPLE_ACCOUNT_ID,
  workspaceId: EXAMPLE_WORKSPACE_ID,
  to: EXAMPLE_TO_PHONE,
  text: "Olá! Recebemos seu pedido e já estamos preparando 🙌",
};

/** Pre-approved template — required outside the 24h window. */
export const sendTemplatePayload: ZernioSendTemplateInput = {
  accountId: EXAMPLE_ACCOUNT_ID,
  workspaceId: EXAMPLE_WORKSPACE_ID,
  to: EXAMPLE_TO_PHONE,
  templateName: EXAMPLE_TEMPLATE_NAME,
  language: "pt_BR",
  variables: ["Maria", "#10482", "R$ 249,90"],
};

/** Image attachment with caption. */
export const sendMediaImagePayload: ZernioSendMediaInput = {
  accountId: EXAMPLE_ACCOUNT_ID,
  workspaceId: EXAMPLE_WORKSPACE_ID,
  to: EXAMPLE_TO_PHONE,
  mediaUrl: "https://cdn.example.com/receipts/10482.png",
  mediaType: "image",
  caption: "Comprovante do pedido #10482",
};

/** PDF document attachment. */
export const sendMediaDocumentPayload: ZernioSendMediaInput = {
  accountId: EXAMPLE_ACCOUNT_ID,
  workspaceId: EXAMPLE_WORKSPACE_ID,
  to: EXAMPLE_TO_PHONE,
  mediaUrl: "https://cdn.example.com/invoices/INV-10482.pdf",
  mediaType: "document",
  fileName: "INV-10482.pdf",
};

// ─────────────────────────────────────────────────────────────────────────────
// Messages — responses
// ─────────────────────────────────────────────────────────────────────────────

export const sendResultSuccess: ZernioSendResult = {
  messageId: "wamid.HBgMNTUxMTk5OTk5MDAwMRUCABEYEjI5OTk5OTk5MDAwMS5SRU0A",
  status: "sent",
  raw: {
    messages: [{ id: "wamid.HBgMNTUxMTk5OTk5MDAwMRUCABEYEjI5OTk5OTk5MDAwMS5SRU0A" }],
    contacts: [{ wa_id: "5511999990001", input: EXAMPLE_TO_PHONE }],
  },
};

export const inboundMessageExample: ZernioMessage = {
  id: "msg_01HZ8VWBKQRS5TUVWX6Y7Z8AB9",
  accountId: EXAMPLE_ACCOUNT_ID,
  conversationId: "cnv_01HZ8VWBM7N8P9Q0RSTUV1WXYZ",
  contactId: EXAMPLE_CONTACT_ID,
  from: EXAMPLE_TO_PHONE,
  to: EXAMPLE_FROM_PHONE,
  type: "text",
  direction: "inbound",
  status: "delivered",
  text: "Oi! Vocês entregam aqui no centro?",
  createdAt: "2026-04-22T12:31:04.000Z",
};

export const outboundTemplateMessageExample: ZernioMessage = {
  id: "msg_01HZ8VWBN2P3Q4RSTUVWXYZABC",
  accountId: EXAMPLE_ACCOUNT_ID,
  conversationId: "cnv_01HZ8VWBM7N8P9Q0RSTUV1WXYZ",
  contactId: EXAMPLE_CONTACT_ID,
  from: EXAMPLE_FROM_PHONE,
  to: EXAMPLE_TO_PHONE,
  type: "template",
  direction: "outbound",
  status: "sent",
  templateName: EXAMPLE_TEMPLATE_NAME,
  templateLanguage: "pt_BR",
  templateVariables: ["Maria", "#10482", "R$ 249,90"],
  createdAt: "2026-04-22T12:30:01.000Z",
  updatedAt: "2026-04-22T12:30:02.000Z",
};

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

export const templateApprovedExample: ZernioTemplate = {
  id: "tpl_01HZ8VWBP5Q6R7STUVWXYZAB12",
  accountId: EXAMPLE_ACCOUNT_ID,
  name: EXAMPLE_TEMPLATE_NAME,
  language: "pt_BR",
  status: "approved",
  category: "UTILITY",
  components: [
    {
      type: "HEADER",
      format: "TEXT",
      text: "Pedido confirmado, {{1}}!",
      example: { header_text: ["Maria"] },
    },
    {
      type: "BODY",
      text: "Seu pedido {{1}} foi confirmado. Total: {{2}}. Em breve você receberá o código de rastreio.",
      example: { body_text: [["#10482", "R$ 249,90"]] },
    },
    {
      type: "FOOTER",
      text: "Obrigado por comprar com a gente 💚",
    },
    {
      type: "BUTTONS",
      buttons: [
        { type: "URL", text: "Acompanhar pedido", url: "https://example.com/orders/{{1}}" },
        { type: "QUICK_REPLY", text: "Falar com atendente" },
      ],
    },
  ],
  createdAt: "2026-04-10T09:00:00.000Z",
  updatedAt: "2026-04-10T09:14:22.000Z",
};

export const templateMarketingPendingExample: ZernioTemplate = {
  id: "tpl_01HZ8VWBQ8R9STUVWXYZAB1234",
  accountId: EXAMPLE_ACCOUNT_ID,
  name: "spring_promo_2026",
  language: "pt_BR",
  status: "pending",
  category: "MARKETING",
  components: [
    { type: "BODY", text: "{{1}}, sua coleção favorita está com 20% off só hoje!" },
  ],
  createdAt: "2026-04-21T18:42:00.000Z",
};

/** Typical `templates.list()` payload from Zernio. */
export const templateListExample: ZernioTemplate[] = [
  templateApprovedExample,
  templateMarketingPendingExample,
];

// ─────────────────────────────────────────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────────────────────────────────────────

export const contactExample: ZernioContact = {
  id: EXAMPLE_CONTACT_ID,
  accountId: EXAMPLE_ACCOUNT_ID,
  phone: EXAMPLE_TO_PHONE,
  name: "Maria Souza",
  profilePictureUrl: "https://cdn.example.com/avatars/maria.jpg",
  tags: ["vip", "ecommerce"],
  inSession: true,
  sessionExpiresAt: "2026-04-23T11:14:00.000Z",
  createdAt: "2025-11-02T15:00:00.000Z",
  updatedAt: "2026-04-22T12:31:04.000Z",
};

export const contactImportPayload: ZernioContactImportInput = {
  accountId: EXAMPLE_ACCOUNT_ID,
  workspaceId: EXAMPLE_WORKSPACE_ID,
  contacts: [
    { phone: "+5511999990001", name: "Maria Souza", tags: ["vip"] },
    { phone: "+5511999990002", name: "João Pereira", tags: ["lead"] },
    { phone: "+5511999990003", name: "Ana Lima" },
  ],
};

export const contactImportResultExample: ZernioContactImportResult = {
  imported: 2,
  skipped: 1,
  errors: [
    { phone: "+5511999990003", reason: "duplicate" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Broadcasts
// ─────────────────────────────────────────────────────────────────────────────

export const createBroadcastByTagsPayload: ZernioCreateBroadcastInput = {
  accountId: EXAMPLE_ACCOUNT_ID,
  workspaceId: EXAMPLE_WORKSPACE_ID,
  name: "Promo Outono 2026 — VIP",
  templateName: "spring_promo_2026",
  templateLanguage: "pt_BR",
  variables: ["{{name}}"],
  audienceTags: ["vip", "ecommerce"],
  scheduledFor: "2026-04-25T13:00:00.000Z",
};

export const createBroadcastByContactsPayload: ZernioCreateBroadcastInput = {
  accountId: EXAMPLE_ACCOUNT_ID,
  workspaceId: EXAMPLE_WORKSPACE_ID,
  name: "Reativação clientes inativos",
  templateName: EXAMPLE_TEMPLATE_NAME,
  templateLanguage: "pt_BR",
  variables: ["{{name}}", "{{order_id}}", "{{total}}"],
  audienceContactIds: [EXAMPLE_CONTACT_ID, "con_01HZ8VWBR1S2T3UVWXYZAB5678"],
};

export const sendBroadcastPayload: ZernioSendBroadcastInput = {
  accountId: EXAMPLE_ACCOUNT_ID,
  workspaceId: EXAMPLE_WORKSPACE_ID,
  broadcastId: "bcast_01HZ8VWBT5U6V7WXYZAB1234567",
};

export const broadcastDraftExample: ZernioBroadcast = {
  id: "bcast_01HZ8VWBT5U6V7WXYZAB1234567",
  accountId: EXAMPLE_ACCOUNT_ID,
  name: "Promo Outono 2026 — VIP",
  status: "draft",
  templateName: "spring_promo_2026",
  templateLanguage: "pt_BR",
  variables: ["{{name}}"],
  audienceTags: ["vip", "ecommerce"],
  scheduledFor: "2026-04-25T13:00:00.000Z",
  stats: { total: 482, queued: 482, sent: 0, delivered: 0, read: 0, failed: 0 },
  createdAt: "2026-04-22T12:00:00.000Z",
};

export const broadcastSendingExample: ZernioBroadcast = {
  ...broadcastDraftExample,
  status: "sending",
  stats: { total: 482, queued: 312, sent: 170, delivered: 142, read: 88, failed: 4 },
  updatedAt: "2026-04-25T13:02:11.000Z",
};

export const broadcastSentExample: ZernioBroadcast = {
  ...broadcastDraftExample,
  status: "sent",
  stats: { total: 482, queued: 0, sent: 478, delivered: 471, read: 318, failed: 4 },
  updatedAt: "2026-04-25T13:14:48.000Z",
};

export const broadcastListExample: ZernioBroadcast[] = [
  broadcastSentExample,
  broadcastSendingExample,
  broadcastDraftExample,
];

// ─────────────────────────────────────────────────────────────────────────────
// Errors — one example per ZernioErrorCode
// ─────────────────────────────────────────────────────────────────────────────

export const errorExamples: Record<ZernioErrorCode, ZernioErrorPayload> = {
  rate_limited: {
    status: 429,
    code: "rate_limited",
    message: "Muitos envios em pouco tempo. Tente novamente em alguns segundos.",
    retryable: true,
    details: { retryAfterMs: 4500 },
  },
  upstream_unavailable: {
    status: 503,
    code: "upstream_unavailable",
    message: "Zernio está temporariamente indisponível.",
    retryable: true,
  },
  timeout: {
    status: 504,
    code: "timeout",
    message: "A requisição excedeu o tempo limite (15s).",
    retryable: true,
    details: { attempt: 2, timeoutMs: 15000 },
  },
  aborted: {
    status: 499,
    code: "aborted",
    message: "Requisição cancelada antes da resposta.",
    retryable: false,
  },
  network_error: {
    status: 0,
    code: "network_error",
    message: "Falha de rede ao contatar o proxy.",
    retryable: true,
  },
  transport_error: {
    status: 0,
    code: "transport_error",
    message: "Erro de transporte ao serializar a resposta.",
    retryable: true,
  },
  proxy_error: {
    status: 502,
    code: "proxy_error",
    message: "Erro interno no late-proxy.",
    retryable: true,
  },
  unauthorized: {
    status: 401,
    code: "unauthorized",
    message: "Sessão expirada. Faça login novamente.",
    retryable: false,
  },
  forbidden: {
    status: 403,
    code: "forbidden",
    message: "Sua conta não tem permissão para esta operação.",
    retryable: false,
  },
  not_found: {
    status: 404,
    code: "not_found",
    message: "Conta WhatsApp não encontrada.",
    retryable: false,
    details: { accountId: EXAMPLE_ACCOUNT_ID },
  },
  validation_error: {
    status: 422,
    code: "validation_error",
    message: "Número de destino inválido (esperado E.164).",
    retryable: false,
    details: { field: "to", value: "11999990001" },
  },
  bad_request: {
    status: 400,
    code: "bad_request",
    message: "Payload malformado.",
    retryable: false,
  },
  insufficient_credits: {
    status: 402,
    code: "insufficient_credits",
    message: "Créditos insuficientes para enviar a mensagem.",
    retryable: false,
    details: { required: 5, available: 1 },
  },
  missing_api_key: {
    status: 503,
    code: "missing_api_key",
    message: "Zernio API key não configurada. Adicione LATE_API_KEY em Lovable Cloud → Secrets.",
    retryable: false,
  },
  invalid_api_key: {
    status: 401,
    code: "invalid_api_key",
    message: "Zernio API key inválida ou revogada.",
    retryable: false,
  },
  api_error: {
    status: 500,
    code: "api_error",
    message: "Zernio retornou um erro inesperado.",
    retryable: true,
  },
  unknown: {
    status: undefined,
    code: "unknown",
    message: "Erro desconhecido.",
    retryable: false,
  },
};
