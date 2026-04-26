import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, asc, eq, gt } from "drizzle-orm";
import {
  agentEvents,
  agentProfiles,
  conversations,
  workspaceMembers,
  workspaces,
} from "@desh/database/schema";
import type { SaaSWebMessage } from "@desh/shared/hermes";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";
import { sendHermesMessage, HermesUnavailableError } from "../services/hermes-client.js";
import { subscribe, type AgentEventEnvelope } from "../services/event-bus.js";

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const IdParams = z.object({ id: z.string().uuid() });
const CreateBody = z.object({
  title: z.string().min(1).max(200).optional(),
  agentProfileId: z.string().uuid().optional(),
});
const PatchBody = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "archived"]).optional(),
});
const MessageBody = z.object({
  text: z.string().min(1).max(10_000),
  message_id: z.string().min(1).max(64).optional(),
});

interface ConversationRow {
  id: string;
  workspaceId: string;
  agentProfileId: string;
  createdBy: string;
  title: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

function toApi(c: ConversationRow) {
  return {
    id: c.id,
    workspaceId: c.workspaceId,
    agentProfileId: c.agentProfileId,
    createdBy: c.createdBy,
    title: c.title,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// Resolves the conversation + verifies the caller is a member of its workspace.
async function loadConversationForUser(
  conversationId: string,
  userDbId: string,
): Promise<ConversationRow | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: conversations.id,
      workspaceId: conversations.workspaceId,
      agentProfileId: conversations.agentProfileId,
      createdBy: conversations.createdBy,
      title: conversations.title,
      status: conversations.status,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, conversations.workspaceId),
        eq(workspaceMembers.userId, userDbId),
      ),
    )
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return rows[0] ?? null;
}

export default async function conversationsRoutes(app: FastifyInstance) {
  // List conversations in a workspace (membership-checked).
  app.get("/workspaces/:workspaceId/conversations", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_workspace_id" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const member = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, params.data.workspaceId),
          eq(workspaceMembers.userId, dbId),
        ),
      )
      .limit(1);
    if (!member[0]) return reply.code(404).send({ error: "workspace_not_found" });

    const rows = await db
      .select()
      .from(conversations)
      .where(eq(conversations.workspaceId, params.data.workspaceId))
      .orderBy(asc(conversations.createdAt));
    return rows.map(toApi);
  });

  // Create a conversation in a workspace.
  app.post("/workspaces/:workspaceId/conversations", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_workspace_id" });
    const parsed = CreateBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const member = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, params.data.workspaceId),
          eq(workspaceMembers.userId, dbId),
        ),
      )
      .limit(1);
    if (!member[0]) return reply.code(404).send({ error: "workspace_not_found" });

    // Resolve the agent_profile: explicit id or the workspace's first one.
    let agentProfileId = body.agentProfileId;
    if (!agentProfileId) {
      const profileRow = await db
        .select({ id: agentProfiles.id })
        .from(agentProfiles)
        .where(eq(agentProfiles.workspaceId, params.data.workspaceId))
        .limit(1);
      if (!profileRow[0]) {
        return reply.code(409).send({ error: "no_agent_profile" });
      }
      agentProfileId = profileRow[0].id;
    }

    const [created] = await db
      .insert(conversations)
      .values({
        workspaceId: params.data.workspaceId,
        agentProfileId,
        createdBy: dbId,
        title: body.title ?? null,
      })
      .returning();
    if (!created) return reply.code(500).send({ error: "insert_failed" });
    return reply.code(201).send(toApi(created));
  });

  app.get("/conversations/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = IdParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const conv = await loadConversationForUser(params.data.id, dbId);
    if (!conv) return reply.code(404).send({ error: "not_found" });
    return toApi(conv);
  });

  app.patch("/conversations/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = IdParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.code(400).send({ error: "empty_patch" });
    }
    const conv = await loadConversationForUser(params.data.id, dbId);
    if (!conv) return reply.code(404).send({ error: "not_found" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });
    const [updated] = await db
      .update(conversations)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(conversations.id, params.data.id))
      .returning();
    if (!updated) return reply.code(404).send({ error: "not_found" });
    return toApi(updated);
  });

  app.delete("/conversations/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = IdParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const conv = await loadConversationForUser(params.data.id, dbId);
    if (!conv) return reply.code(404).send({ error: "not_found" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });
    await db.delete(conversations).where(eq(conversations.id, params.data.id));
    return reply.code(204).send();
  });

  // Hot path: send a user message. Lazy-starts Hermes, persists user_message
  // event, forwards to the gateway. Assistant events arrive asynchronously
  // via /internal/hermes/events and are streamed to the SPA via SSE.
  app.post("/conversations/:id/messages", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = IdParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const parsed = MessageBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const conv = await loadConversationForUser(params.data.id, dbId);
    if (!conv) return reply.code(404).send({ error: "not_found" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const profileRow = await db
      .select({
        id: agentProfiles.id,
        hermesPort: agentProfiles.hermesPort,
        adapterSecret: agentProfiles.adapterSecret,
      })
      .from(agentProfiles)
      .where(eq(agentProfiles.id, conv.agentProfileId))
      .limit(1);
    const profile = profileRow[0];
    if (!profile?.hermesPort || !profile?.adapterSecret) {
      return reply.code(503).send({
        error: "agent_unavailable",
        reason: "profile_not_provisioned",
      });
    }

    const workspaceRow = await db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, conv.workspaceId))
      .limit(1);

    const messageId = parsed.data.message_id ?? randomUUID();
    const userName = req.dbUser?.displayName ?? req.dbUser?.email ?? "user";

    // Persist the user_message event before forwarding to Hermes so SSE
    // subscribers see it on replay even if Hermes drops the request.
    await db.insert(agentEvents).values({
      conversationId: conv.id,
      workspaceId: conv.workspaceId,
      userId: dbId,
      type: "user_message",
      payload: { text: parsed.data.text, message_id: messageId },
    });

    const payload: SaaSWebMessage = {
      text: parsed.data.text,
      conversation_id: conv.id,
      conversation_name: conv.title ?? undefined,
      message_id: messageId,
      workspace_id: conv.workspaceId,
      workspace_name: workspaceRow[0]?.name,
      user_id: dbId,
      user_name: userName,
    };

    try {
      const response = await sendHermesMessage(
        {
          profileId: profile.id,
          port: profile.hermesPort,
          adapterSecret: profile.adapterSecret,
        },
        payload,
      );
      return reply.code(202).send({
        status: response.status,
        message_id: response.message_id,
        conversation_id: response.conversation_id,
      });
    } catch (err) {
      if (err instanceof HermesUnavailableError) {
        req.log.warn({ err: err.message, reason: err.reason }, "[messages] Hermes unavailable");
        return reply.code(503).send({ error: "agent_unavailable", reason: err.reason });
      }
      throw err;
    }
  });

  // SSE stream of agent_events for a conversation. Replays past events since
  // ?after=<id> (default: from start, capped to last 200), then tails new ones
  // via the in-memory event-bus subscription.
  app.get("/conversations/:id/events", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = IdParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    const conv = await loadConversationForUser(params.data.id, dbId);
    if (!conv) return reply.code(404).send({ error: "not_found" });

    const after = parseAfter(req);

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const raw = reply.raw;
    raw.setHeader("Content-Type", "text/event-stream");
    raw.setHeader("Cache-Control", "no-cache, no-transform");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("X-Accel-Buffering", "no");
    // SSE writes to reply.raw and flushes headers immediately, which bypasses
    // the @fastify/cors plugin's onSend hook. Mirror its origin: true +
    // credentials: true config manually here so the browser doesn't reject
    // the stream after a successful preflight.
    const origin = req.headers.origin;
    if (typeof origin === "string" && origin.length > 0) {
      raw.setHeader("Access-Control-Allow-Origin", origin);
      raw.setHeader("Access-Control-Allow-Credentials", "true");
      raw.setHeader("Vary", "Origin");
    }
    raw.flushHeaders?.();

    const writeEnvelope = (env: AgentEventEnvelope) => {
      raw.write(`id: ${env.id}\n`);
      raw.write(`data: ${JSON.stringify(env)}\n\n`);
    };

    // Replay
    const replay = await db
      .select()
      .from(agentEvents)
      .where(
        after != null
          ? and(eq(agentEvents.conversationId, conv.id), gt(agentEvents.id, BigInt(after)))
          : eq(agentEvents.conversationId, conv.id),
      )
      .orderBy(asc(agentEvents.id))
      .limit(200);

    for (const row of replay) {
      writeEnvelope({
        id: String(row.id),
        conversationId: row.conversationId,
        workspaceId: row.workspaceId,
        type: row.type,
        payload: row.payload,
        createdAt: row.createdAt.toISOString(),
      });
    }

    const unsubscribe = subscribe(conv.id, writeEnvelope);

    const heartbeat = setInterval(() => {
      try {
        raw.write(`: ping\n\n`);
      } catch {
        /* peer gone */
      }
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };
    req.raw.on("close", cleanup);
    req.raw.on("error", cleanup);

    // Returning a never-resolving promise keeps the connection open.
    await new Promise<void>((resolve) => {
      req.raw.on("close", () => resolve());
    });
    return reply;
  });
}

function parseAfter(req: FastifyRequest): string | null {
  const q = (req.query as { after?: unknown } | null | undefined)?.after;
  if (typeof q === "string" && /^\d+$/.test(q)) return q;
  return null;
}
