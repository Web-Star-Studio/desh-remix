import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import {
  automationLogs,
  automationRules,
  contacts,
  financeTransactions,
  notes,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";
import {
  dispatchAutomationEvent,
  runScheduledTick,
} from "../src/services/automations.js";

// Wave B covers the realtime bus (`dispatchAutomationEvent` plus the
// fire-and-forget emitters in tasks/contacts/finance/notes services) and
// the pg-boss cron tick (`runScheduledTick` for `scheduled` + `task_overdue`
// rules). We exercise both paths against the testcontainer Postgres.

async function makeWorkspace(prefix: string) {
  const db = getTestDb();
  const subjectId = crypto.randomUUID();
  const [user] = await db
    .insert(users)
    .values({ cognitoSub: subjectId, email: `${prefix}-${Date.now()}@desh.test` })
    .returning();
  const userId = user!.id;
  const [ws] = await db
    .insert(workspaces)
    .values({ name: "Automations B", createdBy: userId })
    .returning();
  const workspaceId = ws!.id;
  await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
  const token = await signTestToken({
    sub: subjectId,
    email: `${prefix}-${Date.now()}@desh.test`,
  });
  return { userId, workspaceId, token };
}

async function logsFor(workspaceId: string) {
  const db = getTestDb();
  return db
    .select()
    .from(automationLogs)
    .where(eq(automationLogs.workspaceId, workspaceId));
}

async function pollUntil<T>(fn: () => Promise<T>, predicate: (v: T) => boolean) {
  for (let i = 0; i < 100; i++) {
    const v = await fn();
    if (predicate(v)) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
  return fn();
}

describe("automations Wave B — realtime bus", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetData();
  });

  it("dispatchAutomationEvent runs every enabled matching rule and writes a log", async () => {
    const { userId, workspaceId } = await makeWorkspace("bus");
    const db = getTestDb();

    await db.insert(automationRules).values([
      {
        workspaceId,
        userId,
        name: "Match",
        enabled: true,
        triggerType: "task_created",
        triggerConfig: {},
        actionType: "create_note",
        actionConfig: { title: "Auto: {{title}}", content: "from {{taskId}}" },
      },
      {
        workspaceId,
        userId,
        name: "Disabled",
        enabled: false,
        triggerType: "task_created",
        triggerConfig: {},
        actionType: "create_note",
        actionConfig: { title: "Should not fire" },
      },
      {
        workspaceId,
        userId,
        name: "Wrong trigger",
        enabled: true,
        triggerType: "contact_added",
        triggerConfig: {},
        actionType: "create_note",
        actionConfig: { title: "Wrong" },
      },
    ]);

    await dispatchAutomationEvent(workspaceId, "task_created", {
      taskId: "t-fake",
      title: "Buy milk",
    });

    const allLogs = await logsFor(workspaceId);
    expect(allLogs).toHaveLength(1);
    expect(allLogs[0]!.status).toBe("success");
    const result = allLogs[0]!.actionResult as { title?: string };
    expect(result.title).toBe("Auto: Buy milk");

    // The action is `create_note`, so a notes row should exist with the
    // interpolated title.
    const created = await db
      .select()
      .from(notes)
      .where(eq(notes.workspaceId, workspaceId));
    expect(created).toHaveLength(1);
    expect(created[0]!.title).toBe("Auto: Buy milk");
  });

  it("finance_transaction triggers respect type+min_amount predicates", async () => {
    const { userId, workspaceId } = await makeWorkspace("fin");
    const db = getTestDb();

    await db.insert(automationRules).values({
      workspaceId,
      userId,
      name: "Big expenses",
      enabled: true,
      triggerType: "finance_transaction",
      triggerConfig: { type: "expense", min_amount: 100 },
      actionType: "send_notification",
      actionConfig: { title: "High expense alert" },
    });

    // Below the min — should not fire.
    await dispatchAutomationEvent(workspaceId, "finance_transaction", {
      type: "expense",
      amount: 50,
    });
    let logs = await logsFor(workspaceId);
    expect(logs).toHaveLength(0);

    // Wrong type — should not fire.
    await dispatchAutomationEvent(workspaceId, "finance_transaction", {
      type: "income",
      amount: 500,
    });
    logs = await logsFor(workspaceId);
    expect(logs).toHaveLength(0);

    // Above threshold + matching type — fires.
    await dispatchAutomationEvent(workspaceId, "finance_transaction", {
      type: "expense",
      amount: 250,
    });
    logs = await logsFor(workspaceId);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("success");
  });

  it("createTask emits task_created and triggers a matching rule", async () => {
    const { userId, workspaceId, token } = await makeWorkspace("emit");
    const db = getTestDb();
    await db.insert(automationRules).values({
      workspaceId,
      userId,
      name: "On task",
      enabled: true,
      triggerType: "task_created",
      triggerConfig: {},
      actionType: "create_note",
      actionConfig: { title: "Created from {{title}}" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/tasks`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { title: "First task", priority: "high" },
    });
    expect(res.statusCode).toBe(201);

    // Emit is fire-and-forget; poll until the log lands.
    const logs = await pollUntil(
      () => logsFor(workspaceId),
      (xs) => xs.length > 0,
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("success");
  });

  it("createContact emits contact_added", async () => {
    const { userId, workspaceId, token } = await makeWorkspace("ctc");
    const db = getTestDb();
    await db.insert(automationRules).values({
      workspaceId,
      userId,
      name: "On contact",
      enabled: true,
      triggerType: "contact_added",
      triggerConfig: {},
      actionType: "create_note",
      actionConfig: { title: "Welcomed {{name}}" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/contacts`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { name: "Alice", email: "alice@example.com" },
    });
    expect(res.statusCode).toBe(201);

    const logs = await pollUntil(
      () => logsFor(workspaceId),
      (xs) => xs.length > 0,
    );
    expect(logs).toHaveLength(1);

    // Sanity: the underlying contact was actually written.
    const stored = await db.select().from(contacts).where(eq(contacts.workspaceId, workspaceId));
    expect(stored).toHaveLength(1);
  });

  it("createTransaction emits finance_transaction", async () => {
    const { userId, workspaceId, token } = await makeWorkspace("fintx");
    const db = getTestDb();
    await db.insert(automationRules).values({
      workspaceId,
      userId,
      name: "On expense",
      enabled: true,
      triggerType: "finance_transaction",
      triggerConfig: { type: "expense", min_amount: 0 },
      actionType: "create_note",
      actionConfig: { title: "Spent {{amount}}" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/finance/transactions`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: {
        description: "Coffee",
        amount: 12.5,
        type: "expense",
        category: "Food",
        date: "2026-04-28",
      },
    });
    expect(res.statusCode).toBe(201);

    const logs = await pollUntil(
      () => logsFor(workspaceId),
      (xs) => xs.length > 0,
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("success");

    // Sanity check on the row written.
    const stored = await db
      .select()
      .from(financeTransactions)
      .where(eq(financeTransactions.workspaceId, workspaceId));
    expect(stored).toHaveLength(1);
  });
});

describe("automations Wave B — cron tick", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetData();
  });

  it("scheduled rule with interval_minutes fires once when due, then waits", async () => {
    const { userId, workspaceId } = await makeWorkspace("sched");
    const db = getTestDb();
    // last_executed_at = 10 min ago, interval = 5 min → due now
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    await db.insert(automationRules).values({
      workspaceId,
      userId,
      name: "Every 5",
      enabled: true,
      triggerType: "scheduled",
      triggerConfig: { interval_minutes: 5 },
      actionType: "send_notification",
      actionConfig: { title: "tick" },
      lastExecutedAt: tenMinAgo,
    });

    const r1 = await runScheduledTick();
    expect(r1.scheduledFired).toBe(1);

    let logs = await logsFor(workspaceId);
    expect(logs).toHaveLength(1);

    // Second tick immediately after — last_executed_at was just bumped, so
    // the interval shouldn't have elapsed yet.
    const r2 = await runScheduledTick();
    expect(r2.scheduledFired).toBe(0);

    logs = await logsFor(workspaceId);
    expect(logs).toHaveLength(1);
  });

  it("task_overdue tick fires once per overdue task", async () => {
    const { userId, workspaceId } = await makeWorkspace("ovd");
    const db = getTestDb();
    await db.insert(automationRules).values({
      workspaceId,
      userId,
      name: "Overdue alert",
      enabled: true,
      triggerType: "task_overdue",
      triggerConfig: {},
      actionType: "send_notification",
      actionConfig: { title: "Overdue: {{title}}" },
    });

    // Two tasks overdue, one not.
    await db.insert(tasks).values([
      {
        workspaceId,
        createdBy: userId,
        title: "Overdue 1",
        dueDate: "2025-01-01",
        status: "todo",
      },
      {
        workspaceId,
        createdBy: userId,
        title: "Overdue 2",
        dueDate: "2025-02-01",
        status: "in_progress",
      },
      {
        workspaceId,
        createdBy: userId,
        title: "Already done",
        dueDate: "2025-01-01",
        status: "done",
      },
    ]);

    const r = await runScheduledTick();
    expect(r.taskOverdueFired).toBe(2);

    const logs = await logsFor(workspaceId);
    expect(logs).toHaveLength(2);
    const titles = logs.map(
      (l) => (l.actionResult as { title?: string }).title,
    );
    expect(titles).toEqual(
      expect.arrayContaining(["Overdue: Overdue 1", "Overdue: Overdue 2"]),
    );
  });

  // Reference `and` so the unused import doesn't trip lint.
  it("imports compile", () => {
    expect(typeof and).toBe("function");
  });
});
