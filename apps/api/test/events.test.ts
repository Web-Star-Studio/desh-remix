import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  automationLogs,
  automationRules,
  events,
  users,
  workspaceMembers,
  workspaces,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

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
    .values({ name: "Calendar WS", createdBy: userId })
    .returning();
  const workspaceId = ws!.id;
  await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
  const token = await signTestToken({
    sub: subjectId,
    email: `${prefix}-${Date.now()}@desh.test`,
  });
  return { userId, workspaceId, token };
}

async function pollUntil<T>(fn: () => Promise<T>, predicate: (v: T) => boolean) {
  for (let i = 0; i < 100; i++) {
    const v = await fn();
    if (predicate(v)) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
  return fn();
}

describe("events routes", () => {
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

  it("rejects unauthenticated requests", async () => {
    const { workspaceId } = await makeWorkspace("auth");
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/events`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates and lists an event with category-derived color default", async () => {
    const { workspaceId, token } = await makeWorkspace("crud");

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/events`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: {
        label: "Reunião",
        day: 15,
        month: 4,
        year: 2026,
        category: "trabalho",
        recurrence: "weekly",
      },
    });
    expect(res.statusCode).toBe(201);
    const created = (res.json() as { event: { id: string; color: string } }).event;
    expect(created.color).toBe("bg-blue-500"); // trabalho → blue

    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/events`,
      headers: authHeader(token),
    });
    expect(list.statusCode).toBe(200);
    const listed = (list.json() as { events: unknown[] }).events;
    expect(listed).toHaveLength(1);
  });

  it("rejects events with invalid month and day per check constraints", async () => {
    const { workspaceId, token } = await makeWorkspace("inv");
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/events`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { label: "X", day: 32, month: 4, year: 2026 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("filters list by month range using fromYear/fromMonth", async () => {
    const { workspaceId, token } = await makeWorkspace("range");
    const db = getTestDb();
    await db.insert(events).values([
      { workspaceId, label: "March", day: 1, month: 2, year: 2026 },
      { workspaceId, label: "April", day: 1, month: 3, year: 2026 },
      { workspaceId, label: "May", day: 1, month: 4, year: 2026 },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/events?fromYear=2026&fromMonth=3&toYear=2026&toMonth=4`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    const list = (res.json() as { events: Array<{ label: string }> }).events;
    expect(list.map((e) => e.label).sort()).toEqual(["April", "May"]);
  });

  it("PATCH on a category change auto-refreshes color when not explicitly set", async () => {
    const { workspaceId, token } = await makeWorkspace("patch");
    const create = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/events`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { label: "Show", day: 5, month: 5, year: 2026, category: "lazer" },
    });
    const id = (create.json() as { event: { id: string } }).event.id;

    const res = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/events/${id}`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { category: "saúde" },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { event: { color: string } }).event.color).toBe("bg-rose-500");
  });

  it("DELETE returns 204 and removes the row", async () => {
    const { workspaceId, token } = await makeWorkspace("del");
    const create = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/events`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { label: "Tmp", day: 1, month: 0, year: 2026 },
    });
    const id = (create.json() as { event: { id: string } }).event.id;

    const del = await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/events/${id}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/events`,
      headers: authHeader(token),
    });
    expect((list.json() as { events: unknown[] }).events).toHaveLength(0);
  });

  it("non-member cannot create events in another workspace", async () => {
    const { workspaceId } = await makeWorkspace("ns");
    const otherSub = crypto.randomUUID();
    const db = getTestDb();
    await db.insert(users).values({ cognitoSub: otherSub, email: `o-${Date.now()}@desh.test` });
    const otherToken = await signTestToken({ sub: otherSub, email: `o-${Date.now()}@desh.test` });

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/events`,
      headers: { ...authHeader(otherToken), "content-type": "application/json" },
      payload: { label: "Sneaky", day: 1, month: 0, year: 2026 },
    });
    // assertWorkspaceMember surfaces 404 for non-members
    expect(res.statusCode).toBe(404);
  });
});

describe("events ↔ automations integration", () => {
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

  it("creating an event emits event_created and fires a matching rule", async () => {
    const { userId, workspaceId, token } = await makeWorkspace("emit");
    const db = getTestDb();
    await db.insert(automationRules).values({
      workspaceId,
      userId,
      name: "On event",
      enabled: true,
      triggerType: "event_created",
      triggerConfig: {},
      actionType: "create_note",
      actionConfig: { title: "Logged: {{label}}" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/events`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { label: "Standup", day: 10, month: 4, year: 2026, category: "trabalho" },
    });
    expect(res.statusCode).toBe(201);

    const logs = await pollUntil(
      () =>
        db.select().from(automationLogs).where(eq(automationLogs.workspaceId, workspaceId)),
      (xs) => xs.length > 0,
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("success");
    const result = logs[0]!.actionResult as { title?: string };
    expect(result.title).toBe("Logged: Standup");
  });

  it("create_event automation action writes a real events row", async () => {
    const { userId, workspaceId } = await makeWorkspace("act");
    const db = getTestDb();
    const [rule] = await db
      .insert(automationRules)
      .values({
        workspaceId,
        userId,
        name: "Daily standup",
        enabled: true,
        triggerType: "scheduled",
        triggerConfig: { interval_minutes: 60 },
        actionType: "create_event",
        actionConfig: {
          label: "Standup automático",
          category: "trabalho",
          time: "09:00",
          duration_minutes: 30,
          days_until: 0,
        },
      })
      .returning();

    // Trigger the action via the manual-run path (no need to wait for the
    // pg-boss tick — the dispatcher is identical).
    const { runRuleOnce } = await import("../src/services/automations.js");
    const result = await runRuleOnce(workspaceId, userId, rule!.id, { source: "test" });
    expect(result.status).toBe("success");
    const action = result.actionResult as { eventId?: string };
    expect(action.eventId).toBeTruthy();

    const stored = await db
      .select()
      .from(events)
      .where(eq(events.workspaceId, workspaceId));
    expect(stored).toHaveLength(1);
    expect(stored[0]!.label).toBe("Standup automático");
    expect(stored[0]!.category).toBe("trabalho");
    expect(stored[0]!.startAt).not.toBeNull();
  });
});
