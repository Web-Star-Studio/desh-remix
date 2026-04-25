import { check, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

export const composioConnections = pgTable(
  "composio_connections",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id),
    toolkit: text("toolkit").notNull(),
    scope: text("scope").notNull(),
    composioEntityId: text("composio_entity_id").notNull(),
    status: text("status").notNull().default("active"),
    meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    scopeCheck: check("composio_connections_scope_check", sql`${table.scope} in ('workspace','member')`),
    triple: unique("composio_connections_workspace_user_toolkit_unique").on(
      table.workspaceId,
      table.userId,
      table.toolkit,
    ),
  }),
);
