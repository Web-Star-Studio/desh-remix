import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .references(() => users.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull(),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    category: text("category").notNull().default("file"),
    contentHash: text("content_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryCheck: check(
      "files_category_check",
      sql`${table.category} in ('file','note-image','profile-doc')`,
    ),
    sizeCheck: check("files_size_check", sql`${table.sizeBytes} >= 0`),
    workspaceIdx: index("files_workspace_id_idx").on(table.workspaceId),
    workspaceCategoryIdx: index("files_workspace_category_idx").on(
      table.workspaceId,
      table.category,
    ),
    storageKeyUnique: unique("files_storage_key_unique").on(table.storageKey),
  }),
);
