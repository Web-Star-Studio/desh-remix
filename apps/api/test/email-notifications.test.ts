import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  emailRateLimits,
  emailSendLog,
  notificationPreferences,
  workspaceMembers,
  workspaces,
  users,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { sendNotification } from "../src/services/email-notifications.js";
import { getTestDb, resetData } from "./_helpers/db.js";

// Notification service tests focus on the suppression paths (preference,
// rate limit, missing email) and the audit trail. The Resend HTTP call is
// gated by RESEND_API_KEY which the test env doesn't set — sendViaResend
// returns `provider_unconfigured`, so every send lands as `failed` in the
// log. That's exactly what we want for tests: deterministic, no network.

describe("email-notifications service", () => {
  let app: FastifyInstance;
  let userId: string;
  let workspaceId: string;

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
    const email = `notif-${Date.now()}@desh.test`;

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
  });

  it("creates default preferences on first send (all enabled)", async () => {
    await sendNotification({
      userId,
      type: "task_reminder",
      data: { title: "Test task" },
      workspaceId,
    });
    const db = getTestDb();
    const [prefs] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    expect(prefs).toBeTruthy();
    expect(prefs!.emailTaskReminders).toBe(true);
  });

  it("suppresses send when preference is off (logs skipped)", async () => {
    const db = getTestDb();
    await db.insert(notificationPreferences).values({
      userId,
      emailTaskReminders: false,
    });

    const result = await sendNotification({
      userId,
      type: "task_reminder",
      data: { title: "Suppressed" },
      workspaceId,
    });
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("preference_off");

    const logs = await db
      .select()
      .from(emailSendLog)
      .where(eq(emailSendLog.userId, userId));
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("skipped");
  });

  it("suppresses send when rate-limited within 4h", async () => {
    const db = getTestDb();
    await db.insert(emailRateLimits).values({
      userId,
      emailType: "task_reminder",
    });

    const result = await sendNotification({
      userId,
      type: "task_reminder",
      data: { title: "Rate-limited" },
      workspaceId,
    });
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("rate_limited");
  });

  it("attempts send when allowed; lands as `failed` because RESEND_API_KEY is unset in tests", async () => {
    const result = await sendNotification({
      userId,
      type: "event_reminder",
      data: { title: "Meeting" },
      workspaceId,
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("provider_unconfigured");

    const db = getTestDb();
    const logs = await db
      .select()
      .from(emailSendLog)
      .where(eq(emailSendLog.userId, userId));
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("failed");
    expect(logs[0]!.errorMessage).toBe("provider_unconfigured");
  });
});
