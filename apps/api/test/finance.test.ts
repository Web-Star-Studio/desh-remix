import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  financeBudgets,
  financeGoals,
  financeRecurring,
  financeTransactions,
  users,
  workspaceMembers,
  workspaces,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("finance routes", () => {
  let app: FastifyInstance;
  let userId: string;
  let workspaceId: string;
  let token: string;

  beforeAll(async () => {
    app = await buildServer();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetData();
    const db = getTestDb();
    const subjectId = crypto.randomUUID();
    const [user] = await db
      .insert(users)
      .values({ cognitoSub: subjectId, email: `f-${Date.now()}@desh.test` })
      .returning();
    userId = user!.id;
    const [ws] = await db
      .insert(workspaces)
      .values({ name: "Finance WS", createdBy: userId })
      .returning();
    workspaceId = ws!.id;
    await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
    token = await signTestToken({ sub: subjectId, email: `f-${Date.now()}@desh.test` });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/finance/transactions`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects non-members with 404", async () => {
    const db = getTestDb();
    const otherSub = crypto.randomUUID();
    const [other] = await db
      .insert(users)
      .values({ cognitoSub: otherSub, email: `o-${Date.now()}@desh.test` })
      .returning();
    const [otherWs] = await db
      .insert(workspaces)
      .values({ name: "Other", createdBy: other!.id })
      .returning();
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${otherWs!.id}/finance/transactions`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("CRUDs a goal end-to-end", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/finance/goals`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { name: "Travel fund", target: 5000, current: 1200 },
    });
    expect(create.statusCode).toBe(201);
    const goal = (create.json() as { goal: { id: string; target: number; current: number } }).goal;
    expect(goal.target).toBe(5000);
    expect(goal.current).toBe(1200);

    // patch — increment current
    const patch = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/finance/goals/${goal.id}`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { current: 2000 },
    });
    expect((patch.json() as { goal: { current: number } }).goal.current).toBe(2000);

    // list
    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/finance/goals`,
      headers: authHeader(token),
    });
    expect((list.json() as { goals: unknown[] }).goals).toHaveLength(1);

    // delete
    const del = await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/finance/goals/${goal.id}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(204);
  });

  it("creates and filters transactions by date range + type + category", async () => {
    const create = (description: string, amount: number, type: string, category: string, date: string) =>
      app.inject({
        method: "POST",
        url: `/workspaces/${workspaceId}/finance/transactions`,
        headers: { ...authHeader(token), "content-type": "application/json" },
        payload: { description, amount, type, category, date },
      });

    expect((await create("salary", 5000, "income", "salary", "2026-04-05")).statusCode).toBe(201);
    expect((await create("rent", 1500, "expense", "housing", "2026-04-10")).statusCode).toBe(201);
    expect((await create("groceries", 350, "expense", "food", "2026-04-12")).statusCode).toBe(201);
    expect((await create("interest", 25, "income", "savings", "2026-03-30")).statusCode).toBe(201);

    // April 2026 expenses
    const filtered = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/finance/transactions?startDate=2026-04-01&endDate=2026-04-30&type=expense`,
      headers: authHeader(token),
    });
    const txs = (filtered.json() as { transactions: { type: string; category: string }[] }).transactions;
    expect(txs).toHaveLength(2);
    expect(txs.every((t) => t.type === "expense")).toBe(true);

    // category filter
    const byCat = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/finance/transactions?category=food`,
      headers: authHeader(token),
    });
    expect((byCat.json() as { transactions: unknown[] }).transactions).toHaveLength(1);
  });

  it("rejects transactions with type outside the allowed set", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/finance/transactions`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { description: "x", amount: 1, type: "transfer", category: "x", date: "2026-04-01" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("budget create is unique per (workspace, category) — duplicate returns 409", async () => {
    const first = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/finance/budgets`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { category: "food", monthlyLimit: 800 },
    });
    expect(first.statusCode).toBe(201);

    const dup = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/finance/budgets`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { category: "food", monthlyLimit: 1000 },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: string }).error).toBe("budget_for_category_exists");
  });

  it("recurring rule day_of_month is range-checked at the route layer", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/finance/recurring`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: {
        description: "rent",
        amount: 1500,
        type: "expense",
        category: "housing",
        dayOfMonth: 99,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("yearly summary aggregates income + expense per month from existing transactions", async () => {
    const db = getTestDb();
    await db.insert(financeTransactions).values([
      {
        workspaceId,
        userId,
        description: "jan salary",
        amount: "5000",
        type: "income",
        category: "salary",
        date: "2026-01-15",
      },
      {
        workspaceId,
        userId,
        description: "jan rent",
        amount: "1500",
        type: "expense",
        category: "housing",
        date: "2026-01-05",
      },
      {
        workspaceId,
        userId,
        description: "feb salary",
        amount: "5500",
        type: "income",
        category: "salary",
        date: "2026-02-15",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/finance/summary?year=2026`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { summary: { month: number; income: number; expense: number; balance: number }[] };
    expect(body.summary).toHaveLength(12);
    expect(body.summary[0]).toEqual({ month: 1, income: 5000, expense: 1500, balance: 3500 });
    expect(body.summary[1]).toEqual({ month: 2, income: 5500, expense: 0, balance: 5500 });
    // March onward all zero — no rows in those months.
    expect(body.summary.slice(2).every((m) => m.income === 0 && m.expense === 0)).toBe(true);
  });

  it("workspace cascade — deleting the workspace removes finance rows", async () => {
    const db = getTestDb();
    await db
      .insert(financeGoals)
      .values({ workspaceId, userId, name: "g", target: "100", current: "0", color: "" });
    await db.insert(financeRecurring).values({
      workspaceId,
      userId,
      description: "x",
      amount: "1",
      type: "expense",
      category: "x",
      dayOfMonth: 5,
    });
    await db.insert(financeBudgets).values({
      workspaceId,
      userId,
      category: "x",
      monthlyLimit: "100",
    });
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    const goalCount = await db.select().from(financeGoals).where(eq(financeGoals.workspaceId, workspaceId));
    const recCount = await db.select().from(financeRecurring).where(eq(financeRecurring.workspaceId, workspaceId));
    const budCount = await db.select().from(financeBudgets).where(eq(financeBudgets.workspaceId, workspaceId));
    expect(goalCount).toHaveLength(0);
    expect(recCount).toHaveLength(0);
    expect(budCount).toHaveLength(0);
  });
});
