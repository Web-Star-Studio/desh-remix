import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// User-defined automation rules. Each rule is a (trigger, action) pair: when
// the trigger fires for the workspace, the action runs. Wave A persists the
// rule + history; the cron / event-listener / realtime detector that
// actually fires triggers ships in Wave B.
//
// `trigger_config` and `action_config` are jsonb because the shape varies
// per type — server-side validation happens in `services/automations.ts`
// when a rule runs, not at INSERT (matching the legacy permissive model).
export const automationRules = pgTable(
  "automation_rules",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    triggerType: text("trigger_type").notNull(),
    triggerConfig: jsonb("trigger_config").notNull().default(sql`'{}'::jsonb`),
    actionType: text("action_type").notNull(),
    actionConfig: jsonb("action_config").notNull().default(sql`'{}'::jsonb`),
    executionCount: integer("execution_count").notNull().default(0),
    lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    triggerTypeCheck: check(
      "automation_rules_trigger_type_check",
      sql`${table.triggerType} in (
        'email_received','email_keyword','task_created','task_completed','task_overdue',
        'event_created','contact_added','contact_low_score','finance_transaction',
        'habit_incomplete','note_created','scheduled','whatsapp_received',
        'social_post_published','social_post_failed','follower_milestone'
      )`,
    ),
    actionTypeCheck: check(
      "automation_rules_action_type_check",
      sql`${table.actionType} in (
        'create_task','send_notification','add_tag','create_note','create_event',
        'send_whatsapp','pandora_whatsapp','create_social_post','schedule_post','send_email'
      )`,
    ),
    workspaceEnabledIdx: index("automation_rules_workspace_enabled_idx").on(
      table.workspaceId,
      table.enabled,
    ),
    workspaceTriggerIdx: index("automation_rules_workspace_trigger_idx").on(
      table.workspaceId,
      table.triggerType,
    ),
  }),
);
