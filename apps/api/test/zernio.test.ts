import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createHmac } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  socialAccounts,
  socialProfiles,
  users,
  whatsappSendLogs,
  workspaceMembers,
  workspaces,
} from "@desh/database/schema";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

// Mock the Zernio HTTP client at the module boundary. Each test sets the
// behaviour it expects via the vi.fn references below. Routes call
// services/zernio.ts → those functions call out to fetch; mocking the module
// directly lets us assert request shape without spinning up a fake Zernio.
const mockCreateProfile = vi.fn();
const mockListAccounts = vi.fn();
const mockSendWhatsAppText = vi.fn();
const mockSendWhatsAppTemplate = vi.fn();
const mockProbeHealth = vi.fn();

class MockZernioApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;
  constructor(opts: { message: string; code: string; status?: number; retryable?: boolean }) {
    super(opts.message);
    this.name = "ZernioApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

vi.mock("../src/services/zernio.js", () => ({
  ZernioApiError: MockZernioApiError,
  isZernioConfigured: () => true,
  createProfile: (input: { name: string; description?: string }) => mockCreateProfile(input),
  listAccounts: (input: { profileId: string; platform?: string }) => mockListAccounts(input),
  sendWhatsAppText: (input: unknown) => mockSendWhatsAppText(input),
  sendWhatsAppTemplate: (input: unknown) => mockSendWhatsAppTemplate(input),
  probeHealth: () => mockProbeHealth(),
  whatsappTemplates: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
  whatsappBroadcasts: {
    list: vi.fn(),
    create: vi.fn(),
    send: vi.fn(),
    schedule: vi.fn(),
    addRecipients: vi.fn(),
  },
  whatsappContacts: { list: vi.fn(), create: vi.fn(), import: vi.fn(), bulkUpdate: vi.fn() },
  whatsappBusinessProfile: { get: vi.fn(), update: vi.fn() },
  whatsappPhoneNumbers: { list: vi.fn(), purchase: vi.fn() },
  whatsappConnect: {
    getSdkConfig: vi.fn(),
    exchangeEmbeddedSignup: vi.fn(),
    connectCredentials: vi.fn(),
  },
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  disconnectAccount: vi.fn(),
  connect: { getAuthUrl: vi.fn() },
  posts: {
    create: vi.fn(),
    publishNow: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
  },
  inbox: {
    conversationsList: vi.fn(),
    messagesList: vi.fn(),
    sendMessage: vi.fn(),
    replyToComment: vi.fn(),
  },
  media: {
    generateUploadLink: vi.fn(),
    checkUploadStatus: vi.fn(),
  },
}));

// Now import buildServer AFTER the mock is registered.
const { buildServer } = await import("../src/server.js");
const { renderProfileConfig } = await import("../src/services/hermes/profile-config.js");
const { composeSoulMd } = await import("../src/services/pandora-prompt.js");

const ZERNIO_SECRET = "test-zernio-secret-1234567890";

describe("workspace POST → Zernio profile mint hook", () => {
  let app: FastifyInstance;
  let token: string;
  let subjectId: string;

  beforeAll(async () => {
    app = await buildServer();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetData();
    mockCreateProfile.mockReset();
    subjectId = crypto.randomUUID();
    token = await signTestToken({ sub: subjectId, email: `ws-${Date.now()}@desh.test` });
  });

  it("mints a Zernio profile asynchronously and stores zernio_profile_id", async () => {
    mockCreateProfile.mockResolvedValueOnce({ profileId: "prof_test_123", name: "WA Test", description: null });

    const res = await app.inject({
      method: "POST",
      url: "/workspaces",
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { name: "WA Test" },
    });
    expect(res.statusCode).toBe(201);
    const wsId = (res.json() as { id: string }).id;

    // Hook is fire-and-forget. Wait briefly for the async update.
    const db = getTestDb();
    let stored: string | null = null;
    for (let i = 0; i < 50; i++) {
      const rows = await db.select().from(workspaces).where(eq(workspaces.id, wsId)).limit(1);
      if (rows[0]?.zernioProfileId) {
        stored = rows[0].zernioProfileId;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(stored).toBe("prof_test_123");
    // Naming format includes user email + workspace name + short workspace
    // id, so an operator looking at the Zernio dashboard can disambiguate
    // workspaces with the same name across users.
    expect(mockCreateProfile).toHaveBeenCalledTimes(1);
    const callArg = mockCreateProfile.mock.calls[0]![0] as { name: string; description: string };
    expect(callArg.name).toMatch(/^ws-\d+@desh\.test · WA Test · #[0-9a-f]{8}$/);
    expect(callArg.description).toContain("Desh workspace");
    expect(callArg.description).toContain(`workspace_id=${wsId}`);
    expect(callArg.description).toContain("user_email=ws-");
  });

  it("does not block workspace creation when the Zernio mint throws", async () => {
    mockCreateProfile.mockRejectedValueOnce(
      new MockZernioApiError({ message: "upstream down", code: "upstream_unavailable" }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/workspaces",
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { name: "Resilient" },
    });
    expect(res.statusCode).toBe(201);
    const wsId = (res.json() as { id: string }).id;

    // Give the async block a moment to attempt and log the failure.
    await new Promise((r) => setTimeout(r, 100));
    const db = getTestDb();
    const rows = await db.select().from(workspaces).where(eq(workspaces.id, wsId)).limit(1);
    expect(rows[0]?.zernioProfileId).toBeNull();
  });
});

describe("zernio routes — auth + sending", () => {
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
    mockSendWhatsAppText.mockReset();
    mockSendWhatsAppTemplate.mockReset();
    mockListAccounts.mockReset();

    const db = getTestDb();
    const subjectId = crypto.randomUUID();
    const [user] = await db
      .insert(users)
      .values({ cognitoSub: subjectId, email: `z-${Date.now()}@desh.test` })
      .returning();
    userId = user!.id;
    const [ws] = await db
      .insert(workspaces)
      .values({
        name: "WA Workspace",
        createdBy: userId,
        zernioProfileId: "prof_seeded",
      })
      .returning();
    workspaceId = ws!.id;
    await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
    await db.insert(socialProfiles).values({
      workspaceId,
      userId,
      zernioProfileId: "prof_seeded",
      name: "WA Workspace",
    });
    const [profile] = await db.select().from(socialProfiles).where(eq(socialProfiles.workspaceId, workspaceId));
    await db.insert(socialAccounts).values({
      workspaceId,
      userId,
      socialProfileId: profile?.id ?? null,
      zernioAccountId: "acc_1",
      platform: "whatsapp",
      username: "+5511",
      status: "active",
      meta: {},
    });
    token = await signTestToken({ sub: subjectId, email: `z-${Date.now()}@desh.test` });
  });

  it("rejects send for non-members with 404", async () => {
    const db = getTestDb();
    const otherSub = crypto.randomUUID();
    const [other] = await db
      .insert(users)
      .values({ cognitoSub: otherSub, email: `o-${Date.now()}@desh.test` })
      .returning();
    const [otherWs] = await db
      .insert(workspaces)
      .values({ name: "Other", createdBy: other!.id })
      .returning();

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${otherWs!.id}/zernio/whatsapp/messages`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { kind: "text", accountId: "acc_x", to: "5511999887766", text: "hi" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("send-text happy path: returns messageId and inserts a success log", async () => {
    mockSendWhatsAppText.mockResolvedValueOnce({ messageId: "wamid.abc", raw: { ok: true } });

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/zernio/whatsapp/messages`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { kind: "text", accountId: "acc_1", to: "+55 (11) 99988-7766", text: "olá" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { ok: boolean; messageId: string; latencyMs: number };
    expect(body.ok).toBe(true);
    expect(body.messageId).toBe("wamid.abc");

    // Phone normalization: only digits make it to Zernio + the log.
    expect(mockSendWhatsAppText).toHaveBeenCalledWith({
      accountId: "acc_1",
      to: "5511999887766",
      text: "olá",
    });

    const db = getTestDb();
    const logs = await db.select().from(whatsappSendLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("success");
    expect(logs[0]!.zernioMessageId).toBe("wamid.abc");
    expect(logs[0]!.toPhone).toBe("5511999887766");
    expect(logs[0]!.messageType).toBe("text");
  });

  it("rejects sends for Zernio accounts outside the workspace", async () => {
    mockSendWhatsAppText.mockResolvedValueOnce({ messageId: "wamid.should-not-send", raw: { ok: true } });

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/zernio/whatsapp/messages`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { kind: "text", accountId: "acc_not_in_workspace", to: "5511999887766", text: "olá" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ error: "account_not_in_workspace" });
    expect(mockSendWhatsAppText).not.toHaveBeenCalled();

    const db = getTestDb();
    const logs = await db.select().from(whatsappSendLogs);
    expect(logs).toHaveLength(0);
  });

  it("send-text failure: persists the error code and returns 502", async () => {
    mockSendWhatsAppText.mockRejectedValueOnce(
      new MockZernioApiError({
        message: "rate limited",
        code: "rate_limited",
        status: 429,
        retryable: true,
      }),
    );

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/zernio/whatsapp/messages`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { kind: "text", accountId: "acc_1", to: "5511999887766", text: "olá" },
    });
    expect(res.statusCode).toBe(502);
    expect((res.json() as { code: string }).code).toBe("rate_limited");

    const db = getTestDb();
    const logs = await db.select().from(whatsappSendLogs);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("failed");
    expect(logs[0]!.errorCode).toBe("rate_limited");
  });

  it("sync-accounts upserts social_profiles + social_accounts", async () => {
    mockListAccounts.mockResolvedValueOnce([
      {
        zernioAccountId: "acc_wa_1",
        platform: "whatsapp",
        username: "+5511",
        avatarUrl: null,
        status: "active",
        meta: {},
      },
      {
        zernioAccountId: "acc_ig_1",
        platform: "instagram",
        username: "@brand",
        avatarUrl: null,
        status: "active",
        meta: {},
      },
    ]);

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/zernio/sync-accounts`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: {},
    });
    expect(res.statusCode).toBe(200);

    expect(mockListAccounts).toHaveBeenCalledWith({ profileId: "prof_seeded" });

    const db = getTestDb();
    const profiles = await db.select().from(socialProfiles);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.zernioProfileId).toBe("prof_seeded");

    const accounts = await db.select().from(socialAccounts);
    expect(accounts.map((a) => a.zernioAccountId).sort()).toEqual(["acc_1", "acc_ig_1", "acc_wa_1"]);
  });
});

describe("/zernio/webhook signature verification", () => {
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
    const [user] = await db
      .insert(users)
      .values({ cognitoSub: subjectId, email: `wh-${Date.now()}@desh.test` })
      .returning();
    userId = user!.id;
    const [ws] = await db
      .insert(workspaces)
      .values({ name: "WA WH", createdBy: userId, zernioProfileId: "prof_wh" })
      .returning();
    workspaceId = ws!.id;
    await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
    // Pre-insert a log row that the delivered event should match against.
    await db.insert(whatsappSendLogs).values({
      workspaceId,
      userId,
      accountId: "acc_1",
      toPhone: "5511999887766",
      messageType: "text",
      messagePreview: "olá",
      status: "success",
      zernioMessageId: "wamid.match",
    });
  });

  function hmacSign(body: object, ts?: number) {
    const tsStr = String(ts ?? Math.floor(Date.now() / 1000));
    const raw = JSON.stringify(body);
    const sig = createHmac("sha256", ZERNIO_SECRET).update(`${tsStr}.${raw}`).digest("hex");
    return { tsStr, raw, sig };
  }

  it("rejects requests without any signature with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/zernio/webhook",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ event: "webhook.test" }),
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects HMAC with a stale timestamp", async () => {
    const { tsStr, raw, sig } = hmacSign(
      { event: "message.delivered", data: { messageId: "wamid.match" } },
      Math.floor(Date.now() / 1000) - 10 * 60,
    );
    const res = await app.inject({
      method: "POST",
      url: "/zernio/webhook",
      headers: {
        "content-type": "application/json",
        "x-zernio-signature": sig,
        "x-zernio-signature-timestamp": tsStr,
      },
      payload: raw,
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts valid HMAC + advances delivery_status on message.delivered", async () => {
    const { tsStr, raw, sig } = hmacSign({
      event: "message.delivered",
      data: { messageId: "wamid.match", timestamp: new Date().toISOString() },
    });
    const res = await app.inject({
      method: "POST",
      url: "/zernio/webhook",
      headers: {
        "content-type": "application/json",
        "x-zernio-signature": sig,
        "x-zernio-signature-timestamp": tsStr,
      },
      payload: raw,
    });
    expect(res.statusCode).toBe(200);

    const db = getTestDb();
    const rows = await db
      .select()
      .from(whatsappSendLogs)
      .where(eq(whatsappSendLogs.zernioMessageId, "wamid.match"));
    expect(rows[0]!.deliveryStatus).toBe("delivered");
    expect(rows[0]!.deliveredAt).not.toBeNull();
  });

  it("accepts the legacy shared-secret fallback when no timestamp is present", async () => {
    // TODO remove fallback: once Zernio's HMAC scheme is confirmed against a
    // real test webhook, this branch can go.
    const res = await app.inject({
      method: "POST",
      url: "/zernio/webhook",
      headers: {
        "content-type": "application/json",
        "x-zernio-signature": ZERNIO_SECRET,
      },
      payload: JSON.stringify({ event: "webhook.test" }),
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { ok: boolean }).ok).toBe(true);
  });
});

describe("profile rendering — Zernio MCP and SKILL.md MUST NOT reach the agent", () => {
  // Tenancy regression guard: Zernio is keyed by a single shared API key,
  // so exposing its MCP to the agent leaks every workspace's connected
  // accounts. Zernio is now back-end-only; the agent reaches Zernio
  // capabilities exclusively through curated `social_*`/`whatsapp_*`/
  // `inbox_*` tools on the Desh MCP, where each handler injects
  // `profileId` from `workspaces.zernio_profile_id` server-side.
  let tmpRoot: string;
  let originalHome: string | undefined;

  beforeAll(async () => {
    tmpRoot = await mkdtemp(path.join(tmpdir(), "desh-zernio-prof-"));
    originalHome = process.env.HERMES_HOME_BASE;
    process.env.HERMES_HOME_BASE = tmpRoot;
  });
  afterAll(async () => {
    if (originalHome !== undefined) process.env.HERMES_HOME_BASE = originalHome;
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("never emits a zernio mcp block, ZERNIO_API_KEY, or SKILL.md, regardless of input", async () => {
    const profileName = "ws_no_zernio_in_agent";
    const result = await renderProfileConfig({
      hermesProfileName: profileName,
      workspaceId: "44444444-4444-4444-4444-444444444444",
      workspaceName: "Has Zernio Profile",
      hermesPort: 8767,
      adapterSecret: "ad-test",
      callbackSecret: "cb-test",
      modelId: "moonshotai/kimi-k2.6",
      systemPrompt: null,
      composioMcpUrl: "https://backend.composio.dev/v3/mcp/srv?user_id=ws_user",
    });

    const yaml = await readFile(result.configFilePath, "utf8");
    expect(yaml).toContain("composio:");
    expect(yaml).toContain("desh:");
    expect(yaml).not.toContain("zernio:");
    expect(yaml).not.toContain("mcp.zernio.com");

    const envFile = await readFile(result.envFilePath, "utf8");
    expect(envFile).not.toContain("ZERNIO_API_KEY=");
    expect(envFile).not.toMatch(/^ZERNIO_/m);

    const soul = await readFile(result.soulFilePath, "utf8");
    expect(soul).not.toContain("Skill: Zernio");
    expect(soul).not.toContain("zernio");

    const skillPath = path.join(result.hermesHome, "skills", "social-media", "zernio", "SKILL.md");
    let skillExists = false;
    try {
      await readFile(skillPath, "utf8");
      skillExists = true;
    } catch {
      // expected — file does not exist
    }
    expect(skillExists).toBe(false);
  });
});

describe("composeSoulMd — identity-only after skill extraction", () => {
  it("does not include any Zernio skill content in SOUL.md", () => {
    const soul = composeSoulMd("Workspace de e-commerce.");
    expect(soul).not.toContain("zernio");
    expect(soul).not.toContain("Skill: Zernio");
    expect(soul).not.toContain("REGRAS DE ESCOPO");
  });

  it("still appends user extension with the precedence clause", () => {
    const soul = composeSoulMd("Workspace de e-commerce.");
    expect(soul).toContain("Contexto Adicional");
    expect(soul).toContain("REGRA DE PRIORIDADE");
  });
});
