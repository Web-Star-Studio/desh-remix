/**
 * @module pandora-tools/email-tools
 * @description Tool definitions for Email (Gmail)
 */

export const emailToolDefinitions = [
  { type: "function", function: { name: "send_email", description: "Enviar e-mail via Gmail. Registra interação no contato automaticamente.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, contact_name: { type: "string" } }, required: ["to", "subject", "body"], additionalProperties: false } } },
  { type: "function", function: { name: "reply_email", description: "Responder a um e-mail existente mantendo o thread.", parameters: { type: "object", properties: { email_id: { type: "string" }, reply_text: { type: "string" } }, required: ["email_id", "reply_text"], additionalProperties: false } } },
  { type: "function", function: { name: "get_emails", description: "Listar últimos e-mails", parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false } } },
  { type: "function", function: { name: "search_emails", description: "Buscar e-mails por assunto, remetente ou qualquer termo. Faz busca real no Gmail via Composio (não apenas no cache local).", parameters: { type: "object", properties: { query: { type: "string", description: "Termo de busca (ex: 'fatura', 'de:joao@email.com', 'contrato assinado')" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "get_email_stats", description: "Estatísticas de e-mail", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "trash_emails", description: "Mover e-mails para lixeira", parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "archive_emails", description: "Arquivar e-mails", parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "star_emails", description: "Marcar e-mails com estrela", parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "mark_emails_read", description: "Marcar e-mails como lidos", parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "create_draft_email", description: "Criar rascunho de e-mail no Gmail. Use quando o usuário quer preparar um e-mail para revisar antes de enviar.", parameters: { type: "object", properties: { to: { type: "string", description: "Destinatário (opcional para rascunho)" }, subject: { type: "string" }, body: { type: "string" } }, required: ["subject", "body"], additionalProperties: false } } },
];

export const emailToolDefinitionsCompact = [
  { type: "function", function: { name: "send_email", description: "Enviar email via Gmail. Use SOMENTE quando pedirem EMAIL. NUNCA use para WhatsApp.", parameters: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, contact_name: { type: "string" } }, required: ["subject", "body"], additionalProperties: false } } },
  { type: "function", function: { name: "get_emails", description: "Listar emails recentes", parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false } } },
  { type: "function", function: { name: "search_emails", description: "Buscar emails por assunto ou remetente", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "get_email_stats", description: "Estatísticas de email (não lidos, estrelados, total)", parameters: { type: "object", properties: {}, additionalProperties: false } } },
];
