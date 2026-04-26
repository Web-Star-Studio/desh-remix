import {
  boolean,
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
import { composioConnections } from "./composio-connections";

// Unified Gmail message cache. Replaces the legacy `emails_cache` (Composio-
// synced inbox view) and `gmail_messages_cache` (webhook-synced detailed cache)
// — they were 80% schema overlap in the old stack. Workspace-scoped because
// the Composio connection is workspace-scoped; the per-user dimension lived
// in legacy only because RLS keyed off auth.uid(), which we no longer use.
export const emails = pgTable(
  "emails",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => composioConnections.id, { onDelete: "cascade" }),
    gmailId: text("gmail_id").notNull(),
    threadId: text("thread_id"),
    fromName: text("from_name").notNull().default(""),
    fromEmail: text("from_email").notNull().default(""),
    subject: text("subject").notNull().default(""),
    snippet: text("snippet").notNull().default(""),
    bodyPreview: text("body_preview").notNull().default(""),
    date: timestamp("date", { withTimezone: true }).notNull(),
    isUnread: boolean("is_unread").notNull().default(true),
    isStarred: boolean("is_starred").notNull().default(false),
    hasAttachment: boolean("has_attachment").notNull().default(false),
    labelIds: text("label_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    folder: text("folder").notNull().default("inbox"),
    headers: jsonb("headers").notNull().default(sql`'{}'::jsonb`),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    composioSyncedAt: timestamp("composio_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    folderCheck: check(
      "emails_folder_check",
      sql`${table.folder} in ('inbox','sent','drafts','trash','spam','archive')`,
    ),
    workspaceGmailUnique: unique("emails_workspace_gmail_unique").on(
      table.workspaceId,
      table.gmailId,
    ),
    workspaceFolderDateIdx: index("emails_workspace_folder_date_idx").on(
      table.workspaceId,
      table.folder,
      table.date,
    ),
    connectionIdx: index("emails_connection_id_idx").on(table.connectionId),
  }),
);
