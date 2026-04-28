import {
  date,
  index,
  integer,
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
import { users } from "./users";
import { financialConnections } from "./financial-connections";

// One row per active loan/financing contract surfaced by Pluggy. CET
// (Custo Efetivo Total) is a Brazilian regulator-defined cost-of-credit
// metric — stored as numeric so the SPA can render the percentage with
// full precision.
export const financialLoans = pgTable(
  "financial_loans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => financialConnections.id, { onDelete: "cascade" }),
    providerLoanId: text("provider_loan_id").notNull(),
    contractNumber: text("contract_number"),
    productName: text("product_name"),
    loanType: text("loan_type"),
    contractDate: date("contract_date"),
    contractAmount: numeric("contract_amount", { precision: 15, scale: 2 }),
    outstandingBalance: numeric("outstanding_balance", { precision: 15, scale: 2 }),
    currency: text("currency").notNull().default("BRL"),
    dueDate: date("due_date"),
    cet: numeric("cet", { precision: 10, scale: 6 }),
    installmentPeriodicity: text("installment_periodicity"),
    totalInstallments: integer("total_installments"),
    paidInstallments: integer("paid_installments"),
    dueInstallments: integer("due_installments"),
    status: text("status").notNull().default("active"),
    rawData: jsonb("raw_data").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceProviderUnique: unique("financial_loans_ws_provider_unique").on(
      table.workspaceId,
      table.providerLoanId,
    ),
    workspaceIdx: index("financial_loans_workspace_idx").on(table.workspaceId),
  }),
);
