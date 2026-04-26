import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  completeTask,
  createTask,
  listTasks,
  type ApiTask,
  type TaskPriority,
  type TaskStatus,
} from "../tasks.js";
import type { McpAuthContext } from "./auth.js";
import { toolError, toolText } from "./tool-result.js";

// Slim shape returned to the agent — token-efficient. The full row is
// available via the REST API when the SPA renders the tasks page; the
// agent rarely needs description, recurrence, or audit timestamps.
function slimTask(t: ApiTask) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    project: t.project,
  };
}

export function registerTaskTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "Lista tarefas do workspace ativo. Filtros opcionais por status (todo/in_progress/done) e prioridade (low/medium/high). Retorna até `limit` tarefas (padrão 50).",
      inputSchema: {
        status: z.enum(["todo", "in_progress", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async (args) => {
      try {
        const rows = await listTasks(ctx.workspaceId, ctx.ownerUserId, {
          status: args.status as TaskStatus | undefined,
          priority: args.priority as TaskPriority | undefined,
          limit: args.limit ?? 50,
        });
        return toolText(rows.map(slimTask));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description:
        "Cria uma nova tarefa no workspace ativo. `dueDate` no formato YYYY-MM-DD se informado. Retorna { id, title, status }.",
      inputSchema: {
        title: z.string().min(1).max(500),
        description: z.string().max(8000).optional(),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD")
          .optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        project: z.string().max(120).optional(),
      },
    },
    async (args) => {
      try {
        const row = await createTask(ctx.workspaceId, ctx.ownerUserId, {
          title: args.title,
          description: args.description,
          dueDate: args.dueDate ?? null,
          priority: args.priority as TaskPriority | undefined,
          project: args.project ?? null,
        });
        return toolText({ id: row.id, title: row.title, status: row.status });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete task",
      description:
        "Marca a tarefa como concluída (status='done', completedAt=agora). Use depois que o usuário disser que terminou algo.",
      inputSchema: {
        id: z.string().uuid(),
      },
    },
    async (args) => {
      try {
        const row = await completeTask(ctx.workspaceId, ctx.ownerUserId, args.id);
        return toolText({ id: row.id, title: row.title, status: row.status });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
