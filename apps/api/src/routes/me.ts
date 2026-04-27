import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ensureUser, requireUserDbId } from "../services/users.js";
import { z } from "zod";

const PatchBody = z.object({
  displayName: z.string().min(1).max(120).optional(),
  avatarUrl: z.string().min(1).max(1_000_000).nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
});

export default async function meRoutes(app: FastifyInstance) {
  app.get("/me", async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: "unauthorized" });
    if (!req.user.email) return reply.code(401).send({ error: "missing_email_claim" });
    const me = await ensureUser(req.user.id, req.user.email);
    return me;
  });

  app.patch("/me", async (req, reply) => {
    const dbId = await requireUserDbId(req);
    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_body", details: parsed.error.flatten() });
    }
    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({ error: "empty_patch" });
    }

    const db = getDb();
    if (!db) return reply.code(500).send({ error: "db_unavailable" });

    const [updated] = await db
      .update(users)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(users.id, dbId))
      .returning();
    if (!updated) return reply.code(404).send({ error: "user_not_found" });

    if (req.dbUser) req.dbUser = { ...req.dbUser, ...patch };

    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      onboardingCompleted: updated.onboardingCompleted,
    };
  });
}
