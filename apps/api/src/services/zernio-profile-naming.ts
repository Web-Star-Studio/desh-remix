import { eq } from "drizzle-orm";
import { users, workspaces } from "@desh/database/schema";
import { getDb } from "../db/client.js";

/**
 * Builds the Zernio profile name + description for a workspace.
 *
 * The Zernio dashboard shows whatever `name` we pass to `POST /profiles`.
 * Workspace names alone collide constantly ("Principal", "Personal", "Work")
 * — without a user discriminator, an operator landing in the Zernio dashboard
 * has no way to find a specific user's profile. The name format encodes both
 * the user (email — natural human id, sortable, searchable in the Zernio
 * UI) and the workspace, with a short workspace-id suffix to disambiguate
 * users with multiple identically-named workspaces.
 *
 *   name        → "design@webstar.studio · Principal · #65b86ee5"
 *   description → "Desh workspace · workspace_id=… · user_id=… · user_email=…"
 *
 * Description carries machine-readable ids for support/debugging without
 * cluttering the visible label.
 */

export interface ZernioProfileMeta {
  name: string;
  description: string;
  /** Underlying values, surfaced for tests and call-site logging. */
  workspaceId: string;
  workspaceName: string;
  userEmail: string;
  userId: string;
}

/** Length cap that keeps us safely under most provider name limits. */
const MAX_NAME_LEN = 100;

function shortId(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 8);
}

function buildName(userEmail: string, workspaceName: string, workspaceId: string): string {
  const base = `${userEmail} · ${workspaceName} · #${shortId(workspaceId)}`;
  if (base.length <= MAX_NAME_LEN) return base;
  // Trim the workspace name first (it's the most variable part) — keep the
  // email prefix and short id intact since they're the discriminators an
  // operator searches by.
  const fixedTail = ` · #${shortId(workspaceId)}`;
  const fixedHead = `${userEmail} · `;
  const room = MAX_NAME_LEN - fixedHead.length - fixedTail.length;
  const trimmed = room > 0 ? workspaceName.slice(0, Math.max(1, room - 1)).trimEnd() + "…" : "…";
  return `${fixedHead}${trimmed}${fixedTail}`;
}

function buildDescription(meta: Omit<ZernioProfileMeta, "name" | "description">): string {
  return [
    `Desh workspace`,
    `workspace_id=${meta.workspaceId}`,
    `user_id=${meta.userId}`,
    `user_email=${meta.userEmail}`,
  ].join(" · ");
}

/**
 * Pulls the workspace + creator email out of the DB and returns the name +
 * description to use when calling Zernio's POST /profiles. Throws if either
 * the workspace or its creator can't be found — both should always exist
 * (FK constraint on workspaces.created_by guarantees the user row).
 */
export async function buildZernioProfileMeta(workspaceId: string): Promise<ZernioProfileMeta> {
  const db = getDb();
  if (!db) throw new Error("zernio-profile-naming: db_unavailable");
  const rows = await db
    .select({
      wsId: workspaces.id,
      wsName: workspaces.name,
      userId: users.id,
      userEmail: users.email,
    })
    .from(workspaces)
    .innerJoin(users, eq(users.id, workspaces.createdBy))
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error(`zernio-profile-naming: workspace ${workspaceId} not found`);
  }
  const base = {
    workspaceId: row.wsId,
    workspaceName: row.wsName,
    userId: row.userId,
    userEmail: row.userEmail,
  };
  return {
    ...base,
    name: buildName(row.userEmail, row.wsName, row.wsId),
    description: buildDescription(base),
  };
}

// Exposed for direct unit tests + for callers that already have the bits in
// scope and don't want a second DB roundtrip.
export const __testing__ = { buildName, buildDescription, shortId };
