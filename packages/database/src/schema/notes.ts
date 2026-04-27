import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

// First-party notes table. Replaces the legacy `user_data` `data_type='note'`
// JSONB-blob pattern: every field that the SPA filters or sorts on is now a
// real column. `content` is HTML (with `<img data-file-id="…">` placeholders
// resolved to fresh signed URLs at render). Audio blocks live inline in the
// HTML as well — no separate audio table.
//
// Soft-delete via `deletedAt`: the SPA treats a non-null value as "in trash"
// and excludes such rows from the default list view; clearing it restores.
// Permanent delete removes the row + cascades any FKs (none today).
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    // text[] (not jsonb) for trivially-indexable filter queries when the SPA
    // grows server-side tag filtering. The legacy shape was `string[]` already.
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    notebook: text("notebook").notNull().default(""),
    color: text("color").notNull().default("border-l-primary"),
    pinned: boolean("pinned").notNull().default(false),
    favorited: boolean("favorited").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("notes_workspace_id_idx").on(table.workspaceId),
    workspaceDeletedIdx: index("notes_workspace_deleted_idx").on(
      table.workspaceId,
      table.deletedAt,
    ),
    workspaceNotebookIdx: index("notes_workspace_notebook_idx").on(
      table.workspaceId,
      table.notebook,
    ),
  }),
);
