import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolder,
} from "../services/file-folders.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const FolderParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
});

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(60).optional(),
  sortOrder: z.number().int().optional(),
});

const PatchBody = CreateBody.partial();

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function fileFoldersRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/file-folders", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await listFolders(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/file-folders", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = CreateBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      const created = await createFolder(params.data.workspaceId, dbId, body.data);
      return reply.code(201).send(created);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/workspaces/:workspaceId/file-folders/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = FolderParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = PatchBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await updateFolder(
        params.data.workspaceId,
        dbId,
        params.data.id,
        body.data,
      );
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.delete("/workspaces/:workspaceId/file-folders/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = FolderParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await deleteFolder(params.data.workspaceId, dbId, params.data.id);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
