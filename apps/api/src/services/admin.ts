import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { users } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";
import { requireUserDbId } from "./users.js";

// System-wide admin gate. Workspaces have member roles (owner/member); admin
// here means "this user can manage system-level resources" — email templates,
// email automations, broadcasts. Stored as a boolean column on `users`,
// flipped manually via SQL for now (no self-service promotion).
export async function isAdmin(userDbId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userDbId))
    .limit(1);
  return row?.isAdmin ?? false;
}

export async function requireAdmin(req: FastifyRequest): Promise<string> {
  const dbId = await requireUserDbId(req);
  if (!(await isAdmin(dbId))) throw new ServiceError(403, "admin_required");
  return dbId;
}
