import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

// Read-side helpers for tests. The global setup creates the testcontainer
// and applies migrations once per process; tests just connect.
export function getTestSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set — global setup didn't run?");
  return postgres(url, { max: 2 });
}

export function getTestDb() {
  return drizzle(getTestSql());
}

// Truncate all data tables in dependency-safe order. Call from beforeEach
// when test isolation matters; cheaper than tearing down + re-migrating.
export async function resetData(): Promise<void> {
  const sql = getTestSql();
  try {
    await sql`
      truncate table
        contact_interactions,
        contacts,
        task_subtasks,
        tasks,
        files,
        agent_events,
        conversations,
        agent_profiles,
        composio_connections,
        workspace_credentials,
        workspace_members,
        workspaces,
        users
      restart identity cascade
    `;
  } finally {
    await sql.end({ timeout: 2 });
  }
}
