/**
 * @module pandora-tools/notes-tools
 * @description Tool definitions for Notes
 */

export const notesToolDefinitions = [
  { type: "function", function: { name: "add_note", description: "Criar uma nova nota no dashboard", parameters: { type: "object", properties: { title: { type: "string", description: "Título da nota" }, content: { type: "string", description: "Conteúdo da nota" } }, required: ["title", "content"], additionalProperties: false } } },
  { type: "function", function: { name: "edit_note", description: "Editar o título e/ou conteúdo de uma nota existente", parameters: { type: "object", properties: { note_identifier: { type: "string", description: "Título ou ID da nota a editar" }, new_title: { type: "string" }, new_content: { type: "string" } }, required: ["note_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_note", description: "Excluir uma nota pelo título ou ID", parameters: { type: "object", properties: { note_identifier: { type: "string", description: "Título ou ID da nota" } }, required: ["note_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "favorite_note", description: "Favoritar ou desfavoritar uma nota", parameters: { type: "object", properties: { note_identifier: { type: "string" }, favorited: { type: "boolean" } }, required: ["note_identifier", "favorited"], additionalProperties: false } } },
  { type: "function", function: { name: "set_note_tags", description: "Definir as tags de uma nota", parameters: { type: "object", properties: { note_identifier: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["note_identifier", "tags"], additionalProperties: false } } },
  { type: "function", function: { name: "get_notes", description: "Listar todas as notas atuais do usuário", parameters: { type: "object", properties: {}, additionalProperties: false } } },
];

export const notesToolDefinitionsCompact = [
  { type: "function", function: { name: "add_note", description: "Criar nota", parameters: { type: "object", properties: { title: { type: "string" }, content: { type: "string" } }, required: ["title", "content"], additionalProperties: false } } },
  { type: "function", function: { name: "edit_note", description: "Editar nota existente", parameters: { type: "object", properties: { note_identifier: { type: "string" }, new_title: { type: "string" }, new_content: { type: "string" } }, required: ["note_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_note", description: "Excluir nota", parameters: { type: "object", properties: { note_identifier: { type: "string" } }, required: ["note_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "get_notes", description: "Listar notas", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "favorite_note", description: "Favoritar ou desfavoritar nota", parameters: { type: "object", properties: { note_identifier: { type: "string" }, favorited: { type: "boolean" } }, required: ["note_identifier", "favorited"], additionalProperties: false } } },
  { type: "function", function: { name: "set_note_tags", description: "Definir tags de uma nota", parameters: { type: "object", properties: { note_identifier: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["note_identifier", "tags"], additionalProperties: false } } },
];
