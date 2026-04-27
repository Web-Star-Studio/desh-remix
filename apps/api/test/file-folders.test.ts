import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  fileFolders,
  files as filesTable,
  workspaceMembers,
  workspaces,
  users,
} from "@desh/database/schema";
import { eq } from "drizzle-orm";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("file-folders routes", () => {
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
    const email = `ff-${Date.now()}@desh.test`;
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
      url: `/workspaces/${workspaceId}/file-folders`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("CRUD round-trip + nested parent + cross-workspace parent rejected", async () => {
    // Create root folder.
    const rootRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/file-folders`,
      headers: authHeader(token),
      payload: { name: "Documentos", color: "#ff0000", icon: "file" },
    });
    expect(rootRes.statusCode).toBe(201);
    const root = rootRes.json();
    expect(root.parentId).toBeNull();

    // Nested child.
    const childRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/file-folders`,
      headers: authHeader(token),
      payload: { name: "Contratos", parentId: root.id },
    });
    expect(childRes.statusCode).toBe(201);
    const child = childRes.json();
    expect(child.parentId).toBe(root.id);

    // List sees both.
    const listRes = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/file-folders`,
      headers: authHeader(token),
    });
    expect(listRes.json()).toHaveLength(2);

    // Patch (rename + reparent to root).
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/file-folders/${child.id}`,
      headers: authHeader(token),
      payload: { name: "Contratos 2024", parentId: null },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().name).toBe("Contratos 2024");
    expect(patchRes.json().parentId).toBeNull();

    // Cross-workspace parent: insert a folder in another workspace, then try
    // to reparent into it. Should 404.
    const db = getTestDb();
    const [otherUser] = await db
      .insert(users)
      .values({ cognitoSub: crypto.randomUUID(), email: `o2-${Date.now()}@desh.test` })
      .returning();
    const [otherWs] = await db
      .insert(workspaces)
      .values({ name: "Other", createdBy: otherUser!.id })
      .returning();
    const [otherFolder] = await db
      .insert(fileFolders)
      .values({ workspaceId: otherWs!.id, name: "Foreign" })
      .returning();
    const xWsRes = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/file-folders/${child.id}`,
      headers: authHeader(token),
      payload: { parentId: otherFolder!.id },
    });
    expect(xWsRes.statusCode).toBe(404);

    // Self-parent rejected with 400.
    const selfRes = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/file-folders/${child.id}`,
      headers: authHeader(token),
      payload: { parentId: child.id },
    });
    expect(selfRes.statusCode).toBe(400);
    expect(selfRes.json().error).toBe("self_parent");

    // Delete the root: child should survive (parent set to null), files in
    // root would be moved to root level (we don't have files in this test).
    const delRes = await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/file-folders/${root.id}`,
      headers: authHeader(token),
    });
    expect(delRes.statusCode).toBe(204);

    const after = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/file-folders`,
      headers: authHeader(token),
    });
    expect(after.json()).toHaveLength(1);
    expect(after.json()[0].parentId).toBeNull();
  });

  it("file folderId filter: ?folderId=root selects unfiled, UUID selects that folder", async () => {
    const db = getTestDb();
    const [folder] = await db
      .insert(fileFolders)
      .values({ workspaceId, name: "Project A" })
      .returning();
    await db.insert(filesTable).values([
      {
        workspaceId,
        uploadedBy: userId,
        folderId: folder!.id,
        storageKey: `workspaces/${workspaceId}/files/aa/in-folder.txt`,
        name: "in-folder.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        category: "file",
      },
      {
        workspaceId,
        uploadedBy: userId,
        storageKey: `workspaces/${workspaceId}/files/bb/at-root.txt`,
        name: "at-root.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        category: "file",
      },
    ]);

    const root = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files?folderId=root`,
      headers: authHeader(token),
    });
    expect(root.json()).toHaveLength(1);
    expect(root.json()[0].name).toBe("at-root.txt");

    const inFolder = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files?folderId=${folder!.id}`,
      headers: authHeader(token),
    });
    expect(inFolder.json()).toHaveLength(1);
    expect(inFolder.json()[0].name).toBe("in-folder.txt");
  });

  it("deleting a folder nulls folderId on its files (set null FK rule)", async () => {
    const db = getTestDb();
    const [folder] = await db
      .insert(fileFolders)
      .values({ workspaceId, name: "Temp" })
      .returning();
    const [file] = await db
      .insert(filesTable)
      .values({
        workspaceId,
        uploadedBy: userId,
        folderId: folder!.id,
        storageKey: `workspaces/${workspaceId}/files/tmp/tmp.txt`,
        name: "tmp.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        category: "file",
      })
      .returning();

    await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/file-folders/${folder!.id}`,
      headers: authHeader(token),
    });

    const [reloaded] = await db
      .select()
      .from(filesTable)
      .where(eq(filesTable.id, file!.id));
    expect(reloaded!.folderId).toBeNull();
    expect(reloaded!.isTrashed).toBe(false);
  });
});
