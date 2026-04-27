import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  agentProfiles,
  contacts,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "@desh/database/schema";
import { buildServer } from "../src/server.js";
import { getTestDb, resetData } from "./_helpers/db.js";
import { buildTestMcpClient } from "./_helpers/mcp.js";
import type { McpAuthContext } from "../src/services/mcp/auth.js";

interface ToolCallContent {
  type: string;
  text?: string;
}

function readJson<T = unknown>(content: ToolCallContent[]): T {
  const text = content[0]?.text ?? "";
  return JSON.parse(text) as T;
}

describe("mcp tools (in-memory transport)", () => {
  let userId: string;
  let workspaceId: string;
  let ctx: McpAuthContext;

  beforeEach(async () => {
    await resetData();
    const db = getTestDb();
    const subjectId = crypto.randomUUID();
    const [user] = await db
      .insert(users)
      .values({ cognitoSub: subjectId, email: `m-${Date.now()}@desh.test` })
      .returning();
    userId = user!.id;

    const [ws] = await db
      .insert(workspaces)
      .values({ name: "Personal", createdBy: userId, isDefault: true })
      .returning();
    workspaceId = ws!.id;

    await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
    ctx = { workspaceId, ownerUserId: userId, profileId: "test-profile" };
  });

  it("list_tasks returns empty for a fresh workspace", async () => {
    const { client, cleanup } = await buildTestMcpClient(ctx);
    try {
      const res = await client.callTool({ name: "list_tasks", arguments: {} });
      expect(res.isError).toBeFalsy();
      expect(readJson(res.content as ToolCallContent[])).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  it("tools/list exposes the full Desh tool surface", async () => {
    const { client, cleanup } = await buildTestMcpClient(ctx);
    try {
      const list = await client.listTools();
      const names = list.tools.map((t) => t.name).sort();
      expect(names).toEqual(
        [
          // First-party data
          "complete_task",
          "create_contact",
          "create_task",
          "find_contact",
          "list_emails",
          "list_tasks",
          "log_interaction",
          "search_emails",
          "send_email",
          // Zernio-backed: social platforms + WhatsApp + inbox + media
          "social_accounts_list",
          "social_post_publish_now",
          "social_post_schedule",
          "social_posts_list",
          "social_post_retry",
          "whatsapp_send_text",
          "whatsapp_send_template",
          "whatsapp_templates_list",
          "whatsapp_broadcasts_list",
          "whatsapp_broadcast_send",
          "inbox_conversations_list",
          "inbox_messages_list",
          "inbox_send_message",
          "media_generate_upload_link",
          "media_check_upload_status",
        ].sort(),
      );
    } finally {
      await cleanup();
    }
  });

  it("create_task → list_tasks → complete_task round-trip", async () => {
    const { client, cleanup } = await buildTestMcpClient(ctx);
    try {
      const created = await client.callTool({
        name: "create_task",
        arguments: { title: "Write the launch announcement", priority: "high", dueDate: "2026-05-01" },
      });
      const createdRow = readJson<{ id: string; title: string; status: string }>(
        created.content as ToolCallContent[],
      );
      expect(createdRow.title).toBe("Write the launch announcement");
      expect(createdRow.status).toBe("todo");

      const listed = await client.callTool({ name: "list_tasks", arguments: {} });
      const listRows = readJson<Array<{ id: string; status: string }>>(
        listed.content as ToolCallContent[],
      );
      expect(listRows).toHaveLength(1);
      expect(listRows[0]!.id).toBe(createdRow.id);

      const completed = await client.callTool({
        name: "complete_task",
        arguments: { id: createdRow.id },
      });
      const completedRow = readJson<{ id: string; status: string }>(
        completed.content as ToolCallContent[],
      );
      expect(completedRow.status).toBe("done");

      // DB row reflects the change.
      const db = getTestDb();
      const [row] = await db.select().from(tasks).where(eq(tasks.id, createdRow.id));
      expect(row?.status).toBe("done");
      expect(row?.completedAt).not.toBeNull();
      expect(row?.createdBy).toBe(userId);
    } finally {
      await cleanup();
    }
  });

  it("find_contact → create_contact → log_interaction round-trip", async () => {
    const { client, cleanup } = await buildTestMcpClient(ctx);
    try {
      const empty = await client.callTool({
        name: "find_contact",
        arguments: { query: "John" },
      });
      expect(readJson(empty.content as ToolCallContent[])).toEqual([]);

      const created = await client.callTool({
        name: "create_contact",
        arguments: { name: "John Smith", email: "john@example.com", company: "Acme" },
      });
      const createdRow = readJson<{ id: string; name: string }>(
        created.content as ToolCallContent[],
      );
      expect(createdRow.name).toBe("John Smith");

      const found = await client.callTool({
        name: "find_contact",
        arguments: { query: "john" },
      });
      const foundRows = readJson<Array<{ id: string; name: string }>>(
        found.content as ToolCallContent[],
      );
      expect(foundRows).toHaveLength(1);
      expect(foundRows[0]!.id).toBe(createdRow.id);

      const logged = await client.callTool({
        name: "log_interaction",
        arguments: {
          contactId: createdRow.id,
          type: "call",
          title: "Discussed Q2 roadmap",
        },
      });
      const loggedRow = readJson<{ id: string; type: string; title: string }>(
        logged.content as ToolCallContent[],
      );
      expect(loggedRow.type).toBe("call");

      // DB row reflects the change.
      const db = getTestDb();
      const [contactRow] = await db.select().from(contacts).where(eq(contacts.id, createdRow.id));
      expect(contactRow?.createdBy).toBe(userId);
    } finally {
      await cleanup();
    }
  });

  it("returns isError for tool calls that hit a ServiceError", async () => {
    const { client, cleanup } = await buildTestMcpClient(ctx);
    try {
      const res = await client.callTool({
        name: "complete_task",
        arguments: { id: "00000000-0000-4000-8000-000000000000" },
      });
      expect(res.isError).toBe(true);
      const text = (res.content as ToolCallContent[])[0]?.text;
      expect(text).toBe("task_not_found");
    } finally {
      await cleanup();
    }
  });

  it("filters list_tasks by status", async () => {
    const { client, cleanup } = await buildTestMcpClient(ctx);
    try {
      await client.callTool({ name: "create_task", arguments: { title: "A" } });
      const created = await client.callTool({ name: "create_task", arguments: { title: "B" } });
      const bRow = readJson<{ id: string }>(created.content as ToolCallContent[]);
      await client.callTool({ name: "complete_task", arguments: { id: bRow.id } });

      const todos = await client.callTool({
        name: "list_tasks",
        arguments: { status: "todo" },
      });
      expect(readJson<Array<unknown>>(todos.content as ToolCallContent[])).toHaveLength(1);

      const done = await client.callTool({
        name: "list_tasks",
        arguments: { status: "done" },
      });
      expect(readJson<Array<unknown>>(done.content as ToolCallContent[])).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });
});

describe("mcp route auth", () => {
  let app: FastifyInstance;
  let workspaceId: string;
  const SECRET = "test-callback-secret-for-mcp";

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
      .values({ cognitoSub: crypto.randomUUID(), email: `mcp-${Date.now()}@desh.test` })
      .returning();
    const [ws] = await db
      .insert(workspaces)
      .values({ name: "AuthTest", createdBy: user!.id, isDefault: true })
      .returning();
    workspaceId = ws!.id;
    await db.insert(workspaceMembers).values({ workspaceId, userId: user!.id, role: "owner" });
    await db.insert(agentProfiles).values({
      workspaceId,
      displayName: "Test Agent",
      callbackSecret: SECRET,
    });
  });

  it("rejects requests without a Bearer token", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/internal/mcp/${workspaceId}`,
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      payload: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects requests with the wrong Bearer token", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/internal/mcp/${workspaceId}`,
      headers: {
        authorization: "Bearer not-the-right-secret",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      payload: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects when no agent_profile exists for the workspace", async () => {
    // Create a second workspace WITHOUT an agent_profile.
    const db = getTestDb();
    const [user] = await db
      .insert(users)
      .values({ cognitoSub: crypto.randomUUID(), email: `mcp2-${Date.now()}@desh.test` })
      .returning();
    const [ws2] = await db
      .insert(workspaces)
      .values({ name: "NoProfile", createdBy: user!.id })
      .returning();
    await db.insert(workspaceMembers).values({ workspaceId: ws2!.id, userId: user!.id, role: "owner" });

    const res = await app.inject({
      method: "POST",
      url: `/internal/mcp/${ws2!.id}`,
      headers: {
        authorization: `Bearer ${SECRET}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      payload: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.statusCode).toBe(401);
  });
});
