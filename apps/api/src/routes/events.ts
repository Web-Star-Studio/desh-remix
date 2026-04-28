import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from "../services/events.js";
import { requireUserDbId } from "../services/users.js";
import { isServiceError } from "../services/errors.js";

const WorkspaceParams = z.object({ workspaceId: z.string().uuid() });
const EventParams = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid(),
});

const Category = z.enum(["trabalho", "pessoal", "saúde", "educação", "lazer", "outro"]);
const Recurrence = z.enum(["none", "daily", "weekly", "monthly"]);

const ListQuery = z.object({
  fromYear: z.coerce.number().int().min(1900).max(2200).optional(),
  fromMonth: z.coerce.number().int().min(0).max(11).optional(),
  toYear: z.coerce.number().int().min(1900).max(2200).optional(),
  toMonth: z.coerce.number().int().min(0).max(11).optional(),
});

const CreateBody = z.object({
  label: z.string().min(1).max(500),
  day: z.number().int().min(1).max(31),
  month: z.number().int().min(0).max(11),
  year: z.number().int().min(1900).max(2200),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  category: Category.optional(),
  recurrence: Recurrence.optional(),
  color: z.string().max(60).optional(),
  location: z.string().max(500).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
});

const PatchBody = CreateBody.partial();

function handleServiceError(reply: FastifyReply, err: unknown): boolean {
  if (isServiceError(err)) {
    reply.code(err.httpStatus).send({ error: err.errorCode });
    return true;
  }
  return false;
}

export default async function eventsRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/events", async (req, reply) => {
    await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const query = ListQuery.safeParse(req.query);
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_query", details: query.error.flatten() });
    }
    try {
      const list = await listEvents(params.data.workspaceId, query.data);
      return { events: list };
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.get("/workspaces/:workspaceId/events/:id", async (req, reply) => {
    await requireUserDbId(req);
    const params = EventParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      const ev = await getEvent(params.data.workspaceId, params.data.id);
      if (!ev) return reply.code(404).send({ error: "event_not_found" });
      return { event: ev };
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.post("/workspaces/:workspaceId/events", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = WorkspaceParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = CreateBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      const event = await createEvent(params.data.workspaceId, dbId, body.data);
      return reply.code(201).send({ event });
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.patch("/workspaces/:workspaceId/events/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = EventParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    const body = PatchBody.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_body", details: body.error.flatten() });
    }
    try {
      const event = await updateEvent(
        params.data.workspaceId,
        dbId,
        params.data.id,
        body.data,
      );
      return { event };
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });

  app.delete("/workspaces/:workspaceId/events/:id", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const params = EventParams.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: "invalid_params" });
    try {
      await deleteEvent(params.data.workspaceId, dbId, params.data.id);
      return reply.code(204).send();
    } catch (err) {
      if (!handleServiceError(reply, err)) throw err;
    }
  });
}
