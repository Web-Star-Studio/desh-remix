import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  workspaceMembers,
  workspaces,
  users,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("gmail-labels routes", () => {
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
    const email = `lbl-${Date.now()}@desh.test`;

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

  it("returns empty list for fresh workspace", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/gmail-labels`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("503s on refresh when Composio unconfigured", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/gmail-labels/refresh`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("composio_unconfigured");
  });

  it("503s on create when Composio unconfigured", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/gmail-labels`,
      headers: authHeader(token),
      payload: { name: "newsletters" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("composio_unconfigured");
  });

  it("rejects unauthenticated GET", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/gmail-labels`,
    });
    expect(res.statusCode).toBe(401);
  });
});
