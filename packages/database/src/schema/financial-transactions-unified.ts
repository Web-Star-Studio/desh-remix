import {
  check,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { financialAccounts } from "./financial-accounts";

// Pluggy-synced transactions. Distinct from `finance_transactions` (the
// manual-entry table from Wave A) — this one stores raw Pluggy rows,
// idempotent per (workspace, provider_transaction_id). The SPA's
// useDbFinances merges both lists for display, deduping when a manual
// entry shares the same external_id with a unified row.
//
// `type` here uses Pluggy's vocabulary (inflow/outflow) rather than the
// manual table's (income/expense). The hook adapter layer maps inflow→
// income and outflow→expense.
export const financialTransactionsUnified = pgTable(
  "financial_transactions_unified",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    providerTransactionId: text("provider_transaction_id").notNull(),
    date: date("date").notNull(),
    description: text("description"),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    type: text("type").notNull(),
    category: text("category"),
    subcategory: text("subcategory"),
    merchantName: text("merchant_name"),
    currency: text("currency").notNull().default("BRL"),
    status: text("status").notNull().default("posted"),
    rawData: jsonb("raw_data").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeCheck: check(
      "financial_transactions_unified_type_check",
      sql`${table.type} in ('inflow','outflow')`,
    ),
    statusCheck: check(
      "financial_transactions_unified_status_check",
      sql`${table.status} in ('pending','posted')`,
    ),
    workspaceProviderUnique: unique("financial_transactions_unified_ws_provider_unique").on(
      table.workspaceId,
      table.providerTransactionId,
    ),
    workspaceDateIdx: index("financial_transactions_unified_ws_date_idx").on(
      table.workspaceId,
      table.date,
    ),
    accountIdx: index("financial_transactions_unified_account_idx").on(table.accountId),
  }),
);
