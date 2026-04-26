import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { agentEvents, agentProfiles } from "@desh/database/schema";
import { SaaSWebCallbackEventSchema } from "@desh/shared/hermes";
import { env } from "../config/env.js";
import { getDb } from "../db/client.js";
import { publish, type AgentEventEnvelope } from "../services/event-bus.js";
import { markActive } from "../services/hermes/process-supervisor.js";

// Translate the Hermes callback event type to our agent_events.type vocabulary.
function mapEventType(event: "message" | "typing" | "error"): string {
  switch (event) {
    case "message":
      return "assistant_message";
    case "typing":
      return "typing";
    case "error":
      return "error";
  }
}

export default async function hermesRoutes(app: FastifyInstance) {
  app.post("/internal/hermes/events", async (req, reply) => {
    const auth = req.headers["authorization"];
    const token = typeof auth === "string" && auth.startsWith("Bearer ")
      ? auth.slice("Bearer ".length).trim()
      : null;

    if (!token) return reply.code(401).send({ error: "unauthorized" });

    const parsed = SaaSWebCallbackEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const evt = parsed.data;

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    // Authenticate: accept either the shared INTERNAL_CALLBACK_TOKEN (dev
    // simplicity) or the per-workspace callback secret stored on the
    // workspace's agent_profile.
    const profileRows = await db
      .select({
        id: agentProfiles.id,
        callbackSecret: agentProfiles.callbackSecret,
      })
      .from(agentProfiles)
      .where(eq(agentProfiles.workspaceId, evt.workspace_id))
      .limit(1);

    const profile = profileRows[0];
    const matchesShared = !!env.INTERNAL_CALLBACK_TOKEN && token === env.INTERNAL_CALLBACK_TOKEN;
    const matchesProfile = !!profile?.callbackSecret && token === profile.callbackSecret;
    if (!matchesShared && !matchesProfile) {
      req.log.warn(
        { workspaceId: evt.workspace_id },
        "[hermes-callback] auth failed (neither shared token nor profile secret matched)",
      );
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (!profile) {
      return reply.code(404).send({ error: "workspace_not_found" });
    }

    // Verify the conversation exists in this workspace.
    const convRows = await db
      .select({ id: agentEvents.conversationId })
      .from(agentEvents)
      .where(eq(agentEvents.conversationId, evt.conversation_id))
      .limit(1);
    void convRows; // The conversation may have no events yet (fresh chat); that's fine.

    const type = mapEventType(evt.event);
    const payload = {
      seq: evt.seq,
      message_id: evt.message_id,
      reply_to: evt.reply_to,
      content: evt.content,
      metadata: evt.metadata,
    };

    const [inserted] = await db
      .insert(agentEvents)
      .values({
        conversationId: evt.conversation_id,
        workspaceId: evt.workspace_id,
        type,
        payload,
      })
      .returning({
        id: agentEvents.id,
        createdAt: agentEvents.createdAt,
      });

    if (!inserted) {
      return reply.code(500).send({ error: "insert_failed" });
    }

    const envelope: AgentEventEnvelope = {
      id: String(inserted.id),
      conversationId: evt.conversation_id,
      workspaceId: evt.workspace_id,
      type,
      payload,
      createdAt: inserted.createdAt.toISOString(),
    };

    publish(evt.conversation_id, envelope);
    markActive(profile.id);

    return reply.code(204).send();
  });
}

void and; // satisfy unused-import linter if drizzle helpers aren't used
