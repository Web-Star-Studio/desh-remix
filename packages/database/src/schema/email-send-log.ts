import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// Audit trail for every notification or agent-initiated outbound email. Status
// distinguishes the three terminal outcomes: `sent` (Resend accepted),
// `failed` (provider error), `skipped` (rate-limit or preference suppression).
// Workspace nullable so system-wide notifications (e.g. account deletion
// warnings sent before workspace context is resolved) still log.
export const emailSendLog = pgTable(
  "email_send_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    emailType: text("email_type").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject").notNull().default(""),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCheck: check(
      "email_send_log_status_check",
      sql`${table.status} in ('sent','failed','skipped')`,
    ),
    workspaceCreatedIdx: index("email_send_log_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    typeIdx: index("email_send_log_type_idx").on(table.emailType),
    statusIdx: index("email_send_log_status_idx").on(table.status),
  }),
);
