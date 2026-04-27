import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// AI-generated insights for the /social page (recommendations, summaries,
// content ideas). Created by user-triggered actions in the SPA's AI tab.
// `context_data` is opaque text — the prompt-time context the AI saw, kept
// for audit only. The agent migration (ai-router wave) will own how these
// are produced; this table is just the persistence layer.
export const socialAiInsights = pgTable(
  "social_ai_insights",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actionType: text("action_type").notNull(),
    actionLabel: text("action_label").notNull(),
    contextData: text("context_data"),
    resultText: text("result_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceCreatedIdx: index("social_ai_insights_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  }),
);
