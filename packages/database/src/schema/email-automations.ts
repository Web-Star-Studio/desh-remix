import { boolean, check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

// Cron- or threshold-triggered email automations. The runner (pg-boss daily
// tick) iterates active rows, evaluates the trigger, resolves the target
// audience, and dispatches via email-notifications. `triggerConfig` is jsonb
// with {cron?, event?, threshold?, data?} — kept loose so the admin UI can
// add new flavors without schema changes.
export const emailAutomations = pgTable(
  "email_automations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    triggerType: text("trigger_type").notNull(),
    triggerConfig: jsonb("trigger_config").notNull().default(sql`'{}'::jsonb`),
    templateSlug: text("template_slug").notNull(),
    targetAudience: text("target_audience").notNull().default("all"),
    active: boolean("active").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    triggerTypeCheck: check(
      "email_automations_trigger_check",
      sql`${table.triggerType} in ('cron','threshold','manual')`,
    ),
    audienceCheck: check(
      "email_automations_audience_check",
      sql`${table.targetAudience} in ('all','active','inactive','admins')`,
    ),
    activeIdx: index("email_automations_active_idx").on(table.active),
  }),
);
