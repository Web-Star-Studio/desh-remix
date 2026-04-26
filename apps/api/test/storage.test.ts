import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  buildStorageKey,
  deleteObject,
  getDownloadUrl,
  getUploadUrl,
  headObject,
  isStorageConfigured,
  resetStorageClientForTests,
} from "../src/services/storage.js";

const s3Mock = mockClient(S3Client);

describe("storage service", () => {
  beforeEach(() => {
    s3Mock.reset();
    resetStorageClientForTests();
  });

  afterEach(() => {
    s3Mock.reset();
  });

  it("reports configured when AWS_S3_BUCKET is set (test env seeds it)", () => {
    expect(isStorageConfigured()).toBe(true);
  });

  it("buildStorageKey isolates by category and uuid", () => {
    const k1 = buildStorageKey({ workspaceId: "ws-1", category: "file", filename: "hello.txt" });
    const k2 = buildStorageKey({ workspaceId: "ws-1", category: "file", filename: "hello.txt" });
    expect(k1).toMatch(/^workspaces\/ws-1\/files\/[0-9a-f-]{36}\/hello\.txt$/);
    expect(k1).not.toBe(k2); // uuid differs
  });

  it("buildStorageKey maps categories to prefixes", () => {
    expect(buildStorageKey({ workspaceId: "ws", category: "note-image", filename: "x.png" }))
      .toContain("/note-images/");
    expect(buildStorageKey({ workspaceId: "ws", category: "profile-doc", filename: "x.pdf" }))
      .toContain("/profile-docs/");
  });

  it("buildStorageKey defends against path traversal in filenames", () => {
    const key = buildStorageKey({
      workspaceId: "ws",
      category: "file",
      filename: "../../etc/passwd",
    });
    expect(key).not.toContain("..");
    expect(key.split("/").filter((p) => p === "..")).toHaveLength(0);
  });

  it("getUploadUrl produces a signed PUT URL pointing at the bucket + key", async () => {
    const url = await getUploadUrl({
      storageKey: "workspaces/ws/files/abc/hello.txt",
      contentType: "text/plain",
    });
    expect(url).toContain("desh-test-bucket");
    expect(url).toContain("workspaces/ws/files/abc/hello.txt");
    expect(url).toContain("X-Amz-Signature=");
    // Presign happens locally — no SDK calls captured
    expect(s3Mock.calls()).toHaveLength(0);
  });

  it("getDownloadUrl produces a signed GET URL", async () => {
    const url = await getDownloadUrl({ storageKey: "workspaces/ws/files/abc/hello.txt" });
    expect(url).toContain("desh-test-bucket");
    expect(url).toContain("X-Amz-Signature=");
  });

  it("deleteObject sends a DeleteObjectCommand", async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});
    await deleteObject("workspaces/ws/files/abc/hello.txt");
    const calls = s3Mock.commandCalls(DeleteObjectCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.args[0].input).toMatchObject({
      Bucket: "desh-test-bucket",
      Key: "workspaces/ws/files/abc/hello.txt",
    });
  });

  it("headObject returns exists=true with size when object is present", async () => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 12345 });
    const result = await headObject("workspaces/ws/files/abc/hello.txt");
    expect(result).toEqual({ exists: true, sizeBytes: 12345 });
  });

  it("headObject returns exists=false on NotFound (404)", async () => {
    const notFound = Object.assign(new Error("Not Found"), { name: "NotFound" });
    s3Mock.on(HeadObjectCommand).rejects(notFound);
    const result = await headObject("workspaces/ws/files/abc/missing.txt");
    expect(result).toEqual({ exists: false });
  });

  it("headObject re-throws non-404 errors", async () => {
    const fault = Object.assign(new Error("InternalError"), { name: "InternalError" });
    s3Mock.on(HeadObjectCommand).rejects(fault);
    await expect(headObject("workspaces/ws/files/abc/x.txt")).rejects.toThrow("InternalError");
  });
});
