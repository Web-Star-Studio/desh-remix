import { eq } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { users } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { allocatePort } from "./hermes/port-allocator.js";
import { generateSecret } from "./hermes/secret-generator.js";

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

export interface AgentProfileResources {
  hermesPort: number;
  adapterSecret: string;
  callbackSecret: string;
}

// Allocate Hermes-related resources without starting the gateway. Used by
// `POST /workspaces` when inserting an agent_profile row, so the supervisor
// can lazy-start the gateway on first message.
export async function provisionAgentProfileResources(): Promise<AgentProfileResources> {
  const hermesPort = await allocatePort();
  return {
    hermesPort,
    adapterSecret: generateSecret(),
    callbackSecret: generateSecret(),
  };
}

/**
 * Ensures the `users` row exists for a Cognito sub. ONLY writes the user row —
 * does NOT create a workspace, member, or agent_profile. Workspace creation is
 * the OnboardingWizard's job (explicit user choice).
 *
 * Idempotent on cognito_sub. If a different sub appears with the same email
 * (Cognito recreate), re-links the existing row to the new sub.
 */
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

  // The sub didn't match — but a row with the same email might still exist
  // (e.g. user deleted their Cognito account and re-signed up; Cognito gives
  // them a new sub but the local DB row is stale). Cognito enforces email
  // uniqueness at the pool level on verified addresses, so colliding on email
  // here means the same human, not impersonation. Re-link the row.
  const byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (byEmail[0]) {
    const [relinked] = await db
      .update(users)
      .set({ cognitoSub, updatedAt: new Date() })
      .where(eq(users.id, byEmail[0].id))
      .returning();
    if (relinked) return toResolved(relinked);
  }

  // First-time user. Insert ONLY the users row. Workspaces are created by the
  // OnboardingWizard via POST /workspaces.
  const [inserted] = await db
    .insert(users)
    .values({ cognitoSub, email, displayName: displayName ?? null })
    .returning();
  if (!inserted) throw new Error("ensureUser: failed to insert user");
  return toResolved(inserted);
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
