import { boolean, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// Per-user opt-in flags for transactional notifications. Keyed by user_id (not
// workspace) because preferences are user-level — a user belongs to multiple
// workspaces but only has one inbox. Read pattern: create-on-read with
// all-true defaults; the row is upserted on the first send attempt for a
// given user. Wave 4b adds the rest of the legacy flags (daily summary,
// broadcasts, weekly report, credit alerts, security alerts, inactivity).
export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  emailTaskReminders: boolean("email_task_reminders").notNull().default(true),
  emailEventReminders: boolean("email_event_reminders").notNull().default(true),
  emailArchiveNotice: boolean("email_archive_notice").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
