import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { workspaceMembers, workspaces, users } from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("tasks routes", () => {
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
    const email = `t-${Date.now()}@desh.test`;

    // Mirror what ensureUser() does on first auth: create user + default
    // workspace + owner membership. Done directly in the DB so the test
    // doesn't depend on any other route's implementation.
    const [user] = await db
      .insert(users)
      .values({ cognitoSub: subjectId, email })
      .returning();
    userId = user!.id;

    const [ws] = await db
      .insert(workspaces)
      .values({ name: "Personal", createdBy: userId, isDefault: true })
      .returning();
    workspaceId = ws!.id;

    await db.insert(workspaceMembers).values({
      workspaceId,
      userId,
      role: "owner",
    });

    token = await signTestToken({ sub: subjectId, email });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/tasks`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("lists empty for a fresh workspace", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/tasks`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("creates → lists → patches → deletes a task", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/tasks`,
      headers: authHeader(token),
      payload: { title: "Buy milk", priority: "high" },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json();
    expect(created.title).toBe("Buy milk");
    expect(created.priority).toBe("high");
    expect(created.status).toBe("todo");
    expect(created.subtasks).toEqual([]);

    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/tasks`,
      headers: authHeader(token),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);

    const patch = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/tasks/${created.id}`,
      headers: authHeader(token),
      payload: { status: "done", completedAt: new Date().toISOString() },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().status).toBe("done");
    expect(patch.json().completedAt).not.toBeNull();

    const del = await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/tasks/${created.id}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(204);

    const after = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/tasks`,
      headers: authHeader(token),
    });
    expect(after.json()).toEqual([]);
  });

  it("manages subtasks under a task", async () => {
    const t = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/tasks`,
      headers: authHeader(token),
      payload: { title: "Plan trip" },
    });
    const taskId = t.json().id;

    const sub = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/tasks/${taskId}/subtasks`,
      headers: authHeader(token),
      payload: { title: "Book flights" },
    });
    expect(sub.statusCode).toBe(201);
    const subId = sub.json().id;

    const upd = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/tasks/${taskId}/subtasks/${subId}`,
      headers: authHeader(token),
      payload: { completed: true },
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().completed).toBe(true);

    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/tasks`,
      headers: authHeader(token),
    });
    expect(list.json()[0].subtasks).toHaveLength(1);
    expect(list.json()[0].subtasks[0].completed).toBe(true);

    const del = await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/tasks/${taskId}/subtasks/${subId}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(204);
  });

  it("blocks non-members (404, not 403, to avoid leaking workspace existence)", async () => {
    // Spin up a second workspace owned by someone else; current user has no
    // membership row, so they should see a 404 — same shape as a missing ID.
    const db = getTestDb();
    const otherSubject = crypto.randomUUID();
    const [otherUser] = await db
      .insert(users)
      .values({ cognitoSub: otherSubject, email: `o-${Date.now()}@desh.test` })
      .returning();
    const [otherWs] = await db
      .insert(workspaces)
      .values({ name: "Other", createdBy: otherUser!.id })
      .returning();

    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${otherWs!.id}/tasks`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(404);
  });
});
