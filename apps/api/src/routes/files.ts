import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { files, workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";
import { env } from "../config/env.js";
import {
  buildStorageKey,
  deleteObject,
  getDownloadUrl,
  getUploadUrl,
  headObject,
  isStorageConfigured,
  type FileCategory,
} from "../services/storage.js";

const CategoryEnum = z.enum(["file", "note-image", "profile-doc"]);

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const FileParams = z.object({
  workspaceId: z.string().uuid(),
  fileId: z.string().uuid(),
});

const UploadUrlBody = z.object({
  name: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
  category: CategoryEnum.optional(),
});

const ConfirmBody = z.object({
  storageKey: z.string().min(1).max(1000),
  name: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative(),
  category: CategoryEnum.optional(),
  contentHash: z.string().max(200).nullable().optional(),
});

const ListQuery = z.object({
  category: CategoryEnum.optional(),
});

async function isWorkspaceMember(workspaceId: string, userDbId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userDbId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

function toApiFile(row: typeof files.$inferSelect) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    uploadedBy: row.uploadedBy,
    storageKey: row.storageKey,
    name: row.name,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    category: row.category as FileCategory,
    contentHash: row.contentHash,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default async function filesRoutes(app: FastifyInstance) {
  // Mint a presigned PUT URL. Doesn't write anything to the DB — the SPA
  // calls /confirm after a successful upload to persist the row.
  app.post("/workspaces/:workspaceId/files/upload-url", async (req, reply) => {
    if (!isStorageConfigured()) return reply.code(503).send({ error: "storage_not_configured" });
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = UploadUrlBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });

    const dbId = await requireUserDbId(req);
    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const category = body.data.category ?? "file";
    const storageKey = buildStorageKey({
      workspaceId: params.data.workspaceId,
      category,
      filename: body.data.name,
    });
    const uploadUrl = await getUploadUrl({
      storageKey,
      contentType: body.data.mimeType,
    });
    const expiresAt = new Date(Date.now() + env.AWS_S3_PRESIGN_TTL_SECONDS * 1000).toISOString();
    return { uploadUrl, storageKey, expiresAt };
  });

  // Persist the file row after the SPA's PUT to S3 succeeds. We HEAD the
  // object to confirm the bytes actually landed; without that check, a
  // misbehaving (or malicious) client could spam rows for keys that don't
  // exist.
  app.post("/workspaces/:workspaceId/files/confirm", async (req, reply) => {
    if (!isStorageConfigured()) return reply.code(503).send({ error: "storage_not_configured" });
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = ConfirmBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });

    const dbId = await requireUserDbId(req);
    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    // The storage_key must live under this workspace's prefix. Belt-and-suspenders
    // against a client that picked a key from a different workspace it happens
    // to be a member of.
    const expectedPrefix = `workspaces/${params.data.workspaceId}/`;
    if (!body.data.storageKey.startsWith(expectedPrefix)) {
      return reply.code(400).send({ error: "storage_key_mismatch" });
    }

    const head = await headObject(body.data.storageKey);
    if (!head.exists) {
      return reply.code(409).send({ error: "object_not_uploaded" });
    }

    const db = getDb();
    if (!db) return reply.code(503).send({ error: "db_unavailable" });

    const [row] = await db
      .insert(files)
      .values({
        workspaceId: params.data.workspaceId,
        uploadedBy: dbId,
        storageKey: body.data.storageKey,
        name: body.data.name,
        mimeType: body.data.mimeType,
        sizeBytes: body.data.sizeBytes,
        category: body.data.category ?? "file",
        contentHash: body.data.contentHash ?? null,
      })
      .returning();
    return reply.code(201).send(toApiFile(row!));
  });

  app.get("/workspaces/:workspaceId/files", async (req, reply) => {
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const query = ListQuery.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: "invalid_query" });

    const dbId = await requireUserDbId(req);
    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(503).send({ error: "db_unavailable" });

    const where = query.data.category
      ? and(eq(files.workspaceId, params.data.workspaceId), eq(files.category, query.data.category))
      : eq(files.workspaceId, params.data.workspaceId);
    const rows = await db.select().from(files).where(where).orderBy(desc(files.createdAt));
    return rows.map(toApiFile);
  });

  app.get("/workspaces/:workspaceId/files/:fileId/download-url", async (req, reply) => {
    if (!isStorageConfigured()) return reply.code(503).send({ error: "storage_not_configured" });
    const params = FileParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    const dbId = await requireUserDbId(req);
    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(503).send({ error: "db_unavailable" });

    const [row] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, params.data.fileId), eq(files.workspaceId, params.data.workspaceId)))
      .limit(1);
    if (!row) return reply.code(404).send({ error: "not_found" });

    const url = await getDownloadUrl({ storageKey: row.storageKey });
    const expiresAt = new Date(Date.now() + env.AWS_S3_PRESIGN_TTL_SECONDS * 1000).toISOString();
    return { url, expiresAt };
  });

  app.delete("/workspaces/:workspaceId/files/:fileId", async (req, reply) => {
    const params = FileParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    const dbId = await requireUserDbId(req);
    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(503).send({ error: "db_unavailable" });

    const [row] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, params.data.fileId), eq(files.workspaceId, params.data.workspaceId)))
      .limit(1);
    if (!row) return reply.code(404).send({ error: "not_found" });

    // Best-effort S3 delete. If it fails, leave the row so an operator can
    // retry rather than silently lose track of the object.
    if (isStorageConfigured()) {
      try {
        await deleteObject(row.storageKey);
      } catch (err) {
        req.log.warn({ err, storageKey: row.storageKey }, "[files] S3 delete failed; row retained");
        return reply.code(502).send({ error: "storage_delete_failed" });
      }
    }
    await db.delete(files).where(eq(files.id, row.id));
    return reply.code(204).send();
  });
}
