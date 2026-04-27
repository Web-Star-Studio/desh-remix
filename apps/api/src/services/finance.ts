import { and, between, desc, eq, sql } from "drizzle-orm";
import {
  financeBudgets,
  financeGoals,
  financeRecurring,
  financeTransactions,
} from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";

// ── Output shapes ──────────────────────────────────────────────────────────
//
// The SPA's existing `useDbFinances` hook + `types/finance.ts` use snake_case
// (target/current/day_of_month/monthly_limit/external_id/account_name).
// We adapt at the service boundary — Drizzle internally uses camelCase, but
// every list/read returns the legacy shape so component code is unchanged.
//
// `numeric(15,2)` columns come back from postgres-js as strings to preserve
// precision. We convert to JS numbers at the boundary because the legacy SPA
// already operates on numbers; rounding errors in the cents place are
// acceptable for charts/aggregations and the source of truth stays in PG.

export interface ApiFinanceGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  color: string;
  workspace_id: string;
}

export interface ApiFinanceTransaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  source: string;
  external_id: string | null;
  account_name: string | null;
  workspace_id: string;
}

export interface ApiFinanceRecurring {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  day_of_month: number;
  active: boolean;
  workspace_id: string;
}

export interface ApiFinanceBudget {
  id: string;
  category: string;
  monthly_limit: number;
  workspace_id: string;
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toGoal(row: typeof financeGoals.$inferSelect): ApiFinanceGoal {
  return {
    id: row.id,
    name: row.name,
    target: toNumber(row.target),
    current: toNumber(row.current),
    color: row.color,
    workspace_id: row.workspaceId,
  };
}

function toTx(row: typeof financeTransactions.$inferSelect): ApiFinanceTransaction {
  return {
    id: row.id,
    description: row.description,
    amount: toNumber(row.amount),
    type: row.type as "income" | "expense",
    category: row.category,
    date: row.date,
    source: row.source,
    external_id: row.externalId,
    account_name: row.accountName,
    workspace_id: row.workspaceId,
  };
}

function toRecurring(row: typeof financeRecurring.$inferSelect): ApiFinanceRecurring {
  return {
    id: row.id,
    description: row.description,
    amount: toNumber(row.amount),
    type: row.type as "income" | "expense",
    category: row.category,
    day_of_month: row.dayOfMonth,
    active: row.active,
    workspace_id: row.workspaceId,
  };
}

function toBudget(row: typeof financeBudgets.$inferSelect): ApiFinanceBudget {
  return {
    id: row.id,
    category: row.category,
    monthly_limit: toNumber(row.monthlyLimit),
    workspace_id: row.workspaceId,
  };
}

function db() {
  const conn = getDb();
  if (!conn) throw new ServiceError(500, "db_unavailable");
  return conn;
}

// ── Goals ──────────────────────────────────────────────────────────────────

export async function listGoals(workspaceId: string): Promise<ApiFinanceGoal[]> {
  const rows = await db()
    .select()
    .from(financeGoals)
    .where(eq(financeGoals.workspaceId, workspaceId))
    .orderBy(desc(financeGoals.createdAt));
  return rows.map(toGoal);
}

export interface CreateGoalInput {
  name: string;
  target: number;
  current?: number;
  color?: string;
}

export async function createGoal(
  workspaceId: string,
  userId: string,
  input: CreateGoalInput,
): Promise<ApiFinanceGoal> {
  const [row] = await db()
    .insert(financeGoals)
    .values({
      workspaceId,
      userId,
      name: input.name,
      target: input.target.toString(),
      current: (input.current ?? 0).toString(),
      ...(input.color ? { color: input.color } : {}),
    })
    .returning();
  if (!row) throw new ServiceError(500, "insert_failed");
  return toGoal(row);
}

export interface UpdateGoalPatch {
  name?: string;
  target?: number;
  current?: number;
  color?: string;
}

export async function updateGoal(
  workspaceId: string,
  goalId: string,
  patch: UpdateGoalPatch,
): Promise<ApiFinanceGoal> {
  const set: Partial<typeof financeGoals.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.target !== undefined) set.target = patch.target.toString();
  if (patch.current !== undefined) set.current = patch.current.toString();
  if (patch.color !== undefined) set.color = patch.color;
  const [row] = await db()
    .update(financeGoals)
    .set(set)
    .where(and(eq(financeGoals.id, goalId), eq(financeGoals.workspaceId, workspaceId)))
    .returning();
  if (!row) throw new ServiceError(404, "goal_not_found");
  return toGoal(row);
}

export async function deleteGoal(workspaceId: string, goalId: string): Promise<void> {
  const result = await db()
    .delete(financeGoals)
    .where(and(eq(financeGoals.id, goalId), eq(financeGoals.workspaceId, workspaceId)))
    .returning({ id: financeGoals.id });
  if (result.length === 0) throw new ServiceError(404, "goal_not_found");
}

// ── Transactions ───────────────────────────────────────────────────────────

export interface ListTransactionsOpts {
  /** Inclusive lower bound, ISO date string YYYY-MM-DD. */
  startDate?: string;
  /** Inclusive upper bound, ISO date string YYYY-MM-DD. */
  endDate?: string;
  /** Filter by type. */
  type?: "income" | "expense";
  /** Filter by category (exact match). */
  category?: string;
  limit?: number;
}

export async function listTransactions(
  workspaceId: string,
  opts: ListTransactionsOpts = {},
): Promise<ApiFinanceTransaction[]> {
  const conds = [eq(financeTransactions.workspaceId, workspaceId)];
  if (opts.startDate && opts.endDate) {
    conds.push(between(financeTransactions.date, opts.startDate, opts.endDate));
  } else if (opts.startDate) {
    conds.push(sql`${financeTransactions.date} >= ${opts.startDate}`);
  } else if (opts.endDate) {
    conds.push(sql`${financeTransactions.date} <= ${opts.endDate}`);
  }
  if (opts.type) conds.push(eq(financeTransactions.type, opts.type));
  if (opts.category) conds.push(eq(financeTransactions.category, opts.category));
  const rows = await db()
    .select()
    .from(financeTransactions)
    .where(and(...conds))
    .orderBy(desc(financeTransactions.date), desc(financeTransactions.createdAt))
    .limit(opts.limit ?? 500);
  return rows.map(toTx);
}

export interface CreateTransactionInput {
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  source?: string;
  externalId?: string | null;
  accountName?: string | null;
}

export async function createTransaction(
  workspaceId: string,
  userId: string,
  input: CreateTransactionInput,
): Promise<ApiFinanceTransaction> {
  const [row] = await db()
    .insert(financeTransactions)
    .values({
      workspaceId,
      userId,
      description: input.description,
      amount: input.amount.toString(),
      type: input.type,
      category: input.category,
      date: input.date,
      source: input.source ?? "manual",
      externalId: input.externalId ?? null,
      accountName: input.accountName ?? null,
    })
    .returning();
  if (!row) throw new ServiceError(500, "insert_failed");
  return toTx(row);
}

export interface UpdateTransactionPatch {
  description?: string;
  amount?: number;
  type?: "income" | "expense";
  category?: string;
  date?: string;
  accountName?: string | null;
}

export async function updateTransaction(
  workspaceId: string,
  txId: string,
  patch: UpdateTransactionPatch,
): Promise<ApiFinanceTransaction> {
  const set: Partial<typeof financeTransactions.$inferInsert> = {};
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.amount !== undefined) set.amount = patch.amount.toString();
  if (patch.type !== undefined) set.type = patch.type;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.date !== undefined) set.date = patch.date;
  if (patch.accountName !== undefined) set.accountName = patch.accountName;
  const [row] = await db()
    .update(financeTransactions)
    .set(set)
    .where(
      and(eq(financeTransactions.id, txId), eq(financeTransactions.workspaceId, workspaceId)),
    )
    .returning();
  if (!row) throw new ServiceError(404, "transaction_not_found");
  return toTx(row);
}

export async function deleteTransaction(workspaceId: string, txId: string): Promise<void> {
  const result = await db()
    .delete(financeTransactions)
    .where(
      and(eq(financeTransactions.id, txId), eq(financeTransactions.workspaceId, workspaceId)),
    )
    .returning({ id: financeTransactions.id });
  if (result.length === 0) throw new ServiceError(404, "transaction_not_found");
}

// ── Recurring rules ────────────────────────────────────────────────────────

export async function listRecurring(workspaceId: string): Promise<ApiFinanceRecurring[]> {
  const rows = await db()
    .select()
    .from(financeRecurring)
    .where(eq(financeRecurring.workspaceId, workspaceId))
    .orderBy(desc(financeRecurring.createdAt));
  return rows.map(toRecurring);
}

export interface CreateRecurringInput {
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  dayOfMonth: number;
  active?: boolean;
}

export async function createRecurring(
  workspaceId: string,
  userId: string,
  input: CreateRecurringInput,
): Promise<ApiFinanceRecurring> {
  if (input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    throw new ServiceError(400, "invalid_day_of_month");
  }
  const [row] = await db()
    .insert(financeRecurring)
    .values({
      workspaceId,
      userId,
      description: input.description,
      amount: input.amount.toString(),
      type: input.type,
      category: input.category,
      dayOfMonth: input.dayOfMonth,
      active: input.active ?? true,
    })
    .returning();
  if (!row) throw new ServiceError(500, "insert_failed");
  return toRecurring(row);
}

export interface UpdateRecurringPatch {
  description?: string;
  amount?: number;
  type?: "income" | "expense";
  category?: string;
  dayOfMonth?: number;
  active?: boolean;
}

export async function updateRecurring(
  workspaceId: string,
  recurringId: string,
  patch: UpdateRecurringPatch,
): Promise<ApiFinanceRecurring> {
  if (patch.dayOfMonth !== undefined && (patch.dayOfMonth < 1 || patch.dayOfMonth > 31)) {
    throw new ServiceError(400, "invalid_day_of_month");
  }
  const set: Partial<typeof financeRecurring.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.amount !== undefined) set.amount = patch.amount.toString();
  if (patch.type !== undefined) set.type = patch.type;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.dayOfMonth !== undefined) set.dayOfMonth = patch.dayOfMonth;
  if (patch.active !== undefined) set.active = patch.active;
  const [row] = await db()
    .update(financeRecurring)
    .set(set)
    .where(
      and(eq(financeRecurring.id, recurringId), eq(financeRecurring.workspaceId, workspaceId)),
    )
    .returning();
  if (!row) throw new ServiceError(404, "recurring_not_found");
  return toRecurring(row);
}

export async function deleteRecurring(workspaceId: string, recurringId: string): Promise<void> {
  const result = await db()
    .delete(financeRecurring)
    .where(
      and(eq(financeRecurring.id, recurringId), eq(financeRecurring.workspaceId, workspaceId)),
    )
    .returning({ id: financeRecurring.id });
  if (result.length === 0) throw new ServiceError(404, "recurring_not_found");
}

// ── Budgets ────────────────────────────────────────────────────────────────

export async function listBudgets(workspaceId: string): Promise<ApiFinanceBudget[]> {
  const rows = await db()
    .select()
    .from(financeBudgets)
    .where(eq(financeBudgets.workspaceId, workspaceId))
    .orderBy(financeBudgets.category);
  return rows.map(toBudget);
}

export interface CreateBudgetInput {
  category: string;
  monthlyLimit: number;
}

export async function createBudget(
  workspaceId: string,
  userId: string,
  input: CreateBudgetInput,
): Promise<ApiFinanceBudget> {
  // Idempotent on (workspace, category) — repeat creates collide on the
  // unique constraint, which we surface as a 409 so the SPA can refetch.
  try {
    const [row] = await db()
      .insert(financeBudgets)
      .values({
        workspaceId,
        userId,
        category: input.category,
        monthlyLimit: input.monthlyLimit.toString(),
      })
      .returning();
    if (!row) throw new ServiceError(500, "insert_failed");
    return toBudget(row);
  } catch (err) {
    if (err instanceof Error && err.message.includes("finance_budgets_workspace_category_unique")) {
      throw new ServiceError(409, "budget_for_category_exists");
    }
    throw err;
  }
}

export async function updateBudget(
  workspaceId: string,
  budgetId: string,
  patch: { category?: string; monthlyLimit?: number },
): Promise<ApiFinanceBudget> {
  const set: Partial<typeof financeBudgets.$inferInsert> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.monthlyLimit !== undefined) set.monthlyLimit = patch.monthlyLimit.toString();
  const [row] = await db()
    .update(financeBudgets)
    .set(set)
    .where(and(eq(financeBudgets.id, budgetId), eq(financeBudgets.workspaceId, workspaceId)))
    .returning();
  if (!row) throw new ServiceError(404, "budget_not_found");
  return toBudget(row);
}

export async function deleteBudget(workspaceId: string, budgetId: string): Promise<void> {
  const result = await db()
    .delete(financeBudgets)
    .where(and(eq(financeBudgets.id, budgetId), eq(financeBudgets.workspaceId, workspaceId)))
    .returning({ id: financeBudgets.id });
  if (result.length === 0) throw new ServiceError(404, "budget_not_found");
}

// ── Summary ────────────────────────────────────────────────────────────────
//
// Returns a 12-month income/expense/balance breakdown for the requested
// year. Calculated from finance_transactions only — recurring rules are
// NOT materialised here in Wave A; the SPA already separates "actual" from
// "expected" panels and we keep that split honest.

export interface MonthlySummary {
  month: number; // 1-12
  income: number;
  expense: number;
  balance: number;
}

export async function yearlySummary(
  workspaceId: string,
  year: number,
): Promise<MonthlySummary[]> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const rows = (await db()
    .select({
      month: sql<number>`extract(month from ${financeTransactions.date})::int`,
      type: financeTransactions.type,
      total: sql<string>`sum(${financeTransactions.amount})`,
    })
    .from(financeTransactions)
    .where(
      and(
        eq(financeTransactions.workspaceId, workspaceId),
        between(financeTransactions.date, start, end),
      ),
    )
    .groupBy(sql`extract(month from ${financeTransactions.date})`, financeTransactions.type)) as Array<{
    month: number;
    type: string;
    total: string;
  }>;

  const byMonth = new Map<number, { income: number; expense: number }>();
  for (let m = 1; m <= 12; m++) byMonth.set(m, { income: 0, expense: 0 });
  for (const r of rows) {
    const slot = byMonth.get(r.month);
    if (!slot) continue;
    if (r.type === "income") slot.income = toNumber(r.total);
    else if (r.type === "expense") slot.expense = toNumber(r.total);
  }
  const out: MonthlySummary[] = [];
  for (let m = 1; m <= 12; m++) {
    const s = byMonth.get(m)!;
    out.push({ month: m, income: s.income, expense: s.expense, balance: s.income - s.expense });
  }
  return out;
}
