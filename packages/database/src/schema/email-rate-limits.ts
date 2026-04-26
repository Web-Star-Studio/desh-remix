import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

// Per-(user, emailType) throttle log. The notification service inserts one
// row per send attempt; the rate-limit check queries "rows in the last 4h"
// before sending. We keep history (rather than a single per-pair latest row)
// because it's cheap and useful for ops debugging — a single index on
// (userId, emailType, sentAt DESC) makes the read path O(1).
export const emailRateLimits = pgTable(
  "email_rate_limits",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emailType: text("email_type").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    lookupIdx: index("email_rate_limits_user_type_sent_idx").on(
      table.userId,
      table.emailType,
      table.sentAt,
    ),
  }),
);
