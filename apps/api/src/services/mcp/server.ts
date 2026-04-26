import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTaskTools } from "./tools-tasks.js";
import { registerContactTools } from "./tools-contacts.js";
import type { McpAuthContext } from "./auth.js";

/**
 * Builds a fresh MCP server bound to a single workspace's context. Tools
 * close over `ctx`, so each request that hits `/internal/mcp/:workspaceId`
 * gets a server scoped to that workspace and its owner — no cross-tenant
 * leakage by construction.
 *
 * The server is one-shot in stateless mode: build, connect a transport,
 * handle the request, garbage-collect.
 */
export function buildDeshMcpServer(ctx: McpAuthContext): McpServer {
  const server = new McpServer(
    { name: "desh", version: "0.1.0" },
    {
      instructions:
        "Ferramentas de primeira-parte do Desh para tarefas e contatos do workspace ativo.",
    },
  );

  registerTaskTools(server, ctx);
  registerContactTools(server, ctx);

  return server;
}
