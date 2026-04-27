import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  confirmUpload,
  deleteFile,
  emptyTrash,
  getFile,
  getFileDownloadUrl,
  getStorageStats,
  listFiles,
  patchFile,
  permanentDeleteFiles,
  prepareUpload,
  restoreFiles,
  trashFiles,
} from "../services/files.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";

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
  originalName: z.string().max(500).optional(),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative(),
  category: CategoryEnum.optional(),
  contentHash: z.string().max(200).nullable().optional(),
  folderId: z.string().uuid().nullable().optional(),
  source: z.string().max(60).optional(),
  forceUpload: z.boolean().optional(),
});

const ListQuery = z.object({
  category: CategoryEnum.optional(),
  // `folderId=root` selects unfiled files (folder_id IS NULL); otherwise a UUID.
  folderId: z.union([z.literal("root"), z.string().uuid()]).optional(),
  trashed: z.coerce.boolean().optional(),
  favorites: z.coerce.boolean().optional(),
  search: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

const PatchBody = z.object({
  name: z.string().min(1).max(500).optional(),
  folderId: z.string().uuid().nullable().optional(),
  isFavorite: z.boolean().optional(),
});

const TrashBody = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(500),
});

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function filesRoutes(app: FastifyInstance) {
  // Mint a presigned PUT URL. Doesn't write anything to the DB — the SPA
  // calls /confirm after a successful upload to persist the row.
  app.post("/workspaces/:workspaceId/files/upload-url", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = UploadUrlBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await prepareUpload(params.data.workspaceId, dbId, body.data);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  // Persist the file row after S3 PUT succeeds. HEAD-checks the object
  // before insert; dedup-by-hash returns the existing row with `duplicate=true`
  // unless the SPA passes `forceUpload=true`.
  app.post("/workspaces/:workspaceId/files/confirm", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = ConfirmBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      const result = await confirmUpload(params.data.workspaceId, dbId, body.data);
      return reply.code(result.duplicate ? 200 : 201).send(result);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/workspaces/:workspaceId/files", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const query = ListQuery.safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_query", details: query.error.flatten() });
    }
    try {
      return await listFiles(params.data.workspaceId, dbId, {
        category: query.data.category,
        folderId: query.data.folderId,
        trashed: query.data.trashed,
        favoritesOnly: query.data.favorites,
        search: query.data.search,
        limit: query.data.limit,
      });
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/workspaces/:workspaceId/files/stats", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await getStorageStats(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/workspaces/:workspaceId/files/:fileId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = FileParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await getFile(params.data.workspaceId, dbId, params.data.fileId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/workspaces/:workspaceId/files/:fileId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = FileParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = PatchBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await patchFile(
        params.data.workspaceId,
        dbId,
        params.data.fileId,
        body.data,
      );
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/workspaces/:workspaceId/files/:fileId/download-url", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = FileParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await getFileDownloadUrl(params.data.workspaceId, dbId, params.data.fileId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  // Soft-delete batch. The trashed flag flips; rows stay visible under
  // `?trashed=true`. Permanent removal happens via /trash/empty or the
  // single-file DELETE.
  app.post("/workspaces/:workspaceId/files/trash", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = TrashBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await trashFiles(params.data.workspaceId, dbId, body.data.fileIds);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/files/restore", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = TrashBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await restoreFiles(params.data.workspaceId, dbId, body.data.fileIds);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/files/permanent-delete", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = TrashBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await permanentDeleteFiles(params.data.workspaceId, dbId, body.data.fileIds);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/files/trash/empty", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await emptyTrash(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  // Single-file immediate-delete. Skips the trash; useful for callers that
  // already have an "are you sure?" dialog (e.g. the legacy delete-key shortcut).
  app.delete("/workspaces/:workspaceId/files/:fileId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = FileParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await deleteFile(params.data.workspaceId, dbId, params.data.fileId);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
