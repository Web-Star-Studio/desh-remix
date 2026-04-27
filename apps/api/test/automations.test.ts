import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  automationLogs,
  automationRules,
  notes,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("automations routes", () => {
  let app: FastifyInstance;
  let userId: string;
  let workspaceId: string;
  let token: string;

  beforeAll(async () => {
    app = await buildServer();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetData();
    const db = getTestDb();
    const subjectId = crypto.randomUUID();
    const [user] = await db
      .insert(users)
      .values({ cognitoSub: subjectId, email: `a-${Date.now()}@desh.test` })
      .returning();
    userId = user!.id;
    const [ws] = await db
      .insert(workspaces)
      .values({ name: "Automations Test", createdBy: userId })
      .returning();
    workspaceId = ws!.id;
    await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
    token = await signTestToken({ sub: subjectId, email: `a-${Date.now()}@desh.test` });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/automation-rules`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects non-members with 404", async () => {
    const db = getTestDb();
    const otherSub = crypto.randomUUID();
    const [other] = await db
      .insert(users)
      .values({ cognitoSub: otherSub, email: `o-${Date.now()}@desh.test` })
      .returning();
    const [otherWs] = await db
      .insert(workspaces)
      .values({ name: "Other", createdBy: other!.id })
      .returning();
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${otherWs!.id}/automation-rules`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("creates, lists, toggles, duplicates, and deletes a rule", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/automation-rules`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: {
        name: "Daily summary",
        enabled: true,
        trigger_type: "scheduled",
        trigger_config: { schedule_mode: "daily", hour: 9, minute: 0 },
        action_type: "create_note",
        action_config: { title: "Resumo {{date}}", content: "..." },
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = (createRes.json() as { rule: { id: string; enabled: boolean; user_id: string } }).rule;
    expect(created.user_id).toBe(userId);
    expect(created.enabled).toBe(true);

    // toggle off
    const toggleRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/automation-rules/${created.id}/toggle`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { enabled: false },
    });
    expect(toggleRes.statusCode).toBe(200);
    expect((toggleRes.json() as { rule: { enabled: boolean } }).rule.enabled).toBe(false);

    // duplicate (starts disabled)
    const dupRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/automation-rules/${created.id}/duplicate`,
      headers: authHeader(token),
    });
    expect(dupRes.statusCode).toBe(201);
    const dup = (dupRes.json() as { rule: { id: string; name: string; enabled: boolean } }).rule;
    expect(dup.id).not.toBe(created.id);
    expect(dup.name).toContain("(cópia)");
    expect(dup.enabled).toBe(false);

    // list returns both
    const listRes = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/automation-rules`,
      headers: authHeader(token),
    });
    expect(listRes.statusCode).toBe(200);
    expect((listRes.json() as { rules: unknown[] }).rules).toHaveLength(2);

    // delete the duplicate
    const delRes = await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/automation-rules/${dup.id}`,
      headers: authHeader(token),
    });
    expect(delRes.statusCode).toBe(204);
  });

  it("manual run for create_task: persists log + creates a task + bumps execution_count", async () => {
    const db = getTestDb();
    const [rule] = await db
      .insert(automationRules)
      .values({
        workspaceId,
        userId,
        name: "Auto-task",
        triggerType: "scheduled",
        triggerConfig: {},
        actionType: "create_task",
        actionConfig: { title: "Hello {{name}}", priority: "high", days_until_due: 1 },
      })
      .returning();
    const runRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/automation-rules/${rule!.id}/run`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { triggerData: { name: "Maria" } },
    });
    expect(runRes.statusCode).toBe(200);
    const result = runRes.json() as {
      status: "success" | "error";
      actionResult: { taskId: string; title: string };
    };
    expect(result.status).toBe("success");
    expect(result.actionResult.title).toBe("Hello Maria");

    const taskRows = await db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId));
    expect(taskRows).toHaveLength(1);
    expect(taskRows[0]!.title).toBe("Hello Maria");
    expect(taskRows[0]!.priority).toBe("high");
    expect(taskRows[0]!.dueDate).not.toBeNull();

    const logs = await db
      .select()
      .from(automationLogs)
      .where(eq(automationLogs.ruleId, rule!.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("success");

    const [updated] = await db
      .select({ executionCount: automationRules.executionCount, lastExecutedAt: automationRules.lastExecutedAt })
      .from(automationRules)
      .where(eq(automationRules.id, rule!.id));
    expect(updated!.executionCount).toBe(1);
    expect(updated!.lastExecutedAt).not.toBeNull();
  });

  it("manual run for create_note creates a note row", async () => {
    const db = getTestDb();
    const [rule] = await db
      .insert(automationRules)
      .values({
        workspaceId,
        userId,
        name: "Auto-note",
        triggerType: "scheduled",
        triggerConfig: {},
        actionType: "create_note",
        actionConfig: { title: "Daily {{date}}", content: "log" },
      })
      .returning();
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/automation-rules/${rule!.id}/run`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { triggerData: { date: "2026-04-27" } },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { status: string }).status).toBe("success");
    const noteRows = await db.select().from(notes).where(eq(notes.workspaceId, workspaceId));
    expect(noteRows).toHaveLength(1);
    expect(noteRows[0]!.title).toBe("Daily 2026-04-27");
  });

  it("manual run for an unsupported Wave A action logs error with the marker code", async () => {
    const db = getTestDb();
    const [rule] = await db
      .insert(automationRules)
      .values({
        workspaceId,
        userId,
        name: "Future feature",
        triggerType: "scheduled",
        triggerConfig: {},
        actionType: "send_whatsapp",
        actionConfig: { to: "+5511999887766", message: "hi" },
      })
      .returning();
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/automation-rules/${rule!.id}/run`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const result = res.json() as { status: string; actionResult: { code: string } };
    expect(result.status).toBe("error");
    expect(result.actionResult.code).toContain("not_implemented_in_wave_a");

    // execution_count stays at 0 — only successful runs increment.
    const [row] = await db
      .select({ executionCount: automationRules.executionCount })
      .from(automationRules)
      .where(eq(automationRules.id, rule!.id));
    expect(row!.executionCount).toBe(0);

    const logs = await db
      .select()
      .from(automationLogs)
      .where(eq(automationLogs.ruleId, rule!.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("error");
  });

  it("rejects rules with an unknown trigger_type at validation", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/automation-rules`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: {
        name: "bogus",
        enabled: true,
        trigger_type: "definitely_not_a_trigger",
        action_type: "create_task",
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
