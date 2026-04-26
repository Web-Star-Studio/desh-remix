import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { taskSubtasks, tasks, workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";

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

function toApiTask(
  row: typeof tasks.$inferSelect,
  subs: (typeof taskSubtasks.$inferSelect)[] = [],
) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    createdBy: row.createdBy,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    project: row.project,
    recurrence: row.recurrence,
    completedAt: row.completedAt?.toISOString() ?? null,
    googleTaskId: row.googleTaskId,
    googleTasklistId: row.googleTasklistId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    subtasks: subs.map(toApiSubtask),
  };
}

function toApiSubtask(row: typeof taskSubtasks.$inferSelect) {
  return {
    id: row.id,
    taskId: row.taskId,
    title: row.title,
    completed: row.completed,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export default async function tasksRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/tasks", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const taskRows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.workspaceId, params.data.workspaceId))
      .orderBy(desc(tasks.createdAt));

    const taskIds = taskRows.map((t) => t.id);
    const subs = taskIds.length
      ? await db
          .select()
          .from(taskSubtasks)
          .where(inArray(taskSubtasks.taskId, taskIds))
          .orderBy(asc(taskSubtasks.sortOrder))
      : [];

    const subsByTask = new Map<string, (typeof taskSubtasks.$inferSelect)[]>();
    for (const s of subs) {
      const list = subsByTask.get(s.taskId) ?? [];
      list.push(s);
      subsByTask.set(s.taskId, list);
    }

    return taskRows.map((t) => toApiTask(t, subsByTask.get(t.id) ?? []));
  });

  app.post("/workspaces/:workspaceId/tasks", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const [created] = await db
      .insert(tasks)
      .values({
        workspaceId: params.data.workspaceId,
        createdBy: dbId,
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        status: parsed.data.status ?? "todo",
        priority: parsed.data.priority ?? "medium",
        dueDate: parsed.data.dueDate ?? null,
        project: parsed.data.project ?? null,
        recurrence: parsed.data.recurrence ?? null,
      })
      .returning();
    if (!created) return reply.code(500).send({ error: "insert_failed" });

    return reply.code(201).send(toApiTask(created));
  });

  app.patch("/workspaces/:workspaceId/tasks/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = TaskParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.code(400).send({ error: "empty_patch" });
    }

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const { completedAt, ...rest } = parsed.data;
    const set: Partial<typeof tasks.$inferInsert> = {
      ...rest,
      updatedAt: new Date(),
    };
    if (completedAt !== undefined) {
      set.completedAt = completedAt ? new Date(completedAt) : null;
    }

    const [updated] = await db
      .update(tasks)
      .set(set)
      .where(
        and(
          eq(tasks.id, params.data.id),
          eq(tasks.workspaceId, params.data.workspaceId),
        ),
      )
      .returning();
    if (!updated) return reply.code(404).send({ error: "task_not_found" });

    const subs = await db
      .select()
      .from(taskSubtasks)
      .where(eq(taskSubtasks.taskId, updated.id))
      .orderBy(asc(taskSubtasks.sortOrder));

    return toApiTask(updated, subs);
  });

  app.delete("/workspaces/:workspaceId/tasks/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = TaskParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const result = await db
      .delete(tasks)
      .where(
        and(
          eq(tasks.id, params.data.id),
          eq(tasks.workspaceId, params.data.workspaceId),
        ),
      )
      .returning({ id: tasks.id });
    if (!result[0]) return reply.code(404).send({ error: "task_not_found" });

    return reply.code(204).send();
  });

  app.post("/workspaces/:workspaceId/tasks/:id/subtasks", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = TaskParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = SubtaskCreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const parent = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, params.data.id),
          eq(tasks.workspaceId, params.data.workspaceId),
        ),
      )
      .limit(1);
    if (!parent[0]) return reply.code(404).send({ error: "task_not_found" });

    const [created] = await db
      .insert(taskSubtasks)
      .values({
        taskId: params.data.id,
        title: parsed.data.title,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning();
    if (!created) return reply.code(500).send({ error: "insert_failed" });

    return reply.code(201).send(toApiSubtask(created));
  });

  app.patch("/workspaces/:workspaceId/tasks/:id/subtasks/:subtaskId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = SubtaskParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = SubtaskPatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.code(400).send({ error: "empty_patch" });
    }

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    // Membership-checked, but also confirm the subtask belongs to a task in
    // this workspace — defends against a member of one workspace touching a
    // subtask via a forged URL.
    const guard = await db
      .select({ id: taskSubtasks.id })
      .from(taskSubtasks)
      .innerJoin(tasks, eq(tasks.id, taskSubtasks.taskId))
      .where(
        and(
          eq(taskSubtasks.id, params.data.subtaskId),
          eq(tasks.id, params.data.id),
          eq(tasks.workspaceId, params.data.workspaceId),
        ),
      )
      .limit(1);
    if (!guard[0]) return reply.code(404).send({ error: "subtask_not_found" });

    const [updated] = await db
      .update(taskSubtasks)
      .set(parsed.data)
      .where(eq(taskSubtasks.id, params.data.subtaskId))
      .returning();
    if (!updated) return reply.code(404).send({ error: "subtask_not_found" });

    return toApiSubtask(updated);
  });

  app.delete("/workspaces/:workspaceId/tasks/:id/subtasks/:subtaskId", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = SubtaskParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });

    if (!(await isWorkspaceMember(params.data.workspaceId, dbId))) {
      return reply.code(404).send({ error: "not_found" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const result = await db
      .delete(taskSubtasks)
      .where(eq(taskSubtasks.id, params.data.subtaskId))
      .returning({ id: taskSubtasks.id });
    if (!result[0]) return reply.code(404).send({ error: "subtask_not_found" });

    return reply.code(204).send();
  });
}
