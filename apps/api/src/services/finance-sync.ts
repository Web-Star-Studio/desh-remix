import { and, eq, sql } from "drizzle-orm";
import {
  financialAccounts,
  financialConnections,
  financialInvestments,
  financialLoans,
  financialSyncLogs,
  financialTransactionsUnified,
} from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import {
  PluggyApiError,
  getItem,
  isPluggyConfigured,
  listAccounts,
  listInvestments,
  listLoans,
  listTransactions,
  type PluggyAccount,
  type PluggyInvestment,
  type PluggyLoan,
  type PluggyTransaction,
} from "./pluggy.js";

// Pluggy sync orchestrator — single entry point shared by the manual-trigger
// route and the pg-boss `finance.pluggy-sync` job. Steps:
//
//   1. Insert a financial_sync_logs row (status=running) so an SPA "Last sync"
//      badge can show the in-flight state. A stuck `running` row tells us a
//      sync was killed mid-flight (process restart, crash) — useful for ops.
//   2. Pluggy: getItem → listAccounts → per-account listTransactions
//      (paginated) → listInvestments → listLoans.
//   3. Upsert each resource on its (workspace, provider_*) unique constraint.
//      All writes are idempotent: re-syncing the same window doesn't create
//      duplicates and refreshes the latest fields.
//   4. Update the sync_logs row with success/error + counts + durationMs.
//   5. Update financial_connections.last_synced_at + status from the Pluggy
//      item's lifecycle ("UPDATED"→active, "WAITING_USER_INPUT"→awaiting_input,
//      etc.) so the SPA knows when to prompt for reconnect.
//
// Investments and loans are best-effort: many Pluggy connectors don't expose
// them and return 404. We swallow that as "no data" rather than failing the
// whole sync — the user-facing error count would otherwise be noise.

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

// ── Default sync window ────────────────────────────────────────────────────
// Pluggy returns up to ~24 months of transactions, but on every sync we only
// pull the last 90 days. New connections get a wider initial window via
// `opts.fromDate`; the route handler decides which window to use.

const DEFAULT_TX_WINDOW_DAYS = 90;
const TX_PAGE_SIZE = 200;

export interface RunPluggySyncOptions {
  /** ISO YYYY-MM-DD. Defaults to today − 90 days. */
  fromDate?: string;
  /** ISO YYYY-MM-DD. Defaults to today. */
  toDate?: string;
  /** Surfaces who triggered the sync in the audit row. */
  triggeredByUserId?: string | null;
}

export interface SyncCounts {
  accounts: number;
  transactions: number;
  investments: number;
  loans: number;
}

export interface RunPluggySyncResult {
  syncLogId: string;
  status: "success" | "error";
  counts: SyncCounts;
  durationMs: number;
  errorMessage?: string;
}

export async function runPluggySync(
  workspaceId: string,
  connectionId: string,
  opts: RunPluggySyncOptions = {},
): Promise<RunPluggySyncResult> {
  if (!isPluggyConfigured()) throw new ServiceError(503, "pluggy_unconfigured");
  const db = dbOrThrow();

  const [conn] = await db
    .select()
    .from(financialConnections)
    .where(
      and(
        eq(financialConnections.id, connectionId),
        eq(financialConnections.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!conn) throw new ServiceError(404, "connection_not_found");
  if (conn.provider !== "pluggy") throw new ServiceError(400, "not_a_pluggy_connection");

  const startedAt = Date.now();

  const inserted = await db
    .insert(financialSyncLogs)
    .values({
      workspaceId,
      userId: opts.triggeredByUserId ?? conn.userId ?? null,
      connectionId,
      provider: "pluggy",
      status: "running",
    })
    .returning({ id: financialSyncLogs.id });
  const syncLogId = inserted[0]?.id;
  if (!syncLogId) throw new ServiceError(500, "sync_log_insert_failed");

  const counts: SyncCounts = { accounts: 0, transactions: 0, investments: 0, loans: 0 };

  try {
    await db
      .update(financialConnections)
      .set({ status: "syncing", updatedAt: new Date() })
      .where(eq(financialConnections.id, connectionId));

    const item = await getItem(conn.providerConnectionId);

    const { fromDate, toDate } = resolveWindow(opts);

    counts.accounts = await syncAccounts({
      db,
      workspaceId,
      connection: conn,
    });

    counts.transactions = await syncTransactionsForAllAccounts({
      db,
      workspaceId,
      connectionId,
      fromDate,
      toDate,
    });

    counts.investments = await syncInvestments({
      db,
      workspaceId,
      connection: conn,
    });

    counts.loans = await syncLoans({
      db,
      workspaceId,
      connection: conn,
    });

    const durationMs = Date.now() - startedAt;
    const nextStatus = mapItemStatus(item.status);

    await db
      .update(financialSyncLogs)
      .set({
        status: "success",
        accountsSynced: counts.accounts,
        transactionsSynced: counts.transactions,
        investmentsSynced: counts.investments,
        loansSynced: counts.loans,
        durationMs,
        updatedAt: new Date(),
      })
      .where(eq(financialSyncLogs.id, syncLogId));

    await db
      .update(financialConnections)
      .set({
        status: nextStatus,
        lastSyncedAt: new Date(),
        institutionName: item.connector?.name ?? conn.institutionName,
        institutionLogoUrl: item.connector?.imageUrl ?? conn.institutionLogoUrl,
        updatedAt: new Date(),
      })
      .where(eq(financialConnections.id, connectionId));

    return { syncLogId, status: "success", counts, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errorMessage = formatErrorMessage(err);
    const nextStatus = mapErrorToConnectionStatus(err);

    await db
      .update(financialSyncLogs)
      .set({
        status: "error",
        accountsSynced: counts.accounts,
        transactionsSynced: counts.transactions,
        investmentsSynced: counts.investments,
        loansSynced: counts.loans,
        errorMessage,
        durationMs,
        updatedAt: new Date(),
      })
      .where(eq(financialSyncLogs.id, syncLogId));

    await db
      .update(financialConnections)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(financialConnections.id, connectionId));

    return { syncLogId, status: "error", counts, durationMs, errorMessage };
  }
}

// ── Window resolution ─────────────────────────────────────────────────────

function resolveWindow(opts: RunPluggySyncOptions): { fromDate: string; toDate: string } {
  const today = new Date();
  const toDate = opts.toDate ?? toIsoDate(today);
  if (opts.fromDate) return { fromDate: opts.fromDate, toDate };
  const from = new Date(today);
  from.setDate(from.getDate() - DEFAULT_TX_WINDOW_DAYS);
  return { fromDate: toIsoDate(from), toDate };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Accounts ──────────────────────────────────────────────────────────────

async function syncAccounts(args: {
  db: ReturnType<typeof dbOrThrow>;
  workspaceId: string;
  connection: typeof financialConnections.$inferSelect;
}): Promise<number> {
  const { db, workspaceId, connection } = args;
  const upstream = await listAccounts(connection.providerConnectionId);
  if (upstream.length === 0) return 0;

  let written = 0;
  for (const acc of upstream) {
    const localType = mapAccountType(acc);
    const balance = pickAccountBalance(acc);
    const creditLimit = acc.creditData?.creditLimit ?? null;
    const availableBalance = acc.creditData?.availableCreditLimit ?? null;

    await db
      .insert(financialAccounts)
      .values({
        workspaceId,
        userId: connection.userId,
        connectionId: connection.id,
        providerAccountId: acc.id,
        name: acc.name ?? acc.marketingName ?? null,
        type: localType,
        currency: acc.currencyCode ?? "BRL",
        currentBalance: numericOrNull(balance),
        availableBalance: numericOrNull(availableBalance),
        creditLimit: numericOrNull(creditLimit),
        institutionName: connection.institutionName ?? null,
        lastSyncedAt: new Date(),
        rawData: acc as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [
          financialAccounts.workspaceId,
          financialAccounts.providerAccountId,
        ],
        set: {
          connectionId: connection.id,
          name: acc.name ?? acc.marketingName ?? null,
          type: localType,
          currency: acc.currencyCode ?? "BRL",
          currentBalance: numericOrNull(balance),
          availableBalance: numericOrNull(availableBalance),
          creditLimit: numericOrNull(creditLimit),
          institutionName: connection.institutionName ?? null,
          lastSyncedAt: new Date(),
          rawData: acc as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        },
      });
    written += 1;
  }
  return written;
}

function mapAccountType(acc: PluggyAccount): string {
  const t = (acc.type ?? "").toUpperCase();
  const sub = (acc.subtype ?? "").toUpperCase();
  if (t === "CREDIT") return "credit_card";
  if (t === "INVESTMENT") return "investment";
  if (t === "LOAN") return "loan";
  if (t === "BANK") {
    if (sub.includes("SAVINGS")) return "savings";
    return "checking";
  }
  return "other";
}

function pickAccountBalance(acc: PluggyAccount): number | null {
  if (typeof acc.balance === "number") return acc.balance;
  return null;
}

// ── Transactions ──────────────────────────────────────────────────────────
// Pluggy's transactions endpoint takes accountId, not itemId, so we list all
// local accounts for the connection (just upserted above) and walk pages for
// each one. Pagination uses `page` (1-based) + `pageSize` and stops when we've
// covered `totalPages`. The unique constraint on (workspace, provider_tx_id)
// makes re-runs of the same window cheap.

async function syncTransactionsForAllAccounts(args: {
  db: ReturnType<typeof dbOrThrow>;
  workspaceId: string;
  connectionId: string;
  fromDate: string;
  toDate: string;
}): Promise<number> {
  const { db, workspaceId, connectionId, fromDate, toDate } = args;

  const accounts = await db
    .select({
      id: financialAccounts.id,
      providerAccountId: financialAccounts.providerAccountId,
    })
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.workspaceId, workspaceId),
        eq(financialAccounts.connectionId, connectionId),
      ),
    );

  let total = 0;
  for (const a of accounts) {
    let page = 1;
    while (true) {
      const { items, totalPages } = await listTransactions(a.providerAccountId, {
        from: fromDate,
        to: toDate,
        page,
        pageSize: TX_PAGE_SIZE,
      });
      if (items.length === 0) break;
      total += await upsertTransactions(db, workspaceId, a.id, items);
      if (page >= totalPages) break;
      page += 1;
    }
  }
  return total;
}

async function upsertTransactions(
  db: ReturnType<typeof dbOrThrow>,
  workspaceId: string,
  accountId: string,
  items: PluggyTransaction[],
): Promise<number> {
  if (items.length === 0) return 0;

  const rows = items.map((tx) => ({
    workspaceId,
    accountId,
    providerTransactionId: tx.id,
    date: tx.date.slice(0, 10),
    description: tx.description ?? tx.descriptionRaw ?? null,
    amount: String(Math.abs(tx.amount)),
    type: mapTransactionType(tx),
    category: tx.category ?? null,
    subcategory: null,
    merchantName: tx.merchant?.name ?? null,
    currency: tx.currencyCode ?? "BRL",
    status: tx.status === "PENDING" ? "pending" : "posted",
    rawData: tx as unknown as Record<string, unknown>,
  }));

  await db
    .insert(financialTransactionsUnified)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        financialTransactionsUnified.workspaceId,
        financialTransactionsUnified.providerTransactionId,
      ],
      set: {
        accountId: sql`excluded.account_id`,
        date: sql`excluded.date`,
        description: sql`excluded.description`,
        amount: sql`excluded.amount`,
        type: sql`excluded.type`,
        category: sql`excluded.category`,
        subcategory: sql`excluded.subcategory`,
        merchantName: sql`excluded.merchant_name`,
        currency: sql`excluded.currency`,
        status: sql`excluded.status`,
        rawData: sql`excluded.raw_data`,
      },
    });

  return rows.length;
}

function mapTransactionType(tx: PluggyTransaction): "inflow" | "outflow" {
  if (tx.type === "CREDIT") return "inflow";
  if (tx.type === "DEBIT") return "outflow";
  // Pluggy occasionally omits type; fall back to amount sign.
  return tx.amount >= 0 ? "inflow" : "outflow";
}

// ── Investments ───────────────────────────────────────────────────────────

async function syncInvestments(args: {
  db: ReturnType<typeof dbOrThrow>;
  workspaceId: string;
  connection: typeof financialConnections.$inferSelect;
}): Promise<number> {
  const { db, workspaceId, connection } = args;
  let upstream: PluggyInvestment[];
  try {
    upstream = await listInvestments(connection.providerConnectionId);
  } catch (err) {
    if (err instanceof PluggyApiError && err.code === "not_found") return 0;
    throw err;
  }
  if (upstream.length === 0) return 0;

  let written = 0;
  for (const inv of upstream) {
    await db
      .insert(financialInvestments)
      .values({
        workspaceId,
        userId: connection.userId,
        connectionId: connection.id,
        providerInvestmentId: inv.id,
        name: inv.name ?? null,
        type: mapInvestmentType(inv),
        ticker: inv.ticker ?? inv.code ?? null,
        quantity: numericOrNull(inv.quantity),
        currentValue: numericOrNull(inv.balance ?? inv.amount),
        costBasis: numericOrNull(inv.amountOriginal),
        currency: inv.currencyCode ?? "BRL",
        lastSyncedAt: new Date(),
        rawData: inv as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [
          financialInvestments.workspaceId,
          financialInvestments.providerInvestmentId,
        ],
        set: {
          connectionId: connection.id,
          name: inv.name ?? null,
          type: mapInvestmentType(inv),
          ticker: inv.ticker ?? inv.code ?? null,
          quantity: numericOrNull(inv.quantity),
          currentValue: numericOrNull(inv.balance ?? inv.amount),
          costBasis: numericOrNull(inv.amountOriginal),
          currency: inv.currencyCode ?? "BRL",
          lastSyncedAt: new Date(),
          rawData: inv as unknown as Record<string, unknown>,
        },
      });
    written += 1;
  }
  return written;
}

function mapInvestmentType(inv: PluggyInvestment): string {
  const t = (inv.type ?? "").toUpperCase();
  if (t.includes("EQUITY") || t.includes("STOCK")) return "stock";
  if (t.includes("FIXED") || t.includes("TREASURY") || t.includes("BOND")) return "fixed_income";
  if (t.includes("FUND") || t.includes("MUTUAL")) return "fund";
  if (t.includes("CRYPTO")) return "crypto";
  return "other";
}

// ── Loans ─────────────────────────────────────────────────────────────────

async function syncLoans(args: {
  db: ReturnType<typeof dbOrThrow>;
  workspaceId: string;
  connection: typeof financialConnections.$inferSelect;
}): Promise<number> {
  const { db, workspaceId, connection } = args;
  let upstream: PluggyLoan[];
  try {
    upstream = await listLoans(connection.providerConnectionId);
  } catch (err) {
    if (err instanceof PluggyApiError && err.code === "not_found") return 0;
    throw err;
  }
  if (upstream.length === 0) return 0;

  let written = 0;
  for (const loan of upstream) {
    await db
      .insert(financialLoans)
      .values({
        workspaceId,
        userId: connection.userId,
        connectionId: connection.id,
        providerLoanId: loan.id,
        contractNumber: loan.contractNumber ?? null,
        productName: loan.productName ?? null,
        loanType: loan.loanType ?? null,
        contractDate: loan.contractDate?.slice(0, 10) ?? null,
        contractAmount: numericOrNull(loan.contractAmount),
        outstandingBalance: numericOrNull(loan.outstandingBalance),
        currency: loan.currencyCode ?? "BRL",
        dueDate: loan.dueDate?.slice(0, 10) ?? null,
        cet: numericOrNull(loan.cet),
        installmentPeriodicity: loan.installmentPeriodicity ?? null,
        totalInstallments: loan.totalInstallments ?? null,
        paidInstallments: loan.paidInstallments ?? null,
        dueInstallments: loan.dueInstallments ?? null,
        status: loan.status ?? "active",
        rawData: loan as unknown as Record<string, unknown>,
      })
      .onConflictDoUpdate({
        target: [financialLoans.workspaceId, financialLoans.providerLoanId],
        set: {
          connectionId: connection.id,
          contractNumber: loan.contractNumber ?? null,
          productName: loan.productName ?? null,
          loanType: loan.loanType ?? null,
          contractDate: loan.contractDate?.slice(0, 10) ?? null,
          contractAmount: numericOrNull(loan.contractAmount),
          outstandingBalance: numericOrNull(loan.outstandingBalance),
          currency: loan.currencyCode ?? "BRL",
          dueDate: loan.dueDate?.slice(0, 10) ?? null,
          cet: numericOrNull(loan.cet),
          installmentPeriodicity: loan.installmentPeriodicity ?? null,
          totalInstallments: loan.totalInstallments ?? null,
          paidInstallments: loan.paidInstallments ?? null,
          dueInstallments: loan.dueInstallments ?? null,
          status: loan.status ?? "active",
          rawData: loan as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        },
      });
    written += 1;
  }
  return written;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function numericOrNull(v: number | null | undefined): string | null {
  if (v == null || Number.isNaN(v)) return null;
  return String(v);
}

function mapItemStatus(pluggyStatus: string | undefined): string {
  switch ((pluggyStatus ?? "").toUpperCase()) {
    case "UPDATED":
    case "PARTIAL_SUCCESS":
      return "active";
    case "WAITING_USER_INPUT":
    case "USER_INPUT_REQUIRED":
      return "awaiting_input";
    case "LOGIN_ERROR":
      return "credentials_error";
    case "OUTDATED":
      return "expired";
    case "UPDATING":
      return "syncing";
    default:
      return "active";
  }
}

function mapErrorToConnectionStatus(err: unknown): string {
  if (err instanceof PluggyApiError) {
    if (err.code === "unauthorized" || err.code === "forbidden") return "credentials_error";
    if (err.code === "rate_limited" || err.code === "upstream_unavailable") return "error";
  }
  return "error";
}

function formatErrorMessage(err: unknown): string {
  if (err instanceof PluggyApiError) {
    return `${err.code}: ${err.message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
