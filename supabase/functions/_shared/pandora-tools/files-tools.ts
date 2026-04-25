/**
 * @module pandora-tools/files-tools
 * @description Tool definitions for Files & Folders
 */

export const filesToolDefinitions = [
  { type: "function", function: { name: "get_files", description: "Listar arquivos", parameters: { type: "object", properties: { limit: { type: "number" } }, additionalProperties: false } } },
  { type: "function", function: { name: "search_files", description: "Buscar arquivos por nome", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } } },
  { type: "function", function: { name: "delete_file", description: "Excluir arquivo", parameters: { type: "object", properties: { file_identifier: { type: "string" } }, required: ["file_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "move_file", description: "Mover um arquivo para outra pasta", parameters: { type: "object", properties: { file_identifier: { type: "string", description: "Nome ou ID do arquivo" }, folder_identifier: { type: "string", description: "Nome ou ID da pasta de destino" } }, required: ["file_identifier", "folder_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "rename_file", description: "Renomear um arquivo", parameters: { type: "object", properties: { file_identifier: { type: "string", description: "Nome ou ID do arquivo" }, new_name: { type: "string", description: "Novo nome do arquivo" } }, required: ["file_identifier", "new_name"], additionalProperties: false } } },
  { type: "function", function: { name: "favorite_file", description: "Favoritar ou desfavoritar um arquivo", parameters: { type: "object", properties: { file_identifier: { type: "string", description: "Nome ou ID do arquivo" }, favorite: { type: "boolean", description: "true para favoritar, false para desfavoritar" } }, required: ["file_identifier", "favorite"], additionalProperties: false } } },
  { type: "function", function: { name: "create_folder", description: "Criar uma nova pasta para organizar arquivos", parameters: { type: "object", properties: { name: { type: "string", description: "Nome da pasta" }, color: { type: "string", description: "Cor da pasta (hex, opcional)" }, icon: { type: "string", description: "Emoji ícone da pasta (opcional)" } }, required: ["name"], additionalProperties: false } } },
  { type: "function", function: { name: "get_folders", description: "Listar todas as pastas de arquivos", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "trash_file", description: "Mover arquivo para a lixeira (não exclui permanentemente)", parameters: { type: "object", properties: { file_identifier: { type: "string", description: "Nome ou ID do arquivo" } }, required: ["file_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "restore_file", description: "Restaurar arquivo da lixeira", parameters: { type: "object", properties: { file_identifier: { type: "string", description: "Nome ou ID do arquivo" } }, required: ["file_identifier"], additionalProperties: false } } },
  { type: "function", function: { name: "get_file_stats", description: "Estatísticas de armazenamento: total de arquivos, espaço usado, por categoria, duplicatas", parameters: { type: "object", properties: {}, additionalProperties: false } } },
];
