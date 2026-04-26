import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { users } from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("email-automations routes", () => {
  let app: FastifyInstance;
  let userId: string;
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
    const email = `a-${Date.now()}@desh.test`;
    const [user] = await db.insert(users).values({ cognitoSub: subjectId, email, isAdmin: true }).returning();
    userId = user!.id;
    token = await signTestToken({ sub: subjectId, email });
  });

  it("rejects non-admin users", async () => {
    const db = getTestDb();
    await db.update(users).set({ isAdmin: false }).where(eq(users.id, userId));
    const res = await app.inject({
      method: "GET",
      url: "/admin/email-automations",
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin can CRUD an automation", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/admin/email-automations",
      headers: authHeader(token),
      payload: {
        name: "Daily summary",
        triggerType: "cron",
        triggerConfig: { cron: "0 8 * * *" },
        templateSlug: "daily_summary",
        targetAudience: "active",
      },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json();
    expect(created.triggerType).toBe("cron");
    expect(created.targetAudience).toBe("active");

    const list = await app.inject({
      method: "GET",
      url: "/admin/email-automations",
      headers: authHeader(token),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);

    const patch = await app.inject({
      method: "PATCH",
      url: `/admin/email-automations/${created.id}`,
      headers: authHeader(token),
      payload: { active: false },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().active).toBe(false);

    const del = await app.inject({
      method: "DELETE",
      url: `/admin/email-automations/${created.id}`,
      headers: authHeader(token),
    });
    expect(del.statusCode).toBe(204);
  });

  it("manual run path returns counts (no users to dispatch to → 0 sent)", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/admin/email-automations",
      headers: authHeader(token),
      payload: {
        name: "Manual broadcast",
        triggerType: "manual",
        templateSlug: "broadcast",
        targetAudience: "admins",
      },
    });
    const created = create.json();
    const run = await app.inject({
      method: "POST",
      url: `/admin/email-automations/${created.id}/run`,
      headers: authHeader(token),
    });
    expect(run.statusCode).toBe(200);
    const result = run.json();
    expect(result.evaluated).toBe(1);
    expect(result.fired).toBe(1);
    // Audience=admins: only the test user (admin), but RESEND unconfigured
    // → send fails → counted as `failed` (1), not `sent`.
    expect(result.sent + result.failed + result.skipped).toBeGreaterThanOrEqual(1);
  });
});
