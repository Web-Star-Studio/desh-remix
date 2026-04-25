/**
 * @module pandora-tools/search-tools
 * @description Tool definitions for Web Search, SERP, Cross-module search
 */

export const searchToolDefinitions = [
  { type: "function", function: { name: "web_search", description: "Buscar informações atualizadas na web em tempo real.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "serp_search", description: "Busca especializada (voos, hotéis, finanças, notícias, imagens, shopping, vagas, eventos, acadêmico, YouTube, lugares, patentes, tendências).", parameters: { type: "object", properties: { query: { type: "string" }, engine: { type: "string", enum: ["google", "google_news", "google_images", "google_shopping", "google_finance", "google_flights", "google_hotels", "google_jobs", "google_events", "google_scholar", "youtube", "google_maps", "google_patents", "google_trends"] } }, required: ["query", "engine"], additionalProperties: false } } },
  { type: "function", function: { name: "cross_module_search", description: "Busca unificada em todos os módulos (tarefas, notas, contatos, transações, arquivos, conhecimento)", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } } },
];

export const searchToolDefinitionsCompact = [
  { type: "function", function: { name: "web_search", description: "Buscar na web", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } } },
];
