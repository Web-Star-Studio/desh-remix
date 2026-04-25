import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { users, workspaces, workspaceMembers, agentProfiles } from "./schema/index";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const seedEmail = process.env.SEED_USER_EMAIL ?? "dev@desh.local";

const client = postgres(url, { max: 1 });
const db = drizzle(client);

const [user] = await db
  .insert(users)
  .values({ email: seedEmail, displayName: "Dev User" })
  .onConflictDoUpdate({
    target: users.email,
    set: { updatedAt: sql`now()` },
  })
  .returning();

if (!user) throw new Error("seed: failed to upsert user");

const [workspace] = await db
  .insert(workspaces)
  .values({ name: "Personal", slug: "dev", createdBy: user.id })
  .onConflictDoUpdate({
    target: workspaces.slug,
    set: { updatedAt: sql`now()` },
  })
  .returning();

if (!workspace) throw new Error("seed: failed to upsert workspace");

await db
  .insert(workspaceMembers)
  .values({ workspaceId: workspace.id, userId: user.id, role: "owner" })
  .onConflictDoNothing();

await db
  .insert(agentProfiles)
  .values({ workspaceId: workspace.id, displayName: "Default agent" })
  .onConflictDoNothing();

console.log(`seeded user=${user.id} workspace=${workspace.id}`);
await client.end();
