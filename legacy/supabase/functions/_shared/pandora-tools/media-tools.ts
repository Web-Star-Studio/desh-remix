/**
 * @module pandora-tools/media-tools
 * @description Tool definitions for Image Generation, PDF Reports
 */

export const mediaToolDefinitions = [
  { type: "function", function: { name: "generate_image", description: "Gerar imagem com IA (infográficos, ilustrações, capas, avatares)", parameters: { type: "object", properties: { prompt: { type: "string" }, style: { type: "string", enum: ["infographic", "artistic", "diagram", "photo-realistic"] } }, required: ["prompt"], additionalProperties: false } } },
  { type: "function", function: { name: "generate_pdf_report", description: "Criar relatório PDF personalizado", parameters: { type: "object", properties: { report_type: { type: "string", enum: ["financial_report", "weekly_summary", "life_infographic", "contacts_report", "habits_report", "custom"] }, title: { type: "string" }, include_sections: { type: "array", items: { type: "string" } } }, required: ["report_type", "title"], additionalProperties: false } } },
];
