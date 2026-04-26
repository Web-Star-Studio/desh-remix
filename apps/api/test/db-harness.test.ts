import { describe, expect, it } from "vitest";
import { getTestSql } from "./_helpers/db.js";

describe("test harness — shared testcontainer Postgres", () => {
  it("connects and runs select 1", async () => {
    const sql = getTestSql();
    try {
      const rows = await sql`select 1 as one`;
      expect(rows[0]).toEqual({ one: 1 });
    } finally {
      await sql.end({ timeout: 2 });
    }
  });

  it("applies migrations (8 PRD tables + tasks present)", async () => {
    const sql = getTestSql();
    try {
      const rows = await sql<{ tablename: string }[]>`
        select tablename from pg_tables
        where schemaname = 'public'
        order by tablename
      `;
      const names = rows.map((r) => r.tablename);
      for (const t of [
        "agent_events",
        "agent_profiles",
        "composio_connections",
        "conversations",
        "task_subtasks",
        "tasks",
        "users",
        "workspace_credentials",
        "workspace_members",
        "workspaces",
      ]) {
        expect(names).toContain(t);
      }
    } finally {
      await sql.end({ timeout: 2 });
    }
  });
});
