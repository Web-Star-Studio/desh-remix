import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { composioConnections } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import {
  getEmail,
  listEmails,
  patchEmail,
  searchEmails,
  trashEmail,
} from "../services/emails.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";
import { assertWorkspaceMember } from "../services/workspace-members.js";
import { enqueue } from "../services/jobs.js";
import {
  subscribeEmailBus,
  type EmailEventEnvelope,
} from "../services/email-event-bus.js";

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const EmailParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
});

const ListQuery = z.object({
  folder: z.string().min(1).max(40).optional(),
  label: z.string().min(1).max(120).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  cursor: z.string().datetime().optional(),
});

const SearchQuery = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const PatchBody = z.object({
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  labelIds: z.array(z.string().max(120)).max(100).optional(),
  folder: z.string().max(40).optional(),
});

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function emailsRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/emails", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const query = ListQuery.safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_query", details: query.error.flatten() });
    }
    try {
      return await listEmails(params.data.workspaceId, dbId, query.data);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/workspaces/:workspaceId/emails/search", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const query = SearchQuery.safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_query", details: query.error.flatten() });
    }
    try {
      return await searchEmails(
        params.data.workspaceId,
        dbId,
        query.data.q,
        query.data.limit,
      );
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/workspaces/:workspaceId/emails/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = EmailParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await getEmail(params.data.workspaceId, dbId, params.data.id);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/workspaces/:workspaceId/emails/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = EmailParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      return await patchEmail(
        params.data.workspaceId,
        dbId,
        params.data.id,
        parsed.data,
      );
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/emails/:id/trash", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = EmailParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await trashEmail(params.data.workspaceId, dbId, params.data.id);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  // SSE stream of email-cache events for a workspace. Replaces the SPA's 60s
  // polling — the SPA gets `upsert`/`delete` notifications and refetches
  // affected pages. The bus is in-memory: late subscribers don't replay any
  // history, but they immediately catch up via a one-shot refetch on connect.
  app.get("/workspaces/:workspaceId/emails/events", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await assertWorkspaceMember(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
      return;
    }

    const raw = reply.raw;
    raw.setHeader("Content-Type", "text/event-stream");
    raw.setHeader("Cache-Control", "no-cache, no-transform");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("X-Accel-Buffering", "no");
    // Mirror the conversations SSE — @fastify/cors's onSend hook is bypassed
    // by raw writes, so set CORS headers manually.
    const origin = req.headers.origin;
    if (typeof origin === "string" && origin.length > 0) {
      raw.setHeader("Access-Control-Allow-Origin", origin);
      raw.setHeader("Access-Control-Allow-Credentials", "true");
      raw.setHeader("Vary", "Origin");
    }
    raw.flushHeaders?.();

    const write = (event: EmailEventEnvelope) => {
      try {
        raw.write(`event: ${event.type}\n`);
        raw.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {
        /* peer gone */
      }
    };

    const unsubscribe = subscribeEmailBus(params.data.workspaceId, write);
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

    // Send a ready event so the SPA knows the channel is live.
    write({
      type: "upsert",
      workspaceId: params.data.workspaceId,
      gmailIds: [],
      ts: new Date().toISOString(),
    });

    await new Promise<void>((resolve) => {
      req.raw.on("close", () => resolve());
    });
    return reply;
  });

  // Manual sync trigger — enqueues a gmail.incremental-sync job for each of
  // the workspace's Gmail connections. The webhook handles automatic sync;
  // this endpoint is for the SPA's "Sync now" button.
  app.post("/workspaces/:workspaceId/emails/sync", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await assertWorkspaceMember(params.data.workspaceId, dbId);
      const db = getDb();
      if (!db) return reply.code(500).send({ error: "db_unavailable" });

      const conns = await db
        .select({ id: composioConnections.id })
        .from(composioConnections)
        .where(
          and(
            eq(composioConnections.workspaceId, params.data.workspaceId),
            eq(composioConnections.toolkit, "gmail"),
            eq(composioConnections.status, "active"),
          ),
        );
      let enqueued = 0;
      for (const conn of conns) {
        try {
          await enqueue("gmail.incremental-sync", {
            workspaceId: params.data.workspaceId,
            connectionId: conn.id,
          });
          enqueued++;
        } catch (err) {
          req.log.warn({ err, connectionId: conn.id }, "[emails-sync] enqueue failed");
        }
      }
      return { enqueued, connections: conns.length };
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
