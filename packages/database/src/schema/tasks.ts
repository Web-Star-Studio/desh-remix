import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspaces } from "./workspaces";
import { users } from "./users";

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("todo"),
    priority: text("priority").notNull().default("medium"),
    dueDate: date("due_date"),
    project: text("project"),
    recurrence: text("recurrence"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    googleTaskId: text("google_task_id"),
    googleTasklistId: text("google_tasklist_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCheck: check("tasks_status_check", sql`${table.status} in ('todo','in_progress','done')`),
    priorityCheck: check("tasks_priority_check", sql`${table.priority} in ('low','medium','high')`),
    workspaceIdx: index("tasks_workspace_id_idx").on(table.workspaceId),
  }),
);

export const taskSubtasks = pgTable(
  "task_subtasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    completed: boolean("completed").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    taskIdx: index("task_subtasks_task_id_idx").on(table.taskId),
  }),
);
