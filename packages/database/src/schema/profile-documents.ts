import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";
import { files } from "./files";

// Profile-specific identity documents (RG, CPF, passport, CNH, etc.) the user
// keeps on hand. The actual binary lives in S3 via `files`; this table holds
// the profile-document metadata (doc_type, label) and ties the file to a
// user inside a workspace.
//
// Workspace-scoped for consistency with everything else, even though profile
// documents are conceptually per-user — the workspace owner is the user, and
// the storage_key prefix is workspace-scoped already.
export const profileDocuments = pgTable(
  "profile_documents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    docType: text("doc_type").notNull().default("other"),
    label: text("label").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    docTypeCheck: check(
      "profile_documents_doc_type_check",
      sql`${table.docType} in ('rg','cpf','passport','cnh','proof_of_address','other')`,
    ),
    userIdx: index("profile_documents_user_id_idx").on(table.userId),
    workspaceIdx: index("profile_documents_workspace_id_idx").on(table.workspaceId),
  }),
);
