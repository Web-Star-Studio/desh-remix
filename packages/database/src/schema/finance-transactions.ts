import {
  check,
  date,
  index,
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

// Manual + Pluggy-synced transactions all live here. `source = 'manual'` for
// SPA-entered rows; future Wave B will land 'pluggy' rows with the Pluggy
// item's external id in `external_id`. The `(workspace_id, source,
// external_id)` triple is unique so re-syncs never duplicate the same
// upstream transaction within a workspace.
export const financeTransactions = pgTable(
  "finance_transactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    type: text("type").notNull(),
    category: text("category").notNull().default(""),
    date: date("date").notNull(),
    source: text("source").notNull().default("manual"),
    externalId: text("external_id"),
    accountName: text("account_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeCheck: check(
      "finance_transactions_type_check",
      sql`${table.type} in ('income','expense')`,
    ),
    workspaceDateIdx: index("finance_transactions_workspace_date_idx").on(
      table.workspaceId,
      table.date,
    ),
    workspaceCategoryIdx: index("finance_transactions_workspace_category_idx").on(
      table.workspaceId,
      table.category,
    ),
    externalUnique: unique("finance_transactions_workspace_external_unique").on(
      table.workspaceId,
      table.source,
      table.externalId,
    ),
  }),
);
