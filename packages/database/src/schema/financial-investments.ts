import {
  check,
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
import { users } from "./users";
import { financialConnections } from "./financial-connections";

// Investment positions (snapshot — not trade history). Trade history was
// in `financial_investment_transactions` in legacy; we defer that to a
// later wave since the dashboard only needs current positions for the
// portfolio cards. `current_value` is the sync-time value; `cost_basis`
// is what the user paid.
export const financialInvestments = pgTable(
  "financial_investments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => financialConnections.id, { onDelete: "cascade" }),
    providerInvestmentId: text("provider_investment_id").notNull(),
    name: text("name"),
    type: text("type").notNull().default("other"),
    ticker: text("ticker"),
    quantity: numeric("quantity", { precision: 20, scale: 6 }),
    currentValue: numeric("current_value", { precision: 15, scale: 2 }),
    costBasis: numeric("cost_basis", { precision: 15, scale: 2 }),
    currency: text("currency").notNull().default("BRL"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    rawData: jsonb("raw_data").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeCheck: check(
      "financial_investments_type_check",
      sql`${table.type} in ('stock','fund','fixed_income','crypto','other')`,
    ),
    workspaceProviderUnique: unique("financial_investments_ws_provider_unique").on(
      table.workspaceId,
      table.providerInvestmentId,
    ),
    workspaceIdx: index("financial_investments_workspace_idx").on(table.workspaceId),
  }),
);
