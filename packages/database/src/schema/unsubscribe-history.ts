import { boolean, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// Audit trail for the smart unsubscribe batch executor. Each row records one
// attempt against one sender (success or failure), which `method` was used,
// and how many of the user's own emails from that sender were affected. The
// stats panel reads this. Workspace nullable so legacy admin flows that ran
// outside a workspace context still log cleanly.
export const unsubscribeHistory = pgTable(
  "unsubscribe_history",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    senderName: text("sender_name").notNull().default(""),
    senderEmail: text("sender_email").notNull(),
    category: text("category").notNull().default("outro"),
    safetyScore: integer("safety_score").notNull().default(50),
    method: text("method").notNull(),
    success: boolean("success").notNull().default(false),
    trashed: boolean("trashed").notNull().default(false),
    emailsAffected: integer("emails_affected").notNull().default(0),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    methodCheck: check(
      "unsubscribe_history_method_check",
      sql`${table.method} in ('GET','POST','mailto','trash_only')`,
    ),
    userCreatedIdx: index("unsubscribe_history_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    workspaceIdx: index("unsubscribe_history_workspace_idx").on(table.workspaceId),
  }),
);
