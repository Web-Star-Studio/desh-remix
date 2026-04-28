import type { FastifyInstance, FastifyReply } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  financialAccounts,
  financialConnections,
  financialInvestments,
  financialLoans,
  financialSyncLogs,
  financialTransactionsUnified,
  workspaceMembers,
} from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { env } from "../config/env.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";
import {
  PluggyApiError,
  createConnectToken,
  deleteItem,
  getItem,
  isPluggyConfigured,
} from "../services/pluggy.js";
import { runPluggySync } from "../services/finance-sync.js";
import { enqueue, getJobs } from "../services/jobs.js";
import { FINANCE_PLUGGY_SYNC, type PluggySyncPayload } from "../services/finance-jobs.js";

// Pluggy-backed finance routes (Wave B). The Wave A handlers in routes/
// finance.ts cover manual-entry features (goals, transactions, recurring,
// budgets); these add the connections/accounts/investments/loans/sync-logs
// surfaces fed by Pluggy + the upstream webhook.

const WorkspaceParams = z.object({ id: z.string().uuid() });
const ConnectionParams = z.object({
  id: z.string().uuid(),
  connectionId: z.string().uuid(),
});

function sendServiceError(reply: FastifyReply, err: unknown) {
  if (isServiceError(err)) return reply.code(err.httpStatus).send({ error: err.errorCode });
  if (err instanceof PluggyApiError) {
    return reply.code(err.status ?? 502).send({
      error: err.code,
      message: err.message,
      retryable: err.retryable,
    });
  }
  return reply.code(500).send({ error: "internal_error", message: (err as Error).message ?? "" });
}

async function requireMembership(workspaceId: string, userDbId: string) {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userDbId)))
    .limit(1);
  return rows[0] ?? null;
}

export default async function financePluggyRoutes(app: FastifyInstance) {
  // ── Health/status ─────────────────────────────────────────────────────────
  // SPA gates the "Connect bank" button on this. Returns the configured flag
  // (env present) and a connection count for quick badge rendering.

  app.get("/workspaces/:id/finance/pluggy/status", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(financialConnections)
      .where(
        and(
          eq(financialConnections.workspaceId, params.data.id),
          eq(financialConnections.provider, "pluggy"),
        ),
      );

    return {
      configured: isPluggyConfigured(),
      connectionsCount: countRows[0]?.count ?? 0,
    };
  });

  // ── Connect token ─────────────────────────────────────────────────────────
  // Mints a short-lived token bound to either a fresh connect (no itemId) or
  // an existing one (reconnect flow). `clientUserId` is the Desh workspace id
  // — when the SPA's Pluggy Connect widget completes, the upstream webhook
  // payload carries this back so we can attribute the new item.

  app.post("/workspaces/:id/finance/pluggy/connect-token", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const Body = z
      .object({
        connectionId: z.string().uuid().optional(),
      })
      .safeParse(req.body ?? {});
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    let upstreamItemId: string | undefined;
    if (Body.data.connectionId) {
      const [conn] = await db
        .select({ providerConnectionId: financialConnections.providerConnectionId })
        .from(financialConnections)
        .where(
          and(
            eq(financialConnections.id, Body.data.connectionId),
            eq(financialConnections.workspaceId, params.data.id),
          ),
        )
        .limit(1);
      if (!conn) return reply.code(404).send({ error: "connection_not_found" });
      upstreamItemId = conn.providerConnectionId;
    }

    try {
      const token = await createConnectToken({
        clientUserId: params.data.id,
        itemId: upstreamItemId,
      });
      return token;
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  // ── Connections ──────────────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/pluggy/connections", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const rows = await db
      .select()
      .from(financialConnections)
      .where(
        and(
          eq(financialConnections.workspaceId, params.data.id),
          eq(financialConnections.provider, "pluggy"),
        ),
      )
      .orderBy(desc(financialConnections.createdAt));

    return { connections: rows };
  });

  app.post("/workspaces/:id/finance/pluggy/connections", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const Body = z
      .object({
        itemId: z.string().min(1),
      })
      .safeParse(req.body);
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    let item;
    try {
      item = await getItem(Body.data.itemId);
    } catch (err) {
      return sendServiceError(reply, err);
    }

    const [row] = await db
      .insert(financialConnections)
      .values({
        workspaceId: params.data.id,
        userId: dbId,
        provider: "pluggy",
        providerConnectionId: item.id,
        institutionName: item.connector?.name ?? null,
        institutionLogoUrl: item.connector?.imageUrl ?? null,
        status: "syncing",
        rawMetadata: item as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [
          financialConnections.workspaceId,
          financialConnections.provider,
          financialConnections.providerConnectionId,
        ],
        set: {
          institutionName: item.connector?.name ?? null,
          institutionLogoUrl: item.connector?.imageUrl ?? null,
          status: "syncing",
          rawMetadata: item as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) return reply.code(500).send({ error: "insert_failed" });

    // Kick off an initial sync so the SPA can poll sync-logs to surface
    // progress without blocking on the request. Falls back to inline if
    // pg-boss isn't running (test env without started job runner).
    if (getJobs()) {
      await enqueue<PluggySyncPayload>(FINANCE_PLUGGY_SYNC, {
        workspaceId: params.data.id,
        connectionId: row.id,
        triggeredByUserId: dbId,
      });
    } else {
      void runPluggySync(params.data.id, row.id, { triggeredByUserId: dbId }).catch((err) => {
        req.log.error({ err }, "[finance-pluggy] inline sync failed");
      });
    }

    return reply.code(201).send({ connection: row });
  });

  app.delete("/workspaces/:id/finance/pluggy/connections/:connectionId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ConnectionParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const [conn] = await db
      .select()
      .from(financialConnections)
      .where(
        and(
          eq(financialConnections.id, params.data.connectionId),
          eq(financialConnections.workspaceId, params.data.id),
        ),
      )
      .limit(1);
    if (!conn) return reply.code(404).send({ error: "connection_not_found" });

    // Best-effort upstream delete — Pluggy may have already removed the item
    // (user revoked from their bank), so we don't fail the request on an
    // upstream 404. The local cascade still happens.
    try {
      await deleteItem(conn.providerConnectionId);
    } catch (err) {
      if (!(err instanceof PluggyApiError && err.code === "not_found")) {
        req.log.warn({ err }, "[finance-pluggy] upstream delete failed; continuing local cascade");
      }
    }

    await db.delete(financialConnections).where(eq(financialConnections.id, conn.id));

    return reply.code(204).send();
  });

  app.post("/workspaces/:id/finance/pluggy/connections/:connectionId/sync", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ConnectionParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const Body = z
      .object({
        fromDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
          .optional(),
      })
      .safeParse(req.body ?? {});
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });

    if (getJobs()) {
      const jobId = await enqueue<PluggySyncPayload>(FINANCE_PLUGGY_SYNC, {
        workspaceId: params.data.id,
        connectionId: params.data.connectionId,
        fromDate: Body.data.fromDate,
        triggeredByUserId: dbId,
      });
      return reply.code(202).send({ enqueued: true, jobId });
    }

    try {
      const result = await runPluggySync(params.data.id, params.data.connectionId, {
        fromDate: Body.data.fromDate,
        triggeredByUserId: dbId,
      });
      return reply.code(200).send(result);
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  // ── Accounts ──────────────────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/pluggy/accounts", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const rows = await db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.workspaceId, params.data.id))
      .orderBy(desc(financialAccounts.lastSyncedAt));

    return { accounts: rows };
  });

  // ── Unified transactions ──────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/pluggy/transactions", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const Q = z
      .object({
        accountId: z.string().uuid().optional(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        limit: z.coerce.number().int().min(1).max(500).default(200),
      })
      .safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const conds = [eq(financialTransactionsUnified.workspaceId, params.data.id)];
    if (Q.data.accountId) conds.push(eq(financialTransactionsUnified.accountId, Q.data.accountId));
    if (Q.data.from) conds.push(sql`${financialTransactionsUnified.date} >= ${Q.data.from}`);
    if (Q.data.to) conds.push(sql`${financialTransactionsUnified.date} <= ${Q.data.to}`);

    const rows = await db
      .select()
      .from(financialTransactionsUnified)
      .where(and(...conds))
      .orderBy(desc(financialTransactionsUnified.date), desc(financialTransactionsUnified.createdAt))
      .limit(Q.data.limit);

    return { transactions: rows };
  });

  // ── Investments ──────────────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/pluggy/investments", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const rows = await db
      .select()
      .from(financialInvestments)
      .where(eq(financialInvestments.workspaceId, params.data.id))
      .orderBy(desc(financialInvestments.lastSyncedAt));

    return { investments: rows };
  });

  // ── Loans ────────────────────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/pluggy/loans", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const rows = await db
      .select()
      .from(financialLoans)
      .where(eq(financialLoans.workspaceId, params.data.id))
      .orderBy(desc(financialLoans.updatedAt));

    return { loans: rows };
  });

  // ── Sync logs ────────────────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/pluggy/sync-logs", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });

    const Q = z
      .object({
        connectionId: z.string().uuid().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const conds = [eq(financialSyncLogs.workspaceId, params.data.id)];
    if (Q.data.connectionId) conds.push(eq(financialSyncLogs.connectionId, Q.data.connectionId));

    const rows = await db
      .select()
      .from(financialSyncLogs)
      .where(and(...conds))
      .orderBy(desc(financialSyncLogs.createdAt))
      .limit(Q.data.limit);

    return { syncLogs: rows };
  });

  // ── Webhook ──────────────────────────────────────────────────────────────
  // Pluggy posts events for item lifecycle (created/updated/error/deleted)
  // and transactions (deleted/updated). We re-trigger a sync for item/* and
  // mutate connection.status for the others. Signature verification follows
  // the Composio shape: HMAC-SHA256 of `${ts}.${rawBody}` with a 5-minute
  // timestamp tolerance.

  app.post("/finance/pluggy-webhook", async (req, reply) => {
    const secret = env.PLUGGY_WEBHOOK_SECRET;
    if (!secret) {
      req.log.warn("[pluggy-webhook] PLUGGY_WEBHOOK_SECRET unset — refusing");
      return reply.code(503).send({ error: "webhook_secret_unset" });
    }

    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? "";
    if (!rawBody) return reply.code(400).send({ error: "empty_body" });

    const ts = String(req.headers["x-pluggy-signature-timestamp"] ?? "");
    const sig = String(req.headers["x-pluggy-signature"] ?? "");
    if (!ts || !sig) return reply.code(401).send({ error: "missing_signature" });

    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 5 * 60) {
      return reply.code(401).send({ error: "stale_timestamp" });
    }

    const expected = createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
    let sigOk = false;
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(sig.replace(/^sha256=/, ""), "hex");
      sigOk = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      sigOk = false;
    }
    if (!sigOk) {
      req.log.warn("[pluggy-webhook] signature mismatch");
      return reply.code(401).send({ error: "bad_signature" });
    }

    const body = req.body as
      | { event?: string; itemId?: string; transactionIds?: string[] }
      | undefined;
    const event = body?.event ?? "";
    const itemId = body?.itemId;

    const db = getDb();
    if (!db) return reply.code(200).send({ ok: true, persisted: false });

    if (!itemId) {
      req.log.info({ event }, "[pluggy-webhook] no itemId — acking without action");
      return reply.code(200).send({ ok: true });
    }

    const [conn] = await db
      .select()
      .from(financialConnections)
      .where(
        and(
          eq(financialConnections.providerConnectionId, itemId),
          eq(financialConnections.provider, "pluggy"),
        ),
      )
      .limit(1);
    if (!conn) {
      req.log.info({ event, itemId }, "[pluggy-webhook] no local connection — acking");
      return reply.code(200).send({ ok: true, persisted: false });
    }

    try {
      switch (event) {
        case "item/created":
        case "item/updated":
        case "item/login_succeeded": {
          await db
            .update(financialConnections)
            .set({ status: "syncing", updatedAt: new Date() })
            .where(eq(financialConnections.id, conn.id));
          if (getJobs()) {
            await enqueue<PluggySyncPayload>(FINANCE_PLUGGY_SYNC, {
              workspaceId: conn.workspaceId,
              connectionId: conn.id,
            });
          }
          break;
        }
        case "item/error": {
          await db
            .update(financialConnections)
            .set({ status: "error", updatedAt: new Date() })
            .where(eq(financialConnections.id, conn.id));
          break;
        }
        case "item/waiting_user_input": {
          await db
            .update(financialConnections)
            .set({ status: "awaiting_input", updatedAt: new Date() })
            .where(eq(financialConnections.id, conn.id));
          break;
        }
        case "item/deleted": {
          await db.delete(financialConnections).where(eq(financialConnections.id, conn.id));
          break;
        }
        case "transactions/deleted": {
          if (Array.isArray(body?.transactionIds) && body.transactionIds.length > 0) {
            for (const txId of body.transactionIds) {
              await db
                .delete(financialTransactionsUnified)
                .where(
                  and(
                    eq(financialTransactionsUnified.workspaceId, conn.workspaceId),
                    eq(financialTransactionsUnified.providerTransactionId, txId),
                  ),
                );
            }
          }
          break;
        }
        case "transactions/updated": {
          // Cheaper to re-sync the full window than to fetch each tx by id;
          // the upsert is idempotent so duplicates are impossible.
          if (getJobs()) {
            await enqueue<PluggySyncPayload>(FINANCE_PLUGGY_SYNC, {
              workspaceId: conn.workspaceId,
              connectionId: conn.id,
            });
          }
          break;
        }
        default:
          req.log.info({ event }, "[pluggy-webhook] unhandled event — acking");
      }
    } catch (err) {
      req.log.error({ err, event, itemId }, "[pluggy-webhook] handler failed");
      return reply.code(200).send({ ok: true, persisted: false });
    }

    return reply.code(200).send({ ok: true });
  });
}
