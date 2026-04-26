import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";
import {
  sendNotification,
  type NotificationType,
} from "../services/email-notifications.js";
import { assertWorkspaceMember } from "../services/workspace-members.js";

const NotificationTypeEnum = z.enum(["task_reminder", "event_reminder", "archive_notice"]);

const SendBody = z.object({
  type: NotificationTypeEnum,
  data: z.record(z.unknown()).default({}),
  // When omitted, the notification targets the requesting user. When set, the
  // requesting user must be a member of the same workspace as the target user
  // (admin archive notice flow).
  targetUserId: z.string().uuid().optional(),
});

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function notificationsRoutes(app: FastifyInstance) {
  app.post("/workspaces/:workspaceId/notifications/send", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const parsed = SendBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    try {
      await assertWorkspaceMember(params.data.workspaceId, dbId);

      let userId = dbId;
      if (parsed.data.targetUserId && parsed.data.targetUserId !== dbId) {
        const db = getDb();
        if (!db) return reply.code(500).send({ error: "db_unavailable" });
        // Confirm target is a workspace member too — prevents a member of
        // workspace A from poking notifications at users in workspace B.
        const [member] = await db
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.userId, parsed.data.targetUserId))
          .limit(1);
        if (!member) return reply.code(404).send({ error: "target_not_found" });
        await assertWorkspaceMember(params.data.workspaceId, parsed.data.targetUserId);
        userId = parsed.data.targetUserId;
      }

      const result = await sendNotification({
        userId,
        type: parsed.data.type as NotificationType,
        data: parsed.data.data,
        workspaceId: params.data.workspaceId,
      });
      return result;
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
