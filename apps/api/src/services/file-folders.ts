import { and, asc, eq } from "drizzle-orm";
import { fileFolders } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { assertWorkspaceMember } from "./workspace-members.js";

// File folder hierarchy. Workspace-scoped, self-referential parent (so an
// arbitrary tree depth is supported). Smart-folder rule evaluation is
// deferred to Wave B; this service only handles plain folder CRUD.

export interface ApiFileFolder {
  id: string;
  workspaceId: string;
  createdBy: string | null;
  name: string;
  parentId: string | null;
  color: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function toApi(row: typeof fileFolders.$inferSelect): ApiFileFolder {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdBy: row.createdBy,
    name: row.name,
    parentId: row.parentId,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

export async function listFolders(
  workspaceId: string,
  actorUserId: string,
): Promise<ApiFileFolder[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const rows = await db
    .select()
    .from(fileFolders)
    .where(eq(fileFolders.workspaceId, workspaceId))
    .orderBy(asc(fileFolders.sortOrder), asc(fileFolders.name));
  return rows.map(toApi);
}

export interface CreateFolderInput {
  name: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export async function createFolder(
  workspaceId: string,
  actorUserId: string,
  input: CreateFolderInput,
): Promise<ApiFileFolder> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  // Defend against parents from a different workspace — the FK doesn't
  // enforce workspace scoping, just folder existence.
  if (input.parentId) {
    const [parent] = await db
      .select({ id: fileFolders.id })
      .from(fileFolders)
      .where(
        and(
          eq(fileFolders.id, input.parentId),
          eq(fileFolders.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!parent) throw new ServiceError(404, "parent_folder_not_found");
  }

  const [row] = await db
    .insert(fileFolders)
    .values({
      workspaceId,
      createdBy: actorUserId,
      name: input.name,
      parentId: input.parentId ?? null,
      color: input.color ?? "",
      icon: input.icon ?? "",
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  if (!row) throw new ServiceError(500, "insert_failed");
  return toApi(row);
}

export type UpdateFolderInput = Partial<CreateFolderInput>;

export async function updateFolder(
  workspaceId: string,
  actorUserId: string,
  folderId: string,
  input: UpdateFolderInput,
): Promise<ApiFileFolder> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  // Same parent-scope check as create.
  if (input.parentId) {
    if (input.parentId === folderId) throw new ServiceError(400, "self_parent");
    const [parent] = await db
      .select({ id: fileFolders.id })
      .from(fileFolders)
      .where(
        and(
          eq(fileFolders.id, input.parentId),
          eq(fileFolders.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!parent) throw new ServiceError(404, "parent_folder_not_found");
  }

  const [row] = await db
    .update(fileFolders)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(fileFolders.id, folderId), eq(fileFolders.workspaceId, workspaceId)))
    .returning();
  if (!row) throw new ServiceError(404, "folder_not_found");
  return toApi(row);
}

export async function deleteFolder(
  workspaceId: string,
  actorUserId: string,
  folderId: string,
): Promise<void> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  // Children get parentId set to null via the FK rule; files in the folder
  // get folderId nulled (they move to root, not to trash).
  const result = await db
    .delete(fileFolders)
    .where(and(eq(fileFolders.id, folderId), eq(fileFolders.workspaceId, workspaceId)))
    .returning({ id: fileFolders.id });
  if (!result[0]) throw new ServiceError(404, "folder_not_found");
}
