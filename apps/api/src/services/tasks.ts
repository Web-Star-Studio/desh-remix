import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { taskSubtasks, tasks } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { assertWorkspaceMember } from "./workspace-members.js";
import { emitAutomationEvent } from "./automations.js";

// Service layer for tasks + subtasks. Both the REST routes (apps/api/src/
// routes/tasks.ts) and the MCP tools (apps/api/src/services/mcp/tools-
// tasks.ts) call into here, so behavior stays single-source-of-truth.

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface ApiTask {
  id: string;
  workspaceId: string;
  createdBy: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string | null;
  project: string | null;
  recurrence: string | null;
  completedAt: string | null;
  googleTaskId: string | null;
  googleTasklistId: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: ApiSubtask[];
}

export interface ApiSubtask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
}

function toApiTask(
  row: typeof tasks.$inferSelect,
  subs: (typeof taskSubtasks.$inferSelect)[] = [],
): ApiTask {
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

function toApiSubtask(row: typeof taskSubtasks.$inferSelect): ApiSubtask {
  return {
    id: row.id,
    taskId: row.taskId,
    title: row.title,
    completed: row.completed,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

function dbOrThrow() {
  const db = getDb();
  if (!db) throw new ServiceError(500, "db_unavailable");
  return db;
}

// ─── Tasks ──────────────────────────────────────────────────────────

export interface ListTasksFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  limit?: number;
}

export async function listTasks(
  workspaceId: string,
  actorUserId: string,
  filters: ListTasksFilters = {},
): Promise<ApiTask[]> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const conditions = [eq(tasks.workspaceId, workspaceId)];
  if (filters.status) conditions.push(eq(tasks.status, filters.status));
  if (filters.priority) conditions.push(eq(tasks.priority, filters.priority));

  let query = db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt))
    .$dynamic();
  if (filters.limit && filters.limit > 0) query = query.limit(filters.limit);
  const taskRows = await query;

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
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  project?: string | null;
  recurrence?: string | null;
}

export async function createTask(
  workspaceId: string,
  actorUserId: string,
  input: CreateTaskInput,
): Promise<ApiTask> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const [created] = await db
    .insert(tasks)
    .values({
      workspaceId,
      createdBy: actorUserId,
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      dueDate: input.dueDate ?? null,
      project: input.project ?? null,
      recurrence: input.recurrence ?? null,
    })
    .returning();
  if (!created) throw new ServiceError(500, "insert_failed");
  emitAutomationEvent(workspaceId, "task_created", {
    taskId: created.id,
    title: created.title,
    priority: created.priority,
    dueDate: created.dueDate,
  });
  return toApiTask(created);
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  project?: string | null;
  recurrence?: string | null;
  completedAt?: string | null;
  googleTaskId?: string | null;
  googleTasklistId?: string | null;
}

export async function updateTask(
  workspaceId: string,
  actorUserId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<ApiTask> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const { completedAt, ...rest } = input;
  const set: Partial<typeof tasks.$inferInsert> = { ...rest, updatedAt: new Date() };
  if (completedAt !== undefined) {
    set.completedAt = completedAt ? new Date(completedAt) : null;
  }

  const [updated] = await db
    .update(tasks)
    .set(set)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
    .returning();
  if (!updated) throw new ServiceError(404, "task_not_found");

  if (input.status === "done" || (input.completedAt != null && updated.status === "done")) {
    emitAutomationEvent(workspaceId, "task_completed", {
      taskId: updated.id,
      title: updated.title,
    });
  }

  const subs = await db
    .select()
    .from(taskSubtasks)
    .where(eq(taskSubtasks.taskId, updated.id))
    .orderBy(asc(taskSubtasks.sortOrder));
  return toApiTask(updated, subs);
}

// Convenience for the agent's most-frequent intent. Sets status='done' and
// completedAt=now in one round-trip; re-uses updateTask to keep behavior
// consistent with the REST PATCH path.
export async function completeTask(
  workspaceId: string,
  actorUserId: string,
  taskId: string,
): Promise<ApiTask> {
  return updateTask(workspaceId, actorUserId, taskId, {
    status: "done",
    completedAt: new Date().toISOString(),
  });
}

export async function deleteTask(
  workspaceId: string,
  actorUserId: string,
  taskId: string,
): Promise<void> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const result = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
    .returning({ id: tasks.id });
  if (!result[0]) throw new ServiceError(404, "task_not_found");
}

// ─── Subtasks ───────────────────────────────────────────────────────

export interface CreateSubtaskInput {
  title: string;
  sortOrder?: number;
}

export async function createSubtask(
  workspaceId: string,
  actorUserId: string,
  taskId: string,
  input: CreateSubtaskInput,
): Promise<ApiSubtask> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  const parent = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
    .limit(1);
  if (!parent[0]) throw new ServiceError(404, "task_not_found");

  const [created] = await db
    .insert(taskSubtasks)
    .values({
      taskId,
      title: input.title,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  if (!created) throw new ServiceError(500, "insert_failed");
  return toApiSubtask(created);
}

export interface UpdateSubtaskInput {
  title?: string;
  completed?: boolean;
  sortOrder?: number;
}

export async function updateSubtask(
  workspaceId: string,
  actorUserId: string,
  taskId: string,
  subtaskId: string,
  input: UpdateSubtaskInput,
): Promise<ApiSubtask> {
  if (Object.keys(input).length === 0) throw new ServiceError(400, "empty_patch");
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();

  // Defend against forged URLs across workspaces — verify the subtask
  // belongs to a task in this workspace before updating.
  const guard = await db
    .select({ id: taskSubtasks.id })
    .from(taskSubtasks)
    .innerJoin(tasks, eq(tasks.id, taskSubtasks.taskId))
    .where(
      and(
        eq(taskSubtasks.id, subtaskId),
        eq(tasks.id, taskId),
        eq(tasks.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!guard[0]) throw new ServiceError(404, "subtask_not_found");

  const [updated] = await db
    .update(taskSubtasks)
    .set(input)
    .where(eq(taskSubtasks.id, subtaskId))
    .returning();
  if (!updated) throw new ServiceError(404, "subtask_not_found");
  return toApiSubtask(updated);
}

export async function deleteSubtask(
  workspaceId: string,
  actorUserId: string,
  subtaskId: string,
): Promise<void> {
  await assertWorkspaceMember(workspaceId, actorUserId);
  const db = dbOrThrow();
  const result = await db
    .delete(taskSubtasks)
    .where(eq(taskSubtasks.id, subtaskId))
    .returning({ id: taskSubtasks.id });
  if (!result[0]) throw new ServiceError(404, "subtask_not_found");
}
