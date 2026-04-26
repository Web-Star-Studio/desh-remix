import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import authPlugin from "./auth/plugin.js";
import authRoutes from "./routes/auth.js";
import meRoutes from "./routes/me.js";
import healthRoutes from "./routes/health.js";
import hermesRoutes from "./routes/hermes.js";
import workspacesRoutes from "./routes/workspaces.js";
import conversationsRoutes from "./routes/conversations.js";
import agentsRoutes from "./routes/agents.js";
import composioRoutes from "./routes/composio.js";
import tasksRoutes from "./routes/tasks.js";
import contactsRoutes from "./routes/contacts.js";
import filesRoutes from "./routes/files.js";
import credentialsRoutes from "./routes/credentials.js";
import mcpRoutes from "./routes/mcp.js";

export async function buildServer() {
  const app = Fastify({ logger: { level: "info" } });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);

  // Replace the default JSON parser so /composio/webhook (and any other route
  // that needs HMAC verification) can read the raw bytes via req.rawBody.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as unknown as { rawBody: string }).rawBody = body as string;
    if (!body) return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(hermesRoutes);
  await app.register(workspacesRoutes);
  await app.register(conversationsRoutes);
  await app.register(agentsRoutes);
  await app.register(composioRoutes);
  await app.register(tasksRoutes);
  await app.register(contactsRoutes);
  await app.register(filesRoutes);
  await app.register(credentialsRoutes);
  await app.register(mcpRoutes);

  return app;
}
