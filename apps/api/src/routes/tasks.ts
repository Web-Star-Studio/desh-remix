import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireUserDbId } from "../services/users.js";
import {
  createSubtask,
  createTask,
  deleteSubtask,
  deleteTask,
  listTasks,
  updateSubtask,
  updateTask,
  type TaskPriority,
  type TaskStatus,
} from "../services/tasks.js";
import { isServiceError } from "../services/errors.js";

const StatusEnum = z.enum(["todo", "in_progress", "done"]);
const PriorityEnum = z.enum(["low", "medium", "high"]);

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const TaskParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
});
const SubtaskParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
  subtaskId: z.string().uuid(),
});

const CreateBody = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(8000).optional(),
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  project: z.string().max(120).nullable().optional(),
  recurrence: z.string().max(120).nullable().optional(),
});

const PatchBody = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(8000).optional(),
  status: StatusEnum.optional(),
  priority: PriorityEnum.optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  project: z.string().max(120).nullable().optional(),
  recurrence: z.string().max(120).nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
  googleTaskId: z.string().max(200).nullable().optional(),
  googleTasklistId: z.string().max(200).nullable().optional(),
});

const SubtaskCreateBody = z.object({
  title: z.string().min(1).max(500),
  sortOrder: z.number().int().nonnegative().optional(),
});

const SubtaskPatchBody = z.object({
  title: z.string().min(1).max(500).optional(),
  completed: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

// Maps thrown ServiceError into a Fastify reply. Returns true if the error
// was handled. Anything else bubbles to Fastify's default error handler.
function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function tasksRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/tasks", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      return await listTasks(params.data.workspaceId, dbId);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/tasks", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      const created = await createTask(params.data.workspaceId, dbId, {
        ...parsed.data,
        status: parsed.data.status as TaskStatus | undefined,
        priority: parsed.data.priority as TaskPriority | undefined,
      });
      return reply.code(201).send(created);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/workspaces/:workspaceId/tasks/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = TaskParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      return await updateTask(params.data.workspaceId, dbId, params.data.id, {
        ...parsed.data,
        status: parsed.data.status as TaskStatus | undefined,
        priority: parsed.data.priority as TaskPriority | undefined,
      });
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.delete("/workspaces/:workspaceId/tasks/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = TaskParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await deleteTask(params.data.workspaceId, dbId, params.data.id);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/tasks/:id/subtasks", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = TaskParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = SubtaskCreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      const created = await createSubtask(params.data.workspaceId, dbId, params.data.id, parsed.data);
      return reply.code(201).send(created);
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/workspaces/:workspaceId/tasks/:id/subtasks/:subtaskId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = SubtaskParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = SubtaskPatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      return await updateSubtask(
        params.data.workspaceId,
        dbId,
        params.data.id,
        params.data.subtaskId,
        parsed.data,
      );
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.delete("/workspaces/:workspaceId/tasks/:id/subtasks/:subtaskId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = SubtaskParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await deleteSubtask(params.data.workspaceId, dbId, params.data.subtaskId);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

}
