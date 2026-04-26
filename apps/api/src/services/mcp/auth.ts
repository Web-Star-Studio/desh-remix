import type { FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { agentProfiles } from "@desh/database/schema";
import { getDb } from "../../db/client.js";
import { env } from "../../config/env.js";
import { ServiceError } from "../errors.js";
import { getWorkspaceOwnerId } from "../workspace-members.js";

/**
 * Bearer-auth for the internal MCP endpoint. Hermes (per workspace) hits
 * `/internal/mcp/:workspaceId` with `Authorization: Bearer <secret>`. The
 * secret is the workspace's `agent_profiles.callback_secret` — same value
 * Hermes already gets as `SAAS_WEB_CALLBACK_KEY`, distributed via the
 * per-profile `.env` written by `services/hermes/profile-config.ts`.
 *
 * For dev simplicity we also accept `env.INTERNAL_CALLBACK_TOKEN` (matches
 * the `/internal/hermes/events` shared-token fallback). Both paths resolve
 * the same workspace owner, who is the actor for tool-driven mutations.
 */

export interface McpAuthContext {
  workspaceId: string;
  ownerUserId: string;
  profileId: string;
}

function extractBearer(req: FastifyRequest): string | null {
  const auth = req.headers["authorization"];
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  return token || null;
}

export async function verifyMcpBearer(
  req: FastifyRequest,
  workspaceId: string,
): Promise<McpAuthContext> {
  const token = extractBearer(req);
  if (!token) throw new ServiceError(401, "unauthorized");

  const db = getDb();
  if (!db) throw new ServiceError(503, "db_unavailable");

  const [profile] = await db
    .select({ id: agentProfiles.id, callbackSecret: agentProfiles.callbackSecret })
    .from(agentProfiles)
    .where(eq(agentProfiles.workspaceId, workspaceId))
    .limit(1);

  const matchesShared = !!env.INTERNAL_CALLBACK_TOKEN && token === env.INTERNAL_CALLBACK_TOKEN;
  const matchesProfile = !!profile?.callbackSecret && token === profile.callbackSecret;
  if (!matchesShared && !matchesProfile) {
    req.log.warn({ workspaceId }, "[mcp] auth failed");
    throw new ServiceError(401, "unauthorized");
  }
  if (!profile) {
    throw new ServiceError(404, "workspace_not_found");
  }

  // Resolve the actor identity for this MCP session. Tools execute as the
  // workspace owner; throws ServiceError(404, workspace_owner_not_found) if
  // the membership row is missing (data-integrity check).
  const ownerUserId = await getWorkspaceOwnerId(workspaceId);

  return { workspaceId, ownerUserId, profileId: profile.id };
}
