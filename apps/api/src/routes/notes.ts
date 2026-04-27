import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  bulkPatchNotes,
  createNote,
  emptyTrash,
  getNote,
  listNotes,
  listNotebooks,
  permanentDeleteNotes,
  restoreNotes,
  trashNotes,
  updateNote,
} from "../services/notes.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const NoteParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
});

const ListQuery = z.object({
  trashed: z.coerce.boolean().optional(),
  notebook: z.string().min(0).max(120).optional(),
  favorites: z.coerce.boolean().optional(),
  search: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().positive().max(5000).optional(),
});

const CreateBody = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(2_000_000).optional(),
  tags: z.array(z.string().max(64)).max(50).optional(),
  notebook: z.string().max(120).optional(),
  color: z.string().max(60).optional(),
  pinned: z.boolean().optional(),
  favorited: z.boolean().optional(),
});

const PatchBody = CreateBody.partial();

const NoteIdsBody = z.object({
  noteIds: z.array(z.string().uuid()).min(1).max(500),
});

const BulkBody = z.object({
  noteIds: z.array(z.string().uuid()).min(1).max(500),
  pinned: z.boolean().optional(),
  favorited: z.boolean().optional(),
  notebook: z.string().max(120).optional(),
  color: z.string().max(60).optional(),
  addTags: z.array(z.string().max(64)).max(50).optional(),
});

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function notesRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/notes", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const query = ListQuery.safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_query", details: query.error.flatten() });
    }
    try {
      return await listNotes(params.data.workspaceId, dbId, {
        trashed: query.data.trashed,
        notebook: query.data.notebook,
        favoritesOnly: query.data.favorites,
        search: query.data.search,
        limit: query.data.limit,
      });
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/workspaces/:workspaceId/notes/notebooks", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await listNotebooks(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/workspaces/:workspaceId/notes/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = NoteParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await getNote(params.data.workspaceId, dbId, params.data.id);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/notes", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = CreateBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      const created = await createNote(params.data.workspaceId, dbId, body.data);
      return reply.code(201).send(created);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/workspaces/:workspaceId/notes/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = NoteParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = PatchBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await updateNote(
        params.data.workspaceId,
        dbId,
        params.data.id,
        body.data,
      );
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/notes/trash", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = NoteIdsBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await trashNotes(params.data.workspaceId, dbId, body.data.noteIds);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/notes/restore", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = NoteIdsBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await restoreNotes(params.data.workspaceId, dbId, body.data.noteIds);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/notes/permanent-delete", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = NoteIdsBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await permanentDeleteNotes(
        params.data.workspaceId,
        dbId,
        body.data.noteIds,
      );
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/notes/trash/empty", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await emptyTrash(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/notes/bulk", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = BulkBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      return await bulkPatchNotes(params.data.workspaceId, dbId, body.data);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.delete("/workspaces/:workspaceId/notes/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = NoteParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      const result = await permanentDeleteNotes(
        params.data.workspaceId,
        dbId,
        [params.data.id],
      );
      if (result.deleted === 0) return reply.code(404).send({ error: "note_not_found" });
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
