import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verifyMcpBearer } from "../services/mcp/auth.js";
import { buildDeshMcpServer } from "../services/mcp/server.js";
import { isServiceError } from "../services/errors.js";

const Params = z.object({ workspaceId: z.string().uuid() });

export default async function mcpRoutes(app: FastifyInstance) {
  // Streamable-HTTP MCP endpoint, one server per request (stateless).
  // Accepts POST (JSON-RPC requests) and GET (SSE for server→client
  // notifications); the SDK transport handles the protocol details. Hermes
  // connects per workspace and authenticates with the workspace's
  // `agent_profiles.callback_secret`.
  const handler = async (req: any, reply: any) => {
    const params = Params.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    let ctx: Awaited<ReturnType<typeof verifyMcpBearer>>;
    try {
      ctx = await verifyMcpBearer(req, params.data.workspaceId);
    } catch (err) {
      if (isServiceError(err)) {
        return reply.code(err.httpStatus).send({ error: err.errorCode });
      }
      throw err;
    }

    const server = buildDeshMcpServer(ctx);
    const transport = new StreamableHTTPServerTransport({
      // Stateless: every request gets a fresh server + transport. Hermes
      // doesn't need session continuity for our tool surface, and the
      // simpler lifecycle means fewer cleanup edge cases.
      sessionIdGenerator: undefined,
    });

    // Hand the raw Node req/res to the SDK; Fastify shouldn't auto-respond.
    reply.hijack();

    // Free server-side resources when the client disconnects.
    transport.onclose = () => {
      void server.close().catch(() => {});
    };

    try {
      await server.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } catch (err) {
      req.log.error({ err: err instanceof Error ? err.message : err }, "[mcp] handler failed");
      if (!reply.raw.headersSent) {
        reply.raw.statusCode = 500;
        reply.raw.end(JSON.stringify({ error: "mcp_handler_failed" }));
      }
      try {
        await server.close();
      } catch {
        /* already closing */
      }
    }
  };

  app.post("/internal/mcp/:workspaceId", handler);
  app.get("/internal/mcp/:workspaceId", handler);
  app.delete("/internal/mcp/:workspaceId", handler);
}
