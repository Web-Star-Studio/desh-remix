import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockClient } from "aws-sdk-client-mock";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { workspaceMembers, workspaces, users } from "@desh/database/schema";
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
    // Step 1: get upload URL
    const uploadRes = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/files/upload-url`,
      headers: authHeader(token),
      payload: { name: "hello.txt", mimeType: "text/plain", category: "file" },
    });
    expect(uploadRes.statusCode).toBe(200);
    const { storageKey } = uploadRes.json();

    // Step 2: pretend the SPA PUT to S3 succeeded — mock HeadObject to say
    // the object now exists.
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 5 });

    // Step 3: confirm the upload, persisting the row.
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
    const file = confirmRes.json();
    expect(file).toMatchObject({
      workspaceId,
      uploadedBy: userId,
      storageKey,
      name: "hello.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      category: "file",
    });

    // Step 4: list returns the row.
    const listRes = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files`,
      headers: authHeader(token),
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toHaveLength(1);

    // Step 5: download URL.
    const downloadRes = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/files/${file.id}/download-url`,
      headers: authHeader(token),
    });
    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.json().url).toContain("desh-test-bucket");
    expect(downloadRes.json().url).toContain("X-Amz-Signature=");

    // Step 6: delete (mock S3 delete to succeed).
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
    // Generate a key first so it's well-formed and inside this workspace.
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
    // Insert two rows directly via DB to avoid round-tripping S3 mocks twice.
    const db = getTestDb();
    const { files: filesTable } = await import("@desh/database/schema");
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
});
