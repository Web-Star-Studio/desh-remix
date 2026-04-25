/**
 * @module pandora-tools/automation-tools
 * @description Tool definitions for Automations
 */

export const automationToolDefinitions = [
  { type: "function", function: { name: "get_automations", description: "Listar automações do usuário", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "create_automation", description: "Criar nova automação", parameters: { type: "object", properties: { name: { type: "string" }, trigger_type: { type: "string" }, trigger_config: { type: "object" }, action_type: { type: "string" }, action_config: { type: "object" } }, required: ["name", "trigger_type", "action_type"], additionalProperties: false } } },
  { type: "function", function: { name: "toggle_automation", description: "Ativar/desativar automação", parameters: { type: "object", properties: { automation_identifier: { type: "string" }, enabled: { type: "boolean" } }, required: ["automation_identifier", "enabled"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_automation", description: "Excluir automação", parameters: { type: "object", properties: { automation_identifier: { type: "string" } }, required: ["automation_identifier"], additionalProperties: false } } },
];
