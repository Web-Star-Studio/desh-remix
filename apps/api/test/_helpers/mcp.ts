import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildDeshMcpServer } from "../../src/services/mcp/server.js";
import type { McpAuthContext } from "../../src/services/mcp/auth.js";

/**
 * Spin up an in-memory MCP client/server pair connected via paired
 * InMemoryTransports. Skips the streamable-HTTP transport entirely — the
 * route-level auth tests cover that surface; this helper is for testing
 * tool behavior end-to-end in a deterministic, fast way.
 */
export async function buildTestMcpClient(ctx: McpAuthContext): Promise<{
  client: Client;
  cleanup: () => Promise<void>;
}> {
  const server = buildDeshMcpServer(ctx);
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    client,
    cleanup: async () => {
      await client.close();
      await server.close();
    },
  };
}
