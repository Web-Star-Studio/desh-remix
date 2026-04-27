import {
  boolean,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// Surfaced alerts for the /social page (low ROAS, engagement drop, budget
// exhaustion, etc.). Auto-created by the SPA when metrics cross thresholds;
// users acknowledge them to clear from the banner. We keep severity tight to
// the legacy values so the SPA's badge styling doesn't need an adapter.
export const socialAlerts = pgTable(
  "social_alerts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    alertType: text("alert_type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    severity: text("severity").notNull().default("info"),
    platform: text("platform"),
    metricValue: numeric("metric_value"),
    thresholdValue: numeric("threshold_value"),
    acknowledged: boolean("acknowledged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    severityCheck: check(
      "social_alerts_severity_check",
      sql`${table.severity} in ('info','warning','critical')`,
    ),
    workspaceAcknowledgedIdx: index("social_alerts_workspace_ack_idx").on(
      table.workspaceId,
      table.acknowledged,
      table.createdAt,
    ),
  }),
);
