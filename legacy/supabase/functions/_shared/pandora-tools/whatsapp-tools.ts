/**
 * @module pandora-tools/whatsapp-tools
 * @description Tool definitions for WhatsApp
 */

export const whatsappToolDefinitions = [
  { type: "function", function: { name: "get_whatsapp_status", description: "Verificar status do WhatsApp Web", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "send_whatsapp", description: "Enviar mensagem via WhatsApp Web. Pode usar phone_number OU contact_name.", parameters: { type: "object", properties: { phone_number: { type: "string" }, message: { type: "string" }, contact_name: { type: "string" } }, required: ["message"], additionalProperties: false } } },
  { type: "function", function: { name: "get_whatsapp_conversations", description: "Listar conversas recentes do WhatsApp", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "get_whatsapp_chat_history", description: "Histórico de mensagens de uma conversa", parameters: { type: "object", properties: { contact_name: { type: "string" }, limit: { type: "number" } }, required: ["contact_name"], additionalProperties: false } } },
];

export const whatsappToolDefinitionsCompact = [
  { type: "function", function: { name: "send_whatsapp", description: "Enviar mensagem WhatsApp. Use SOMENTE quando pedirem mensagem/WhatsApp. NUNCA use para email. PREFIRA contact_name em vez de phone_number. Se usar phone_number, passe somente dígitos (ex: 5511999887766).", parameters: { type: "object", properties: { phone_number: { type: "string", description: "Número com código do país, somente dígitos (ex: 5511999887766)" }, message: { type: "string" }, contact_name: { type: "string", description: "Nome do contato (preferido — resolve automaticamente o número)" } }, required: ["message"], additionalProperties: false } } },
  { type: "function", function: { name: "get_whatsapp_conversations", description: "Listar conversas recentes do WhatsApp", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "get_whatsapp_chat_history", description: "Histórico de mensagens de uma conversa WhatsApp", parameters: { type: "object", properties: { contact_name: { type: "string" }, limit: { type: "number" } }, required: ["contact_name"], additionalProperties: false } } },
];
