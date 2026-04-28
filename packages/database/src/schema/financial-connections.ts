import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// One row per Pluggy "item" (a single bank/credential connection). The
// upstream Pluggy itemId is stored as `provider_connection_id`. We don't
// store Pluggy access tokens here — they're fetched per-request from
// Pluggy via PLUGGY_CLIENT_ID/SECRET (org-wide) and cached briefly in
// services/pluggy.ts.
//
// `status` mirrors Pluggy's item lifecycle so the SPA can show
// reconnection prompts when a credential lapses. The check constraint
// keeps the set tight — Pluggy adds new states occasionally and we want
// the build to break loudly when that happens, not silently swallow.
export const financialConnections = pgTable(
  "financial_connections",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    provider: text("provider").notNull().default("pluggy"),
    providerConnectionId: text("provider_connection_id").notNull(),
    institutionName: text("institution_name"),
    institutionLogoUrl: text("institution_logo_url"),
    status: text("status").notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    rawMetadata: jsonb("raw_metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerCheck: check(
      "financial_connections_provider_check",
      sql`${table.provider} in ('pluggy','belvo')`,
    ),
    statusCheck: check(
      "financial_connections_status_check",
      sql`${table.status} in ('active','syncing','error','expired','awaiting_input','credentials_error')`,
    ),
    workspaceProviderUnique: unique("financial_connections_ws_provider_conn_unique").on(
      table.workspaceId,
      table.provider,
      table.providerConnectionId,
    ),
    workspaceIdx: index("financial_connections_workspace_idx").on(table.workspaceId),
  }),
);
