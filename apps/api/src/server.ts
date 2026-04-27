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
import zernioRoutes from "./routes/zernio.js";
import socialAlertsRoutes from "./routes/social-alerts.js";
import socialAiInsightsRoutes from "./routes/social-ai-insights.js";
import tasksRoutes from "./routes/tasks.js";
import contactsRoutes from "./routes/contacts.js";
import filesRoutes from "./routes/files.js";
import profileDocumentsRoutes from "./routes/profile-documents.js";
import credentialsRoutes from "./routes/credentials.js";
import mcpRoutes from "./routes/mcp.js";
import emailsRoutes from "./routes/emails.js";
import gmailLabelsRoutes from "./routes/gmail-labels.js";
import emailSnoozesRoutes from "./routes/email-snoozes.js";
import gmailWebhookRoutes from "./routes/gmail-webhook.js";
import notificationsRoutes from "./routes/notifications.js";
import emailTemplatesRoutes from "./routes/email-templates.js";
import emailAutomationsRoutes from "./routes/email-automations.js";
import emailStatsRoutes from "./routes/email-stats.js";
import emailUnsubscribeRoutes from "./routes/email-unsubscribe.js";
import fileFoldersRoutes from "./routes/file-folders.js";
import notesRoutes from "./routes/notes.js";

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
  await app.register(zernioRoutes);
  await app.register(socialAlertsRoutes);
  await app.register(socialAiInsightsRoutes);
  await app.register(tasksRoutes);
  await app.register(contactsRoutes);
  await app.register(filesRoutes);
  await app.register(profileDocumentsRoutes);
  await app.register(credentialsRoutes);
  await app.register(mcpRoutes);
  await app.register(emailsRoutes);
  await app.register(gmailLabelsRoutes);
  await app.register(emailSnoozesRoutes);
  await app.register(gmailWebhookRoutes);
  await app.register(notificationsRoutes);
  await app.register(emailTemplatesRoutes);
  await app.register(emailAutomationsRoutes);
  await app.register(emailStatsRoutes);
  await app.register(emailUnsubscribeRoutes);
  await app.register(fileFoldersRoutes);
  await app.register(notesRoutes);

  return app;
}
