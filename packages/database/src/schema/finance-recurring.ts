import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// Recurring rule = "I expect ~$amount in/out on day_of_month, every month".
// We do NOT auto-materialize transactions from these rules in Wave A — the
// SPA renders them as virtual rows in the upcoming-month view. A future wave
// can add a pg-boss runner that materialises ‘active' rules once per period
// (with `source='recurring'` on the resulting `finance_transactions` row to
// keep the audit trail clean).
export const financeRecurring = pgTable(
  "finance_recurring",
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
    dayOfMonth: integer("day_of_month").notNull(),
    active: boolean("active").notNull().default(true),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeCheck: check(
      "finance_recurring_type_check",
      sql`${table.type} in ('income','expense')`,
    ),
    dayOfMonthCheck: check(
      "finance_recurring_day_of_month_check",
      sql`${table.dayOfMonth} between 1 and 31`,
    ),
    workspaceActiveIdx: index("finance_recurring_workspace_active_idx").on(
      table.workspaceId,
      table.active,
    ),
  }),
);
