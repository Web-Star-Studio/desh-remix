import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";
import { automationRules } from "./automation-rules";

// Append-only audit trail for automation rule executions. Every fire — manual
// run, cron tick, event match — writes a row here. `trigger_data` captures
// the variables that fired the rule; `action_result` captures the outcome.
// 30-day retention is reasonable for ops/debugging; we can add a pg-boss
// cron later that prunes rows older than that.
export const automationLogs = pgTable(
  "automation_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => automationRules.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    triggerData: jsonb("trigger_data").notNull().default(sql`'{}'::jsonb`),
    actionResult: jsonb("action_result").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCheck: check(
      "automation_logs_status_check",
      sql`${table.status} in ('success','error')`,
    ),
    workspaceCreatedIdx: index("automation_logs_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    ruleCreatedIdx: index("automation_logs_rule_created_idx").on(
      table.ruleId,
      table.createdAt,
    ),
  }),
);
