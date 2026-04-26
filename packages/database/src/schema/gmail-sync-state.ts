import {
  bigint,
  boolean,
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

// Per-(workspace, connection, folder) Gmail sync cursor. `historyId` is the
// stop point for the next incremental sync (advanced after each successful
// processing of GMAIL_FETCH_HISTORY). `watchExpiration` tracks the Pub/Sub
// watch lifetime — Gmail caps watch at 7 days, so the watch-renewal-tick
// job re-registers any row expiring within 24h.
export const gmailSyncState = pgTable(
  "gmail_sync_state",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => composioConnections.id, { onDelete: "cascade" }),
    folder: text("folder").notNull().default("inbox"),
    // Gmail account email — populated when the watch is registered. The
    // Pub/Sub push payload only carries `{ emailAddress, historyId }`, so the
    // webhook handler reverse-resolves (emailAddress → workspace/connection)
    // through this column. Indexed for that lookup.
    emailAddress: text("email_address"),
    historyId: bigint("history_id", { mode: "bigint" }),
    watchExpiration: timestamp("watch_expiration", { withTimezone: true }),
    nextPageToken: text("next_page_token"),
    totalSynced: integer("total_synced").notNull().default(0),
    syncCompleted: boolean("sync_completed").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  },
  (table) => ({
    triple: unique("gmail_sync_state_workspace_connection_folder_unique").on(
      table.workspaceId,
      table.connectionId,
      table.folder,
    ),
    expirationIdx: index("gmail_sync_state_expiration_idx").on(table.watchExpiration),
    emailAddressIdx: index("gmail_sync_state_email_address_idx").on(table.emailAddress),
  }),
);
