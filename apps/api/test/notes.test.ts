import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  notes as notesTable,
  workspaceMembers,
  workspaces,
  users,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("notes routes", () => {
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
    const email = `n-${Date.now()}@desh.test`;
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
    await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
    token = await signTestToken({ sub: subjectId, email });
  });

  it("rejects unauthenticated", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/notes`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("create → list → patch → search → trash → restore → permanent-delete", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/notes`,
      headers: authHeader(token),
      payload: {
        title: "Engine notes",
        content: "<p>Analytical engine</p>",
        tags: ["math", "engine"],
        notebook: "Research",
        pinned: true,
      },
    });
    expect(create.statusCode).toBe(201);
    const note = create.json();
    expect(note.title).toBe("Engine notes");
    expect(note.tags).toEqual(["math", "engine"]);
    expect(note.pinned).toBe(true);
    expect(note.deletedAt).toBeNull();

    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/notes`,
      headers: authHeader(token),
    });
    expect(list.json()).toHaveLength(1);

    const patch = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/notes/${note.id}`,
      headers: authHeader(token),
      payload: { content: "<p>Updated</p>", favorited: true },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().content).toBe("<p>Updated</p>");
    expect(patch.json().favorited).toBe(true);

    const search = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/notes?search=engine`,
      headers: authHeader(token),
    });
    expect(search.json()).toHaveLength(1);

    const searchByTag = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/notes?search=math`,
      headers: authHeader(token),
    });
    expect(searchByTag.json()).toHaveLength(1);

    const trash = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/notes/trash`,
      headers: authHeader(token),
      payload: { noteIds: [note.id] },
    });
    expect(trash.json().trashed).toBe(1);

    const activeAfterTrash = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/notes`,
      headers: authHeader(token),
    });
    expect(activeAfterTrash.json()).toHaveLength(0);

    const trashedView = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/notes?trashed=true`,
      headers: authHeader(token),
    });
    expect(trashedView.json()).toHaveLength(1);
    expect(trashedView.json()[0].deletedAt).not.toBeNull();

    const restore = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/notes/restore`,
      headers: authHeader(token),
      payload: { noteIds: [note.id] },
    });
    expect(restore.json().restored).toBe(1);

    const del = await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/notes/${note.id}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(204);

    const final = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/notes`,
      headers: authHeader(token),
    });
    expect(final.json()).toHaveLength(0);
  });

  it("bulk patch: pin + tag-add + notebook across N notes", async () => {
    const db = getTestDb();
    const inserted = await db
      .insert(notesTable)
      .values([
        { workspaceId, createdBy: userId, title: "A", tags: ["x"] },
        { workspaceId, createdBy: userId, title: "B", tags: ["y"] },
        { workspaceId, createdBy: userId, title: "C", tags: [] },
      ])
      .returning();

    const ids = inserted.map((n) => n.id);
    const bulk = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/notes/bulk`,
      headers: authHeader(token),
      payload: {
        noteIds: ids,
        pinned: true,
        notebook: "Bulk",
        addTags: ["urgent"],
      },
    });
    expect(bulk.statusCode).toBe(200);
    const updated = bulk.json();
    expect(updated).toHaveLength(3);
    for (const u of updated) {
      expect(u.pinned).toBe(true);
      expect(u.notebook).toBe("Bulk");
      expect(u.tags).toContain("urgent");
    }
    // Existing tags survived the merge.
    const aPostBulk = updated.find((n: { title: string }) => n.title === "A");
    expect(aPostBulk.tags).toEqual(expect.arrayContaining(["x", "urgent"]));
  });

  it("notebooks endpoint returns distinct non-empty values", async () => {
    const db = getTestDb();
    await db.insert(notesTable).values([
      { workspaceId, createdBy: userId, title: "n1", notebook: "Work" },
      { workspaceId, createdBy: userId, title: "n2", notebook: "Work" },
      { workspaceId, createdBy: userId, title: "n3", notebook: "Personal" },
      { workspaceId, createdBy: userId, title: "n4", notebook: "" },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/notes/notebooks`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(["Personal", "Work"]);
  });

  it("empty trash deletes all soft-deleted notes; active rows untouched", async () => {
    const db = getTestDb();
    const now = new Date();
    await db.insert(notesTable).values([
      { workspaceId, createdBy: userId, title: "active", deletedAt: null },
      { workspaceId, createdBy: userId, title: "trashed-1", deletedAt: now },
      { workspaceId, createdBy: userId, title: "trashed-2", deletedAt: now },
    ]);

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/notes/trash/empty`,
      headers: authHeader(token),
    });
    expect(res.json().deleted).toBe(2);

    const remaining = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.workspaceId, workspaceId));
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.title).toBe("active");
  });

  it("isolates notes between workspaces", async () => {
    const db = getTestDb();
    const [otherUser] = await db
      .insert(users)
      .values({ cognitoSub: crypto.randomUUID(), email: `o-${Date.now()}@desh.test` })
      .returning();
    const [otherWs] = await db
      .insert(workspaces)
      .values({ name: "Other", createdBy: otherUser!.id })
      .returning();
    await db
      .insert(notesTable)
      .values({ workspaceId: otherWs!.id, createdBy: otherUser!.id, title: "secret" });

    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${otherWs!.id}/notes`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("workspace cascade: deleting the workspace also removes its notes", async () => {
    const db = getTestDb();
    await db.insert(notesTable).values({
      workspaceId,
      createdBy: userId,
      title: "x",
    });
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    const remaining = await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.workspaceId, workspaceId));
    expect(remaining).toHaveLength(0);
  });
});
