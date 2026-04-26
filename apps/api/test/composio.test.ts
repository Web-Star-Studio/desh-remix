import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { workspaceMembers, workspaces, users } from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { entityIdFor, normalizeToolkitSlug } from "../src/services/composio.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("composio service helpers", () => {
  it("normalizes toolkit slugs", () => {
    expect(normalizeToolkitSlug("Google Calendar")).toBe("googlecalendar");
    expect(normalizeToolkitSlug("google_calendar")).toBe("googlecalendar");
    expect(normalizeToolkitSlug("GMAIL")).toBe("gmail");
  });

  it("composes entity IDs as workspaceId_userId", () => {
    expect(entityIdFor("ws-uuid", "user-uuid")).toBe("ws-uuid_user-uuid");
  });
});

describe("composio routes — auth + membership gates", () => {
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

  it("rejects unauthenticated GET", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/composio-connections`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns empty list for a fresh workspace (Composio not configured in test env)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/composio-connections`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("blocks non-members from listing", async () => {
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
      url: `/workspaces/${otherWs!.id}/composio-connections`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 503 from connect when COMPOSIO_API_KEY is unset", async () => {
    // Test env intentionally has no COMPOSIO_API_KEY, so connect/execute
    // should refuse with a clear error rather than crashing.
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/composio-connections/gmail/connect`,
      headers: authHeader(token),
      payload: {},
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ error: "composio_not_configured" });
  });

  it("redirects /composio/callback to the configured target", async () => {
    const res = await app.inject({ method: "GET", url: "/composio/callback" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("composio_callback=true");
  });
});
