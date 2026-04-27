import {
  type AnyPgColumn,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// Per-workspace folder hierarchy for the Files page. Self-referential parent
// so an arbitrary tree depth is supported; the SPA renders breadcrumbs by
// walking parent_id. `sort_order` lets the SPA persist drag-to-reorder
// without ratcheting timestamps. Smart folders (rule-driven views) are
// deferred to Wave B; this table is plain folders only for now.
export const fileFolders = pgTable(
  "file_folders",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    // Self-FK with `set null` so deleting a parent folder promotes its
    // children to the root rather than cascading them away.
    parentId: uuid("parent_id").references((): AnyPgColumn => fileFolders.id, {
      onDelete: "set null",
    }),
    color: text("color").notNull().default(""),
    icon: text("icon").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("file_folders_workspace_id_idx").on(table.workspaceId),
    workspaceParentIdx: index("file_folders_workspace_parent_idx").on(
      table.workspaceId,
      table.parentId,
    ),
  }),
);
