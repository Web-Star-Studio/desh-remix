import {
  bigint,
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
import { users } from "./users";
import { fileFolders } from "./file-folders";

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .references(() => users.id, { onDelete: "set null" }),
    folderId: uuid("folder_id").references(() => fileFolders.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull(),
    name: text("name").notNull(),
    // Original-as-uploaded filename; `name` is the (potentially renamed)
    // display name. Kept distinct so renames don't lose provenance.
    originalName: text("original_name").notNull().default(""),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    category: text("category").notNull().default("file"),
    // Where the row came from: 'upload' (SPA), 'inbox' (Files inbox import),
    // 'drive' (Google Drive sync), etc. Free-form text — the route layer
    // doesn't enforce a closed set so future ingestion flows can append.
    source: text("source").notNull().default("upload"),
    extension: text("extension").notNull().default(""),
    contentHash: text("content_hash"),
    thumbnailUrl: text("thumbnail_url"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    isTrashed: boolean("is_trashed").notNull().default(false),
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
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
    workspaceFolderIdx: index("files_workspace_folder_idx").on(
      table.workspaceId,
      table.folderId,
    ),
    workspaceTrashedIdx: index("files_workspace_trashed_idx").on(
      table.workspaceId,
      table.isTrashed,
    ),
    workspaceHashIdx: index("files_workspace_hash_idx").on(
      table.workspaceId,
      table.contentHash,
    ),
    storageKeyUnique: unique("files_storage_key_unique").on(table.storageKey),
  }),
);
