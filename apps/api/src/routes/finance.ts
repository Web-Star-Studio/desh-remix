import type { FastifyInstance, FastifyReply } from "fastify";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";
import {
  createBudget,
  createGoal,
  createRecurring,
  createTransaction,
  deleteBudget,
  deleteGoal,
  deleteRecurring,
  deleteTransaction,
  listBudgets,
  listGoals,
  listRecurring,
  listTransactions,
  updateBudget,
  updateGoal,
  updateRecurring,
  updateTransaction,
  yearlySummary,
} from "../services/finance.js";

const WorkspaceParams = z.object({ id: z.string().uuid() });
const ChildParams = z.object({ id: z.string().uuid(), childId: z.string().uuid() });

const TxType = z.enum(["income", "expense"]);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

function sendServiceError(reply: FastifyReply, err: unknown) {
  if (isServiceError(err)) return reply.code(err.httpStatus).send({ error: err.errorCode });
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

export default async function financeRoutes(app: FastifyInstance) {
  // ── Goals ───────────────────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/goals", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    try {
      return { goals: await listGoals(params.data.id) };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/workspaces/:id/finance/goals", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    const Body = z
      .object({
        name: z.string().min(1).max(200),
        target: z.number().nonnegative(),
        current: z.number().nonnegative().optional(),
        color: z.string().max(64).optional(),
      })
      .safeParse(req.body);
    if (!Body.success) return reply.code(400).send({ error: "invalid_body", details: Body.error.flatten() });
    try {
      const goal = await createGoal(params.data.id, dbId, Body.data);
      return reply.code(201).send({ goal });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.patch("/workspaces/:id/finance/goals/:childId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ChildParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    const Body = z
      .object({
        name: z.string().min(1).max(200).optional(),
        target: z.number().nonnegative().optional(),
        current: z.number().nonnegative().optional(),
        color: z.string().max(64).optional(),
      })
      .safeParse(req.body);
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });
    try {
      const goal = await updateGoal(params.data.id, params.data.childId, Body.data);
      return { goal };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.delete("/workspaces/:id/finance/goals/:childId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ChildParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    try {
      await deleteGoal(params.data.id, params.data.childId);
      return reply.code(204).send();
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  // ── Transactions ────────────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/transactions", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    const Q = z
      .object({
        startDate: IsoDate.optional(),
        endDate: IsoDate.optional(),
        type: TxType.optional(),
        category: z.string().max(120).optional(),
        limit: z.coerce.number().int().min(1).max(2000).default(500),
      })
      .safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    try {
      const transactions = await listTransactions(params.data.id, Q.data);
      return { transactions };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/workspaces/:id/finance/transactions", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    const Body = z
      .object({
        description: z.string().min(1).max(500),
        amount: z.number(),
        type: TxType,
        category: z.string().max(120).default(""),
        date: IsoDate,
        accountName: z.string().max(120).nullish(),
      })
      .safeParse(req.body);
    if (!Body.success) return reply.code(400).send({ error: "invalid_body", details: Body.error.flatten() });
    try {
      const transaction = await createTransaction(params.data.id, dbId, Body.data);
      return reply.code(201).send({ transaction });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.patch("/workspaces/:id/finance/transactions/:childId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ChildParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    const Body = z
      .object({
        description: z.string().min(1).max(500).optional(),
        amount: z.number().optional(),
        type: TxType.optional(),
        category: z.string().max(120).optional(),
        date: IsoDate.optional(),
        accountName: z.string().max(120).nullish(),
      })
      .safeParse(req.body);
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });
    try {
      const transaction = await updateTransaction(params.data.id, params.data.childId, Body.data);
      return { transaction };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.delete("/workspaces/:id/finance/transactions/:childId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ChildParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    try {
      await deleteTransaction(params.data.id, params.data.childId);
      return reply.code(204).send();
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  // ── Recurring rules ─────────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/recurring", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    try {
      return { recurring: await listRecurring(params.data.id) };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/workspaces/:id/finance/recurring", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    const Body = z
      .object({
        description: z.string().min(1).max(500),
        amount: z.number(),
        type: TxType,
        category: z.string().max(120).default(""),
        dayOfMonth: z.number().int().min(1).max(31),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });
    try {
      const rule = await createRecurring(params.data.id, dbId, Body.data);
      return reply.code(201).send({ recurring: rule });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.patch("/workspaces/:id/finance/recurring/:childId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ChildParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    const Body = z
      .object({
        description: z.string().min(1).max(500).optional(),
        amount: z.number().optional(),
        type: TxType.optional(),
        category: z.string().max(120).optional(),
        dayOfMonth: z.number().int().min(1).max(31).optional(),
        active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });
    try {
      const rule = await updateRecurring(params.data.id, params.data.childId, Body.data);
      return { recurring: rule };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.delete("/workspaces/:id/finance/recurring/:childId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ChildParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    try {
      await deleteRecurring(params.data.id, params.data.childId);
      return reply.code(204).send();
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  // ── Budgets ─────────────────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/budgets", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    try {
      return { budgets: await listBudgets(params.data.id) };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/workspaces/:id/finance/budgets", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    const Body = z
      .object({
        category: z.string().min(1).max(120),
        monthlyLimit: z.number().nonnegative(),
      })
      .safeParse(req.body);
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });
    try {
      const budget = await createBudget(params.data.id, dbId, Body.data);
      return reply.code(201).send({ budget });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.patch("/workspaces/:id/finance/budgets/:childId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ChildParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    const Body = z
      .object({
        category: z.string().min(1).max(120).optional(),
        monthlyLimit: z.number().nonnegative().optional(),
      })
      .safeParse(req.body);
    if (!Body.success) return reply.code(400).send({ error: "invalid_body" });
    try {
      const budget = await updateBudget(params.data.id, params.data.childId, Body.data);
      return { budget };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.delete("/workspaces/:id/finance/budgets/:childId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = ChildParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    try {
      await deleteBudget(params.data.id, params.data.childId);
      return reply.code(204).send();
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  // ── Yearly summary ──────────────────────────────────────────────────────

  app.get("/workspaces/:id/finance/summary", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_id" });
    if (!(await requireMembership(params.data.id, dbId)))
      return reply.code(404).send({ error: "not_found" });
    const Q = z
      .object({
        year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
      })
      .safeParse(req.query);
    if (!Q.success) return reply.code(400).send({ error: "invalid_query" });
    try {
      const summary = await yearlySummary(params.data.id, Q.data.year);
      return { year: Q.data.year, summary };
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });
}
