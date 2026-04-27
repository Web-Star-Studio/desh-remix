import { numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// One row per (workspace, category) — categories are free-form text in Wave A,
// matching the legacy permissive shape. The unique constraint prevents two
// budgets fighting over the same category in the same workspace.
//
// Budget overshoot policy is purely UI-side: the server stores the limit and
// the SPA computes "spent so far this month" by aggregating
// finance_transactions filtered to (workspace, category, current month). No
// hard enforcement — exceeding a budget never blocks a transaction insert.
export const financeBudgets = pgTable(
  "finance_budgets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    category: text("category").notNull(),
    monthlyLimit: numeric("monthly_limit", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceCategoryUnique: unique("finance_budgets_workspace_category_unique").on(
      table.workspaceId,
      table.category,
    ),
  }),
);
