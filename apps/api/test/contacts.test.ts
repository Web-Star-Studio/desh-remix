import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { workspaceMembers, workspaces, users } from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("contacts routes", () => {
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
    const email = `c-${Date.now()}@desh.test`;

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
      url: `/workspaces/${workspaceId}/contacts`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates → lists → patches → deletes a contact", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/contacts`,
      headers: authHeader(token),
      payload: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        tags: ["mentor", "math"],
        favorited: true,
      },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json();
    expect(created.name).toBe("Ada Lovelace");
    expect(created.tags).toEqual(["mentor", "math"]);
    expect(created.favorited).toBe(true);

    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/contacts`,
      headers: authHeader(token),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
    expect(list.json()[0].interactions).toEqual([]);

    const patch = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/contacts/${created.id}`,
      headers: authHeader(token),
      payload: { company: "Analytical Engine Co.", favorited: false },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().company).toBe("Analytical Engine Co.");
    expect(patch.json().favorited).toBe(false);

    const del = await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/contacts/${created.id}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(204);
  });

  it("rejects invalid email on create", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/contacts`,
      headers: authHeader(token),
      payload: { name: "Bad", email: "not-an-email" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });

  it("manages interactions under a contact", async () => {
    const c = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/contacts`,
      headers: authHeader(token),
      payload: { name: "Grace Hopper" },
    });
    const contactId = c.json().id;

    const i1 = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/contacts/${contactId}/interactions`,
      headers: authHeader(token),
      payload: { type: "call", title: "Discussed COBOL roadmap" },
    });
    expect(i1.statusCode).toBe(201);
    const i1Id = i1.json().id;

    const upd = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/contacts/${contactId}/interactions/${i1Id}`,
      headers: authHeader(token),
      payload: { description: "Action items: 1. ANSI standard, 2. testing" },
    });
    expect(upd.statusCode).toBe(200);
    expect(upd.json().description).toContain("ANSI");

    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/contacts`,
      headers: authHeader(token),
    });
    expect(list.json()[0].interactions).toHaveLength(1);
    expect(list.json()[0].interactions[0].type).toBe("call");

    const del = await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/contacts/${contactId}/interactions/${i1Id}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(204);
  });

  it("blocks non-members (404)", async () => {
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
      url: `/workspaces/${otherWs!.id}/contacts`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("orders favorites before non-favorites", async () => {
    await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/contacts`,
      headers: authHeader(token),
      payload: { name: "Bob", favorited: false },
    });
    await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/contacts`,
      headers: authHeader(token),
      payload: { name: "Alice", favorited: true },
    });
    await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/contacts`,
      headers: authHeader(token),
      payload: { name: "Carol", favorited: false },
    });

    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/contacts`,
      headers: authHeader(token),
    });
    const names = res.json().map((c: { name: string }) => c.name);
    expect(names[0]).toBe("Alice"); // favorited first
    expect(names.slice(1).sort()).toEqual(["Bob", "Carol"]); // alphabetical among non-favs
  });
});
