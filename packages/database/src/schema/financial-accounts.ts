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

// A single bank/credit/investment/loan account inside a Pluggy item.
// `workspace_id` is denormalised from connection → workspace so list
// queries don't need a JOIN — costs an extra column, saves an index seek
// on every transaction-list page render.
export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => financialConnections.id, { onDelete: "cascade" }),
    providerAccountId: text("provider_account_id").notNull(),
    name: text("name"),
    type: text("type").notNull().default("checking"),
    currency: text("currency").notNull().default("BRL"),
    currentBalance: numeric("current_balance", { precision: 15, scale: 2 }),
    availableBalance: numeric("available_balance", { precision: 15, scale: 2 }),
    creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }),
    institutionName: text("institution_name"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    rawData: jsonb("raw_data").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeCheck: check(
      "financial_accounts_type_check",
      sql`${table.type} in ('checking','savings','credit_card','investment','loan','other')`,
    ),
    workspaceProviderUnique: unique("financial_accounts_ws_provider_unique").on(
      table.workspaceId,
      table.providerAccountId,
    ),
    workspaceIdx: index("financial_accounts_workspace_idx").on(table.workspaceId),
    connectionIdx: index("financial_accounts_connection_idx").on(table.connectionId),
  }),
);
