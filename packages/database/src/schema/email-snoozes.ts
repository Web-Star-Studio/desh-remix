import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// Snoozed email tracker. The actual "remove from inbox + add SNOOZED label"
// action is fired through Composio at snooze time; this row is the restore
// recipe (originalLabels) plus the deadline. The snooze-restore-tick pg-boss
// job scans rows where snoozeUntil <= now() and restored=false, calls
// Composio modifyLabels to put the labels back, then flips restored=true.
export const emailSnoozes = pgTable(
  "email_snoozes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    gmailId: text("gmail_id").notNull(),
    subject: text("subject").notNull().default(""),
    fromName: text("from_name").notNull().default(""),
    snoozeUntil: timestamp("snooze_until", { withTimezone: true }).notNull(),
    originalLabels: text("original_labels")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    restored: boolean("restored").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceGmailUnique: unique("email_snoozes_workspace_gmail_unique").on(
      table.workspaceId,
      table.gmailId,
    ),
    dueIdx: index("email_snoozes_due_idx").on(table.restored, table.snoozeUntil),
  }),
);
