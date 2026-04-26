import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { agentEvents, agentProfiles } from "@desh/database/schema";
import {
  HermesOutboundEventSchema,
  type HermesOutboundEvent,
} from "@desh/shared/hermes";
import { env } from "../config/env.js";
import { getDb } from "../db/client.js";
import { publish, type AgentEventEnvelope } from "../services/event-bus.js";
import { markActive } from "../services/hermes/process-supervisor.js";

// Maps the rich Hermes event names onto our `agent_events.type` column.
//
// Legacy `message` becomes `assistant_message` so existing SPA code that
// renders that type keeps working. Everything else is stored verbatim
// (with the dot in the name) so the client can filter on event family
// without re-deriving it from a payload field.
function mapEventType(event: HermesOutboundEvent["event"]): string {
  if (event === "message") return "assistant_message";
  return event;
}

// Events that are pure liveness signals — high-frequency, transient,
// useless on replay. These are still broadcast to live SSE subscribers
// (so the chat panel can show typing indicators / streaming drafts) but
// never written to agent_events. Storing them blew up the table and made
// every SSE reconnect re-arm 30s of stale UI state.
const EPHEMERAL_EVENTS = new Set<HermesOutboundEvent["event"]>([
  "typing",
  "message.delta",
  "reasoning.started",
]);

// Builds the `payload` jsonb that goes on agent_events / SSE envelopes.
// We strip the envelope-shared fields (seq/platform/conversation_id/etc.)
// since they live as DB columns or are redundant; what remains is the
// event-specific payload (delta, tool_call_id, summary, …) plus the small
// number of envelope fields the client genuinely needs.
function buildPayload(evt: HermesOutboundEvent): Record<string, unknown> {
  const { event, platform, conversation_id, workspace_id, ...rest } = evt;
  void event; void platform; void conversation_id; void workspace_id;
  return rest as Record<string, unknown>;
}

export default async function hermesRoutes(app: FastifyInstance) {
  app.post("/internal/hermes/events", async (req, reply) => {
    const auth = req.headers["authorization"];
    const token = typeof auth === "string" && auth.startsWith("Bearer ")
      ? auth.slice("Bearer ".length).trim()
      : null;

    if (!token) return reply.code(401).send({ error: "unauthorized" });

    const parsed = HermesOutboundEventSchema.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn(
        { details: parsed.error.flatten(), event: (req.body as { event?: unknown })?.event },
        "[hermes-callback] schema rejection",
      );
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
        { workspaceId: evt.workspace_id, event: evt.event },
        "[hermes-callback] auth failed (neither shared token nor profile secret matched)",
      );
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (!profile) {
      return reply.code(404).send({ error: "workspace_not_found" });
    }

    const type = mapEventType(evt.event);
    const payload = buildPayload(evt);

    let envelope: AgentEventEnvelope;
    if (EPHEMERAL_EVENTS.has(evt.event)) {
      envelope = {
        id: `eph_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        conversationId: evt.conversation_id,
        workspaceId: evt.workspace_id,
        type,
        payload,
        createdAt: new Date().toISOString(),
      };
    } else {
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

      envelope = {
        id: String(inserted.id),
        conversationId: evt.conversation_id,
        workspaceId: evt.workspace_id,
        type,
        payload,
        createdAt: inserted.createdAt.toISOString(),
      };
    }

    publish(evt.conversation_id, envelope);
    markActive(profile.id);

    return reply.code(204).send();
  });
}
