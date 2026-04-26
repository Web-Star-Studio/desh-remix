import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  composioConnections,
  emails,
  workspaceMembers,
  workspaces,
  users,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { upsertEmails } from "../src/services/emails.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("emails routes", () => {
  let app: FastifyInstance;
  let userId: string;
  let workspaceId: string;
  let connectionId: string;
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
    const email = `e-${Date.now()}@desh.test`;

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

    const [conn] = await db
      .insert(composioConnections)
      .values({
        workspaceId,
        userId,
        toolkit: "gmail",
        scope: "member",
        composioEntityId: `${workspaceId}_${userId}`,
        status: "active",
      })
      .returning();
    connectionId = conn!.id;

    token = await signTestToken({ sub: subjectId, email });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/emails`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns empty list when cache is empty", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/emails`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([]);
    expect(res.json().nextCursor).toBeNull();
  });

  it("upserts → lists → patches → trashes → cascades on workspace delete", async () => {
    const date = new Date(Date.now() - 60_000);
    await upsertEmails([
      {
        workspaceId,
        connectionId,
        gmailId: "msg-001",
        threadId: "thread-001",
        fromName: "Ada Lovelace",
        fromEmail: "ada@example.com",
        subject: "Engine notes",
        snippet: "First analytical engine notes…",
        date,
        labelIds: ["INBOX", "UNREAD"],
        folder: "inbox",
      },
    ]);

    const list = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/emails?folder=inbox`,
      headers: authHeader(token),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);
    const row = list.json().items[0];
    expect(row.gmailId).toBe("msg-001");
    expect(row.subject).toBe("Engine notes");
    expect(row.isUnread).toBe(true);

    const patch = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspaceId}/emails/${row.id}`,
      headers: authHeader(token),
      payload: { isRead: true, isStarred: true },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().isUnread).toBe(false);
    expect(patch.json().isStarred).toBe(true);

    const trash = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/emails/${row.id}/trash`,
      headers: authHeader(token),
    });
    expect(trash.statusCode).toBe(200);
    expect(trash.json().folder).toBe("trash");

    // Workspace delete cascades the emails row.
    const db = getTestDb();
    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    const remaining = await db.select().from(emails).where(eq(emails.id, row.id));
    expect(remaining).toHaveLength(0);
  });

  it("searches across subject and from fields", async () => {
    const date = new Date(Date.now() - 60_000);
    await upsertEmails([
      {
        workspaceId,
        connectionId,
        gmailId: "msg-100",
        fromName: "Ada Lovelace",
        fromEmail: "ada@example.com",
        subject: "Engine status",
        snippet: "All green",
        date,
      },
      {
        workspaceId,
        connectionId,
        gmailId: "msg-101",
        fromName: "Grace Hopper",
        fromEmail: "grace@example.com",
        subject: "Bug found",
        snippet: "moth in the relay",
        date,
      },
    ]);
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/emails/search?q=ada`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].fromName).toBe("Ada Lovelace");
  });

  it("isolates emails between workspaces", async () => {
    // Build a second workspace where the user is NOT a member.
    const db = getTestDb();
    const [otherUser] = await db
      .insert(users)
      .values({ cognitoSub: crypto.randomUUID(), email: "other@desh.test" })
      .returning();
    const [otherWs] = await db
      .insert(workspaces)
      .values({ name: "Other", createdBy: otherUser!.id })
      .returning();
    await db.insert(workspaceMembers).values({
      workspaceId: otherWs!.id,
      userId: otherUser!.id,
      role: "owner",
    });
    const [otherConn] = await db
      .insert(composioConnections)
      .values({
        workspaceId: otherWs!.id,
        userId: otherUser!.id,
        toolkit: "gmail",
        scope: "member",
        composioEntityId: `${otherWs!.id}_${otherUser!.id}`,
        status: "active",
      })
      .returning();

    await upsertEmails([
      {
        workspaceId: otherWs!.id,
        connectionId: otherConn!.id,
        gmailId: "secret-msg",
        subject: "Secret",
        date: new Date(),
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${otherWs!.id}/emails`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("manual sync trigger enumerates active gmail connections", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/emails/sync`,
      headers: authHeader(token),
    });
    // pg-boss is not started in tests, so enqueue throws and the route logs;
    // the route still returns the count of attempted connections (0 enqueued
    // because pg-boss isn't running, 1 connection found).
    expect(res.statusCode).toBe(200);
    expect(res.json().connections).toBe(1);
  });
});
