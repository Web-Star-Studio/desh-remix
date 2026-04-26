import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  agentEvents,
  agentProfiles,
  conversations,
  users,
  workspaceMembers,
  workspaces,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { getTestDb, resetData } from "./_helpers/db.js";
import { subscribe } from "../src/services/event-bus.js";

const SECRET = "test-rich-events-callback-secret";

describe("hermes rich runtime events", () => {
  let app: FastifyInstance;
  let workspaceId: string;
  let conversationId: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetData();
    const db = getTestDb();
    const [user] = await db
      .insert(users)
      .values({ cognitoSub: crypto.randomUUID(), email: `rich-${Date.now()}@desh.test` })
      .returning();
    userId = user!.id;
    const [ws] = await db
      .insert(workspaces)
      .values({ name: "RichEventsTest", createdBy: userId, isDefault: true })
      .returning();
    workspaceId = ws!.id;
    await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
    const [profile] = await db
      .insert(agentProfiles)
      .values({
        workspaceId,
        displayName: "Test Agent",
        callbackSecret: SECRET,
      })
      .returning({ id: agentProfiles.id });
    const [conv] = await db
      .insert(conversations)
      .values({
        workspaceId,
        createdBy: userId,
        agentProfileId: profile!.id,
        title: "Test Convo",
      })
      .returning();
    conversationId = conv!.id;
  });

  function envelope(extra: Record<string, unknown> = {}) {
    return {
      seq: 1,
      platform: "saas_web",
      conversation_id: conversationId,
      workspace_id: workspaceId,
      message_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...extra,
    };
  }

  async function postEvent(body: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: "/internal/hermes/events",
      headers: {
        authorization: `Bearer ${SECRET}`,
        "content-type": "application/json",
      },
      payload: JSON.stringify(body),
    });
  }

  it("persists tool.started with the tool_call_id in payload", async () => {
    const res = await postEvent({
      ...envelope({ seq: 5 }),
      event: "tool.started",
      tool_call_id: "call_42",
      tool_name: "list_tasks",
      args_keys: ["status"],
    });
    expect(res.statusCode).toBe(204);

    const db = getTestDb();
    const rows = await db
      .select()
      .from(agentEvents)
      .where(eq(agentEvents.conversationId, conversationId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe("tool.started");
    expect(rows[0]!.payload).toMatchObject({
      tool_call_id: "call_42",
      tool_name: "list_tasks",
      args_keys: ["status"],
    });
  });

  it("persists tool.completed with duration_ms + result_preview", async () => {
    await postEvent({
      ...envelope({ seq: 10 }),
      event: "tool.completed",
      tool_call_id: "call_42",
      tool_name: "list_tasks",
      duration_ms: 1234,
      result_preview: "[{...}]",
    });
    const db = getTestDb();
    const [row] = await db
      .select()
      .from(agentEvents)
      .where(eq(agentEvents.conversationId, conversationId));
    expect(row?.type).toBe("tool.completed");
    expect(row?.payload).toMatchObject({ duration_ms: 1234, result_preview: "[{...}]" });
  });

  it("persists run.completed + reasoning.summary + step.completed + status", async () => {
    const events = [
      { ...envelope({ seq: 1 }), event: "run.started", status: "running" },
      { ...envelope({ seq: 2 }), event: "reasoning.summary", summary: "Capped excerpt", truncated: true },
      { ...envelope({ seq: 3 }), event: "step.completed", iteration: 1, tool_names: ["list_tasks"] },
      { ...envelope({ seq: 4 }), event: "status", status: "context_pressure", content: "high" },
      { ...envelope({ seq: 5 }), event: "run.completed", duration_ms: 12000 },
    ];
    for (const e of events) {
      const r = await postEvent(e);
      expect(r.statusCode).toBe(204);
    }
    const db = getTestDb();
    const rows = await db
      .select({ type: agentEvents.type })
      .from(agentEvents)
      .where(eq(agentEvents.conversationId, conversationId));
    const types = rows.map((r) => r.type).sort();
    expect(types).toEqual(["reasoning.summary", "run.completed", "run.started", "status", "step.completed"]);
  });

  it("does NOT persist message.delta but DOES broadcast it via pub/sub", async () => {
    const received: Array<{ type: string; payload: unknown }> = [];
    const unsubscribe = subscribe(conversationId, (env) => {
      received.push({ type: env.type, payload: env.payload });
    });

    const res = await postEvent({
      ...envelope({ seq: 1 }),
      event: "message.delta",
      delta: "Hello",
      index: 0,
    });
    expect(res.statusCode).toBe(204);
    unsubscribe();

    // No DB row.
    const db = getTestDb();
    const rows = await db
      .select()
      .from(agentEvents)
      .where(eq(agentEvents.conversationId, conversationId));
    expect(rows).toHaveLength(0);

    // Live subscriber saw the event.
    expect(received).toHaveLength(1);
    expect(received[0]!.type).toBe("message.delta");
    expect(received[0]!.payload).toMatchObject({ delta: "Hello", index: 0 });
  });

  it("typing and reasoning.started are also ephemeral", async () => {
    await postEvent({ ...envelope({ seq: 1 }), event: "typing" });
    await postEvent({ ...envelope({ seq: 2 }), event: "reasoning.started", status: "streaming" });
    const db = getTestDb();
    const rows = await db
      .select()
      .from(agentEvents)
      .where(eq(agentEvents.conversationId, conversationId));
    expect(rows).toHaveLength(0);
  });

  it("message events still map to assistant_message (legacy compat)", async () => {
    await postEvent({
      ...envelope({ seq: 1 }),
      event: "message",
      content: "Hello world",
    });
    const db = getTestDb();
    const [row] = await db
      .select()
      .from(agentEvents)
      .where(eq(agentEvents.conversationId, conversationId));
    expect(row?.type).toBe("assistant_message");
    expect(row?.payload).toMatchObject({ content: "Hello world" });
  });

  it("rejects unknown event types with 400", async () => {
    const res = await postEvent({
      ...envelope({ seq: 1 }),
      event: "totally.bogus",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("invalid_body");
  });
});
