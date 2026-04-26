import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  createContact,
  createInteraction,
  findContacts,
  type ApiContact,
  type InteractionType,
} from "../contacts.js";
import type { McpAuthContext } from "./auth.js";
import { toolError, toolText } from "./tool-result.js";

function slimContact(c: ApiContact) {
  return {
    id: c.id,
    name: c.name,
    email: c.email || null,
    phone: c.phone || null,
    company: c.company || null,
    role: c.role || null,
  };
}

export function registerContactTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "find_contact",
    {
      title: "Find contact",
      description:
        "Busca contatos por trecho de nome, e-mail, telefone ou empresa (case-insensitive). Retorna até `limit` contatos (padrão 10).",
      inputSchema: {
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async (args) => {
      try {
        const rows = await findContacts(
          ctx.workspaceId,
          ctx.ownerUserId,
          args.query,
          args.limit ?? 10,
        );
        return toolText(rows.map(slimContact));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "create_contact",
    {
      title: "Create contact",
      description: "Cria um novo contato no workspace ativo. Retorna { id, name }.",
      inputSchema: {
        name: z.string().min(1).max(200),
        email: z.string().email().optional(),
        phone: z.string().max(80).optional(),
        company: z.string().max(200).optional(),
        role: z.string().max(120).optional(),
        notes: z.string().max(8000).optional(),
      },
    },
    async (args) => {
      try {
        const row = await createContact(ctx.workspaceId, ctx.ownerUserId, args);
        return toolText({ id: row.id, name: row.name });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "log_interaction",
    {
      title: "Log contact interaction",
      description:
        "Registra uma interação com um contato (ligação, reunião, e-mail, mensagem ou nota). `interactionDate` no formato ISO 8601 se informado; padrão = agora.",
      inputSchema: {
        contactId: z.string().uuid(),
        type: z.enum(["note", "call", "email", "meeting", "message", "other"]).optional(),
        title: z.string().min(1).max(300),
        description: z.string().max(8000).optional(),
        interactionDate: z.string().datetime().optional(),
      },
    },
    async (args) => {
      try {
        const row = await createInteraction(ctx.workspaceId, ctx.ownerUserId, args.contactId, {
          type: args.type as InteractionType | undefined,
          title: args.title,
          description: args.description,
          interactionDate: args.interactionDate,
        });
        return toolText({
          id: row.id,
          type: row.type,
          title: row.title,
          interactionDate: row.interactionDate,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
