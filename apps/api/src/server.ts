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

export async function buildServer() {
  const app = Fastify({ logger: { level: "info" } });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);
  await app.register(authPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(hermesRoutes);
  await app.register(workspacesRoutes);
  await app.register(conversationsRoutes);
  await app.register(agentsRoutes);

  return app;
}
