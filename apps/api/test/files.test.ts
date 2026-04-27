import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockClient } from "aws-sdk-client-mock";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import {
  files as filesTable,
  workspaceMembers,
  workspaces,
  users,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";
import { resetStorageClientForTests } from "../src/services/storage.js";

const s3Mock = mockClient(S3Client);

describe("files routes", () => {
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
    s3Mock.reset();
    resetStorageClientForTests();
    await resetData();
    const db = getTestDb();
    const subjectId = crypto.randomUUID();
    const email = `f-${Date.now()}@desh.test`;
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

  afterEach(() => {
    s3Mock.reset();
  });

  it("rejects unauthenticated upload-url requests", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/upload-url`,
      payload: { name: "x.txt", mimeType: "text/plain" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects non-members from listing", async () => {
    const db = getTestDb();
    const otherSubject = crypto.randomUUID();
    const [other] = await db
      .insert(users)
      .values({ cognitoSub: otherSubject, email: `o-${Date.now()}@desh.test` })
      .returning();
    const [otherWs] = await db
      .insert(workspaces)
      .values({ name: "Other", createdBy: other!.id })
      .returning();
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${otherWs!.id}/files`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns a presigned upload URL for a valid request", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/upload-url`,
      headers: authHeader(token),
      payload: { name: "hello.txt", mimeType: "text/plain", category: "file" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.uploadUrl).toContain("desh-test-bucket");
    expect(body.uploadUrl).toContain("X-Amz-Signature=");
    expect(body.storageKey).toMatch(
      new RegExp(`^workspaces/${workspaceId}/files/[0-9a-f-]{36}/hello\\.txt$`),
    );
    expect(body.expiresAt).toBeDefined();
  });

  it("confirm round-trips: upload-url → fake S3 PUT → confirm → list → download-url → delete", async () => {
    const uploadRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/upload-url`,
      headers: authHeader(token),
      payload: { name: "hello.txt", mimeType: "text/plain", category: "file" },
    });
    expect(uploadRes.statusCode).toBe(200);
    const { storageKey } = uploadRes.json();

    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 5 });

    const confirmRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/confirm`,
      headers: authHeader(token),
      payload: {
        storageKey,
        name: "hello.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
        category: "file",
      },
    });
    expect(confirmRes.statusCode).toBe(201);
    const confirmBody = confirmRes.json();
    expect(confirmBody.duplicate).toBe(false);
    expect(confirmBody.file).toMatchObject({
      workspaceId,
      uploadedBy: userId,
      storageKey,
      name: "hello.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      category: "file",
      isFavorite: false,
      isTrashed: false,
    });
    const file = confirmBody.file;

    const listRes = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files`,
      headers: authHeader(token),
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toHaveLength(1);

    const downloadRes = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files/${file.id}/download-url`,
      headers: authHeader(token),
    });
    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.json().url).toContain("desh-test-bucket");

    s3Mock.on(DeleteObjectCommand).resolves({});
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/workspaces/${workspaceId}/files/${file.id}`,
      headers: authHeader(token),
    });
    expect(deleteRes.statusCode).toBe(204);

    const afterDelete = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files`,
      headers: authHeader(token),
    });
    expect(afterDelete.json()).toHaveLength(0);
  });

  it("rejects confirm with mismatched workspace prefix in storage_key", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/confirm`,
      headers: authHeader(token),
      payload: {
        storageKey: "workspaces/some-other-uuid/files/abc/x.txt",
        name: "x.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "storage_key_mismatch" });
  });

  it("rejects confirm when the S3 object doesn't actually exist", async () => {
    const uploadRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/upload-url`,
      headers: authHeader(token),
      payload: { name: "ghost.txt", mimeType: "text/plain" },
    });
    const { storageKey } = uploadRes.json();

    const notFound = Object.assign(new Error("Not Found"), { name: "NotFound" });
    s3Mock.on(HeadObjectCommand).rejects(notFound);

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/confirm`,
      headers: authHeader(token),
      payload: {
        storageKey,
        name: "ghost.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "object_not_uploaded" });
  });

  it("filters list by category when query param is set", async () => {
    const db = getTestDb();
    await db.insert(filesTable).values([
      {
        workspaceId,
        uploadedBy: userId,
        storageKey: `workspaces/${workspaceId}/files/aaa/a.txt`,
        name: "a.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        category: "file",
      },
      {
        workspaceId,
        uploadedBy: userId,
        storageKey: `workspaces/${workspaceId}/note-images/bbb/b.png`,
        name: "b.png",
        mimeType: "image/png",
        sizeBytes: 2,
        category: "note-image",
      },
    ]);

    const all = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files`,
      headers: authHeader(token),
    });
    expect(all.json()).toHaveLength(2);

    const onlyImages = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files?category=note-image`,
      headers: authHeader(token),
    });
    expect(onlyImages.json()).toHaveLength(1);
    expect(onlyImages.json()[0].name).toBe("b.png");
  });

  // ─── Wave A: dedup ─────────────────────────────────────────────────

  it("dedup: confirm with a matching contentHash returns the existing row + cleans up the duplicate object", async () => {
    const db = getTestDb();
    // Seed an existing file with a known hash.
    await db.insert(filesTable).values({
      workspaceId,
      uploadedBy: userId,
      storageKey: `workspaces/${workspaceId}/files/orig/orig.txt`,
      name: "orig.txt",
      mimeType: "text/plain",
      sizeBytes: 100,
      category: "file",
      contentHash: "deadbeef",
    });

    // Confirm a "new" upload with the same hash.
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 100 });
    s3Mock.on(DeleteObjectCommand).resolves({});

    const confirmRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/confirm`,
      headers: authHeader(token),
      payload: {
        storageKey: `workspaces/${workspaceId}/files/dup/orig.txt`,
        name: "orig.txt",
        mimeType: "text/plain",
        sizeBytes: 100,
        category: "file",
        contentHash: "deadbeef",
      },
    });
    expect(confirmRes.statusCode).toBe(200);
    const body = confirmRes.json();
    expect(body.duplicate).toBe(true);
    expect(body.existing.name).toBe("orig.txt");

    // Only one row exists.
    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files`,
      headers: authHeader(token),
    });
    expect(list.json()).toHaveLength(1);
  });

  it("dedup: forceUpload=true bypasses the short-circuit and creates a second row", async () => {
    const db = getTestDb();
    await db.insert(filesTable).values({
      workspaceId,
      uploadedBy: userId,
      storageKey: `workspaces/${workspaceId}/files/orig/orig.txt`,
      name: "orig.txt",
      mimeType: "text/plain",
      sizeBytes: 100,
      category: "file",
      contentHash: "deadbeef",
    });

    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 100 });

    const confirmRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/confirm`,
      headers: authHeader(token),
      payload: {
        storageKey: `workspaces/${workspaceId}/files/dup/orig.txt`,
        name: "orig.txt",
        mimeType: "text/plain",
        sizeBytes: 100,
        category: "file",
        contentHash: "deadbeef",
        forceUpload: true,
      },
    });
    expect(confirmRes.statusCode).toBe(201);
    expect(confirmRes.json().duplicate).toBe(false);

    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files`,
      headers: authHeader(token),
    });
    expect(list.json()).toHaveLength(2);
  });

  // ─── Wave A: soft-delete ──────────────────────────────────────────

  it("soft-delete: trash → list excludes by default → list with trashed=true includes → restore → trash again → empty trash", async () => {
    const db = getTestDb();
    const [a, b] = await db
      .insert(filesTable)
      .values([
        {
          workspaceId,
          uploadedBy: userId,
          storageKey: `workspaces/${workspaceId}/files/a/a.txt`,
          name: "a.txt",
          mimeType: "text/plain",
          sizeBytes: 1,
          category: "file",
        },
        {
          workspaceId,
          uploadedBy: userId,
          storageKey: `workspaces/${workspaceId}/files/b/b.txt`,
          name: "b.txt",
          mimeType: "text/plain",
          sizeBytes: 1,
          category: "file",
        },
      ])
      .returning();

    const trashRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/trash`,
      headers: authHeader(token),
      payload: { fileIds: [a!.id, b!.id] },
    });
    expect(trashRes.statusCode).toBe(200);
    expect(trashRes.json().trashed).toBe(2);

    const active = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files`,
      headers: authHeader(token),
    });
    expect(active.json()).toHaveLength(0);

    const trashed = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files?trashed=true`,
      headers: authHeader(token),
    });
    expect(trashed.json()).toHaveLength(2);
    expect(trashed.json()[0].isTrashed).toBe(true);

    const restoreRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/restore`,
      headers: authHeader(token),
      payload: { fileIds: [a!.id] },
    });
    expect(restoreRes.json().restored).toBe(1);

    // Now empty the trash — only b is left there.
    s3Mock.on(DeleteObjectCommand).resolves({});
    const emptyRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/trash/empty`,
      headers: authHeader(token),
    });
    expect(emptyRes.json().deleted).toBe(1);

    const final = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files?trashed=true`,
      headers: authHeader(token),
    });
    expect(final.json()).toHaveLength(0);
  });

  // ─── Wave A: favorites + rename + folder filter ───────────────────

  it("favorites: PATCH isFavorite + ?favorites=true filter", async () => {
    const db = getTestDb();
    const [row] = await db
      .insert(filesTable)
      .values({
        workspaceId,
        uploadedBy: userId,
        storageKey: `workspaces/${workspaceId}/files/x/x.txt`,
        name: "x.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        category: "file",
      })
      .returning();

    const patch = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/files/${row!.id}`,
      headers: authHeader(token),
      payload: { isFavorite: true, name: "renamed.txt" },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().isFavorite).toBe(true);
    expect(patch.json().name).toBe("renamed.txt");

    const favOnly = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files?favorites=true`,
      headers: authHeader(token),
    });
    expect(favOnly.json()).toHaveLength(1);
  });

  it("stats endpoint returns category breakdown + active vs trashed totals", async () => {
    const db = getTestDb();
    await db.insert(filesTable).values([
      {
        workspaceId,
        uploadedBy: userId,
        storageKey: `workspaces/${workspaceId}/files/a/a.txt`,
        name: "a.txt",
        mimeType: "text/plain",
        sizeBytes: 100,
        category: "file",
      },
      {
        workspaceId,
        uploadedBy: userId,
        storageKey: `workspaces/${workspaceId}/note-images/b/b.png`,
        name: "b.png",
        mimeType: "image/png",
        sizeBytes: 500,
        category: "note-image",
      },
      {
        workspaceId,
        uploadedBy: userId,
        storageKey: `workspaces/${workspaceId}/files/c/c.txt`,
        name: "c.txt",
        mimeType: "text/plain",
        sizeBytes: 50,
        category: "file",
        isTrashed: true,
        trashedAt: new Date(),
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files/stats`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(stats.totalCount).toBe(2);
    expect(stats.totalBytes).toBe(600);
    expect(stats.trashedCount).toBe(1);
    expect(stats.trashedBytes).toBe(50);
    expect(stats.byCategory.file).toEqual({ count: 1, bytes: 100 });
    expect(stats.byCategory["note-image"]).toEqual({ count: 1, bytes: 500 });
  });

  it("workspace cascade: deleting the workspace also removes its files", async () => {
    const db = getTestDb();
    await db.insert(filesTable).values({
      workspaceId,
      uploadedBy: userId,
      storageKey: `workspaces/${workspaceId}/files/x/x.txt`,
      name: "x.txt",
      mimeType: "text/plain",
      sizeBytes: 1,
      category: "file",
    });
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    const remaining = await db
      .select()
      .from(filesTable)
      .where(eq(filesTable.workspaceId, workspaceId));
    expect(remaining).toHaveLength(0);
  });
});
