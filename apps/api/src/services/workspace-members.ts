import { and, eq } from "drizzle-orm";
import { workspaceMembers } from "@desh/database/schema";
import { getDb } from "../db/client.js";
import { ServiceError } from "./errors.js";

// Centralized membership + role lookups. Routes use these for auth gating;
// the MCP layer uses them to resolve the workspace owner identity used as
// the actor for tool-driven mutations.

export async function isWorkspaceMember(workspaceId: string, userDbId: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userDbId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function getWorkspaceMemberRole(
  workspaceId: string,
  userDbId: string,
): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userDbId),
      ),
    )
    .limit(1);
  return row?.role ?? null;
}

// Returns the user_id of the workspace's owner. Used by the MCP layer to
// pick the actor for agent-driven mutations (created_by attribution etc.)
// when there's no Cognito session in the request. Throws if no owner row
// exists — that's a data-integrity issue worth surfacing rather than
// silently picking an arbitrary member.
export async function getWorkspaceOwnerId(workspaceId: string): Promise<string> {
  const db = getDb();
  if (!db) throw new ServiceError(503, "db_unavailable");
  const [row] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.role, "owner"),
      ),
    )
    .limit(1);
  if (!row) throw new ServiceError(404, "workspace_owner_not_found");
  return row.userId;
}

// Asserts the user is a member; throws ServiceError(404) otherwise (privacy
// by obscurity — looks the same as a non-existent workspace).
export async function assertWorkspaceMember(
  workspaceId: string,
  userDbId: string,
): Promise<void> {
  const ok = await isWorkspaceMember(workspaceId, userDbId);
  if (!ok) throw new ServiceError(404, "not_found");
}
