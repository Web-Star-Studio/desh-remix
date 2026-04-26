import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { unsubscribeHistory, workspaceMembers, workspaces, users } from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("email-unsubscribe routes", () => {
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
    const email = `u-${Date.now()}@desh.test`;
    const [user] = await db.insert(users).values({ cognitoSub: subjectId, email }).returning();
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
      method: "POST",
      url: `/workspaces/${workspaceId}/email-unsubscribe`,
      payload: { requests: [{ url: "https://example.com/unsub" }] },
    });
    expect(res.statusCode).toBe(401);
  });

  it("blocks private-IP URLs and records the failure in history", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/email-unsubscribe`,
      headers: authHeader(token),
      payload: {
        requests: [
          { url: "http://10.0.0.1/unsubscribe", senderName: "Bad", senderEmail: "bad@example.com" },
          { url: "http://localhost/unsub", senderName: "Local", senderEmail: "local@example.com" },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results.every((r: { success: boolean }) => r.success === false)).toBe(true);

    const db = getTestDb();
    const rows = await db
      .select()
      .from(unsubscribeHistory)
      .where(eq(unsubscribeHistory.userId, userId));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.success).toBe(false);
  });

  it("rejects mailto when Composio is unconfigured", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/email-unsubscribe`,
      headers: authHeader(token),
      payload: {
        requests: [
          { url: "mailto:unsub@example.com", method: "mailto", senderEmail: "x@example.com" },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toBe("composio_unconfigured");
  });

  it("history endpoint returns rows scoped to the workspace + user", async () => {
    const db = getTestDb();
    await db.insert(unsubscribeHistory).values({
      workspaceId,
      userId,
      senderName: "Newsletter Co.",
      senderEmail: "news@example.com",
      method: "GET",
      success: true,
      emailsAffected: 5,
    });
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/unsubscribe-history`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].senderEmail).toBe("news@example.com");
    expect(res.json()[0].success).toBe(true);
  });
});
