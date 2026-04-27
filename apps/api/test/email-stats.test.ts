import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { emailSendLog, users, workspaces, workspaceMembers } from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

describe("email-stats route", () => {
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
    const email = `stats-${Date.now()}@desh.test`;
    const [user] = await db.insert(users).values({ cognitoSub: subjectId, email }).returning();
    userId = user!.id;
    token = await signTestToken({ sub: subjectId, email });
  });

  it("rejects non-admin users", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/email-stats",
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns admin email send aggregates", async () => {
    const db = getTestDb();
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
    const [workspace] = await db
      .insert(workspaces)
      .values({ name: "Stats", createdBy: userId })
      .returning();
    await db.insert(workspaceMembers).values({
      workspaceId: workspace!.id,
      userId,
      role: "owner",
    });

    await db.insert(emailSendLog).values([
      {
        workspaceId: workspace!.id,
        userId,
        emailType: "daily_summary",
        recipientEmail: "a@desh.test",
        subject: "Daily",
        status: "sent",
      },
      {
        workspaceId: workspace!.id,
        userId,
        emailType: "daily_summary",
        recipientEmail: "b@desh.test",
        subject: "Daily failed",
        status: "failed",
        errorMessage: "provider_error",
      },
      {
        workspaceId: workspace!.id,
        userId,
        emailType: "marketing",
        recipientEmail: "c@desh.test",
        subject: "Promo",
        status: "skipped",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/admin/email-stats",
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sent_today).toBe(1);
    expect(body.sent_week).toBe(1);
    expect(body.sent_month).toBe(1);
    expect(body.failed_total).toBe(1);
    expect(body.skipped_total).toBe(1);
    expect(body.by_type).toEqual(
      expect.arrayContaining([
        { email_type: "daily_summary", status: "sent", count: 1 },
        { email_type: "daily_summary", status: "failed", count: 1 },
        { email_type: "marketing", status: "skipped", count: 1 },
      ]),
    );
    expect(body.daily_volume).toHaveLength(30);
    expect(body.recent_logs).toHaveLength(3);
    expect(body.recent_logs[0]).toHaveProperty("created_at");
  });
});
