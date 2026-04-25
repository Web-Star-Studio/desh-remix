/**
 * @module pandora-tools/social-tools
 * @description Tool definitions for Social Media
 */

export const socialToolDefinitions = [
  { type: "function", function: { name: "create_social_post", description: "Criar e publicar ou agendar um post nas redes sociais conectadas", parameters: { type: "object", properties: { content: { type: "string", description: "Texto do post" }, platforms: { type: "array", items: { type: "string" }, description: "Plataformas alvo (ex: instagram, facebook, twitter, linkedin, tiktok)" }, schedule_date: { type: "string", description: "Data/hora para agendar (ISO 8601, opcional — se omitido, publica imediatamente)" }, media_urls: { type: "array", items: { type: "string" }, description: "URLs de imagens/vídeos a anexar (opcional)" } }, required: ["content", "platforms"], additionalProperties: false } } },
  { type: "function", function: { name: "get_social_accounts", description: "Listar contas de redes sociais conectadas", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "get_social_posts", description: "Listar posts recentes das redes sociais", parameters: { type: "object", properties: { status: { type: "string", enum: ["published", "scheduled", "draft", "all"], description: "Filtrar por status" }, limit: { type: "number", description: "Número de posts (padrão: 10)" } }, additionalProperties: false } } },
  { type: "function", function: { name: "delete_social_post", description: "Excluir um post social (agendado ou rascunho)", parameters: { type: "object", properties: { post_identifier: { type: "string", description: "Título/conteúdo parcial ou ID do post" } }, required: ["post_identifier"], additionalProperties: false } } },
];
