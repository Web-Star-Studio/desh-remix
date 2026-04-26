import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { agentProfiles, users, workspaceMembers, workspaces } from "@desh/database/schema";
import { getDb } from "../db/client.js";

export interface ResolvedUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    dbUser?: ResolvedUser;
  }
}

// Provisions the users row on first sight of a Cognito sub, plus a default
// workspace (with owner-membership and an agent_profile). Idempotent — safe
// to call on every request.
export async function ensureUser(
  cognitoSub: string,
  email: string,
  displayName?: string,
): Promise<ResolvedUser> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL not configured");

  const existing = await db.select().from(users).where(eq(users.cognitoSub, cognitoSub)).limit(1);
  if (existing[0]) {
    return toResolved(existing[0]);
  }

  // First-sight: create user + default workspace + owner membership + agent_profile.
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ cognitoSub, email, displayName: displayName ?? null })
      .returning();
    if (!user) throw new Error("ensureUser: failed to insert user");

    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name: "Personal",
        createdBy: user.id,
        isDefault: true,
      })
      .returning();
    if (!workspace) throw new Error("ensureUser: failed to insert workspace");

    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
    });

    await tx.insert(agentProfiles).values({
      workspaceId: workspace.id,
      displayName: "Default agent",
    });

    return toResolved(user);
  });
}

export async function requireUserDbId(req: FastifyRequest): Promise<string> {
  if (!req.user) {
    throw req.server.httpErrors.unauthorized();
  }
  if (req.dbUser) return req.dbUser.id;
  if (!req.user.email) {
    throw req.server.httpErrors.unauthorized("token missing email claim");
  }
  const resolved = await ensureUser(req.user.id, req.user.email);
  req.dbUser = resolved;
  return resolved.id;
}

function toResolved(row: typeof users.$inferSelect): ResolvedUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    onboardingCompleted: row.onboardingCompleted,
  };
}
