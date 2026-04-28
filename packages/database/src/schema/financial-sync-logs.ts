import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";
import { financialConnections } from "./financial-connections";

// Append-only audit trail for every Pluggy sync attempt. The orchestrator
// inserts a 'running' row at start, then updates to 'success' or 'error'
// at finish (with counts + duration). Useful for the UI "Last sync" badge
// and for debugging stuck connections — a stale 'running' row is the tell
// that a sync was killed mid-flight.
export const financialSyncLogs = pgTable(
  "financial_sync_logs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => financialConnections.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("pluggy"),
    status: text("status").notNull().default("running"),
    accountsSynced: integer("accounts_synced").notNull().default(0),
    transactionsSynced: integer("transactions_synced").notNull().default(0),
    investmentsSynced: integer("investments_synced").notNull().default(0),
    loansSynced: integer("loans_synced").notNull().default(0),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCheck: check(
      "financial_sync_logs_status_check",
      sql`${table.status} in ('running','success','error')`,
    ),
    workspaceCreatedIdx: index("financial_sync_logs_ws_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    connectionCreatedIdx: index("financial_sync_logs_conn_created_idx").on(
      table.connectionId,
      table.createdAt,
    ),
  }),
);
