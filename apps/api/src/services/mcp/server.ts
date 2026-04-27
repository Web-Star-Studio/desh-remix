import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTaskTools } from "./tools-tasks.js";
import { registerContactTools } from "./tools-contacts.js";
import { registerEmailTools } from "./tools-emails.js";
import { registerSocialTools } from "./tools-social.js";
import type { McpAuthContext } from "./auth.js";

/**
 * Builds a fresh MCP server bound to a single workspace's context. Tools
 * close over `ctx`, so each request that hits `/internal/mcp/:workspaceId`
 * gets a server scoped to that workspace and its owner — no cross-tenant
 * leakage by construction.
 *
 * Tool families:
 *   - tasks/contacts/emails: first-party Desh data
 *   - social/whatsapp/inbox/media: Zernio-backed. Each handler resolves the
 *     workspace's `zernio_profile_id` server-side and injects it into the
 *     Zernio API call, so the agent never sees other workspaces' data even
 *     though the upstream API key is shared.
 *
 * The server is one-shot in stateless mode: build, connect a transport,
 * handle the request, garbage-collect.
 */
export function buildDeshMcpServer(ctx: McpAuthContext): McpServer {
  const server = new McpServer(
    { name: "desh", version: "0.1.0" },
    {
      instructions:
        "Ferramentas de primeira-parte do Desh: tarefas, contatos, e-mails, redes sociais e WhatsApp Business — todas escopadas ao workspace ativo.",
    },
  );

  registerTaskTools(server, ctx);
  registerContactTools(server, ctx);
  registerEmailTools(server, ctx);
  registerSocialTools(server, ctx);

  return server;
}
