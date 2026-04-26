import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { composioConnections } from "./composio-connections";

// Gmail label catalog cache, scoped by (workspace, connection). Refreshed on
// demand by the labels service (calls Composio GMAIL_FETCH_LABELS) and on
// label create/delete actions. The `messagesUnread` column is hydrated by
// Gmail itself when the label list is fetched; we just store the snapshot.
export const gmailLabels = pgTable(
  "gmail_labels",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => composioConnections.id, { onDelete: "cascade" }),
    gmailLabelId: text("gmail_label_id").notNull(),
    name: text("name").notNull(),
    labelType: text("label_type").notNull().default("user"),
    colorBg: text("color_bg"),
    colorText: text("color_text"),
    messagesTotal: integer("messages_total").notNull().default(0),
    messagesUnread: integer("messages_unread").notNull().default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    labelTypeCheck: check(
      "gmail_labels_type_check",
      sql`${table.labelType} in ('user','system')`,
    ),
    triple: unique("gmail_labels_workspace_connection_label_unique").on(
      table.workspaceId,
      table.connectionId,
      table.gmailLabelId,
    ),
    workspaceIdx: index("gmail_labels_workspace_id_idx").on(table.workspaceId),
  }),
);
