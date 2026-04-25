import { check, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";

// hermes_profile_name is a STORED generated column derived from workspace_id.
// This makes the "stable Hermes profile name across workspace renames" invariant
// enforced by the database, not by application code.
export const agentProfiles = pgTable(
  "agent_profiles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    hermesProfileName: text("hermes_profile_name")
      .notNull()
      .unique()
      .generatedAlwaysAs(sql`'ws_' || replace(workspace_id::text, '-', '')`),
    hermesPort: integer("hermes_port"),
    adapterSecret: text("adapter_secret"),
    callbackSecret: text("callback_secret"),
    status: text("status").notNull().default("stopped"),
    lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
    provider: text("provider").notNull().default("openrouter"),
    modelId: text("model_id").notNull().default("moonshotai/kimi-k2.6"),
    systemPrompt: text("system_prompt"),
    config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCheck: check(
      "agent_profiles_status_check",
      sql`${table.status} in ('stopped','starting','running','error')`,
    ),
    providerCheck: check("agent_profiles_provider_check", sql`${table.provider} = 'openrouter'`),
  }),
);
