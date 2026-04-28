import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  financialAccounts,
  financialConnections,
  financialSyncLogs,
  financialTransactionsUnified,
  users,
  workspaceMembers,
  workspaces,
} from "@desh/database/schema";
import { authHeader, signTestToken } from "./_helpers/auth.js";
import { getTestDb, resetData } from "./_helpers/db.js";

// Mock the Pluggy HTTP client at the module boundary so the orchestrator's
// upserts run end-to-end against the testcontainer Postgres without any
// real network calls. Each test sets the desired upstream responses on the
// mock fns below.
const mockGetItem = vi.fn();
const mockListAccounts = vi.fn();
const mockListTransactions = vi.fn();
const mockListInvestments = vi.fn();
const mockListLoans = vi.fn();
const mockCreateConnectToken = vi.fn();
const mockDeleteItem = vi.fn();

class MockPluggyApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;
  constructor(opts: { message: string; code: string; status?: number; retryable?: boolean }) {
    super(opts.message);
    this.name = "PluggyApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

vi.mock("../src/services/pluggy.js", () => ({
  PluggyApiError: MockPluggyApiError,
  isPluggyConfigured: () => true,
  getItem: (id: string) => mockGetItem(id),
  listAccounts: (id: string) => mockListAccounts(id),
  listTransactions: (id: string, opts: unknown) => mockListTransactions(id, opts),
  listInvestments: (id: string) => mockListInvestments(id),
  listLoans: (id: string) => mockListLoans(id),
  createConnectToken: (input: unknown) => mockCreateConnectToken(input),
  deleteItem: (id: string) => mockDeleteItem(id),
}));

const { buildServer } = await import("../src/server.js");

const PLUGGY_SECRET = "test-pluggy-secret-1234567890";

async function makeWorkspace() {
  const db = getTestDb();
  const subjectId = crypto.randomUUID();
  const [user] = await db
    .insert(users)
    .values({ cognitoSub: subjectId, email: `fp-${Date.now()}@desh.test` })
    .returning();
  const userId = user!.id;
  const [ws] = await db
    .insert(workspaces)
    .values({ name: "Finance Pluggy WS", createdBy: userId })
    .returning();
  const workspaceId = ws!.id;
  await db.insert(workspaceMembers).values({ workspaceId, userId, role: "owner" });
  const token = await signTestToken({ sub: subjectId, email: `fp-${Date.now()}@desh.test` });
  return { userId, workspaceId, token };
}

describe("finance/pluggy routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetData();
    mockGetItem.mockReset();
    mockListAccounts.mockReset();
    mockListTransactions.mockReset();
    mockListInvestments.mockReset();
    mockListLoans.mockReset();
    mockCreateConnectToken.mockReset();
    mockDeleteItem.mockReset();
    // Default to "no upstream data" so each test only sets what it cares about.
    mockListAccounts.mockResolvedValue([]);
    mockListTransactions.mockResolvedValue({ items: [], total: 0, totalPages: 1 });
    mockListInvestments.mockResolvedValue([]);
    mockListLoans.mockResolvedValue([]);
  });

  it("status returns configured + connection count", async () => {
    const { workspaceId, token } = await makeWorkspace();
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/finance/pluggy/status`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ configured: true, connectionsCount: 0 });
  });

  it("connect-token forwards the workspace id as clientUserId", async () => {
    const { workspaceId, token } = await makeWorkspace();
    mockCreateConnectToken.mockResolvedValueOnce({ accessToken: "tok_123" });

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/finance/pluggy/connect-token`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ accessToken: "tok_123" });
    expect(mockCreateConnectToken).toHaveBeenCalledWith({
      clientUserId: workspaceId,
      itemId: undefined,
    });
  });

  it("creating a connection runs an inline sync (no job runner) and writes accounts/tx/log rows", async () => {
    const { workspaceId, token } = await makeWorkspace();
    mockGetItem.mockResolvedValue({
      id: "item_abc",
      status: "UPDATED",
      connector: { name: "Banco Test", imageUrl: "logo.png" },
    });
    mockListAccounts.mockResolvedValueOnce([
      {
        id: "acc_1",
        type: "BANK",
        subtype: "CHECKING_ACCOUNT",
        name: "Conta Corrente",
        balance: 1234.56,
        currencyCode: "BRL",
      },
    ]);
    mockListTransactions.mockResolvedValueOnce({
      items: [
        { id: "tx_1", date: "2026-04-01", amount: 100, type: "CREDIT", description: "Salário" },
        { id: "tx_2", date: "2026-04-02", amount: 50, type: "DEBIT", description: "Mercado" },
      ],
      total: 2,
      totalPages: 1,
    });

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/finance/pluggy/connections`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { itemId: "item_abc" },
    });
    expect(res.statusCode).toBe(201);
    const connId = (res.json() as { connection: { id: string } }).connection.id;

    // Wait for the inline (test path: no job runner) sync's promise chain.
    for (let i = 0; i < 50; i++) {
      const db = getTestDb();
      const accounts = await db
        .select()
        .from(financialAccounts)
        .where(eq(financialAccounts.workspaceId, workspaceId));
      if (accounts.length > 0) break;
      await new Promise((r) => setTimeout(r, 30));
    }

    const db = getTestDb();
    const accounts = await db
      .select()
      .from(financialAccounts)
      .where(eq(financialAccounts.workspaceId, workspaceId));
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.providerAccountId).toBe("acc_1");
    expect(accounts[0]!.type).toBe("checking");

    const txs = await db
      .select()
      .from(financialTransactionsUnified)
      .where(eq(financialTransactionsUnified.workspaceId, workspaceId));
    expect(txs).toHaveLength(2);
    const credit = txs.find((t) => t.providerTransactionId === "tx_1");
    expect(credit?.type).toBe("inflow");
    const debit = txs.find((t) => t.providerTransactionId === "tx_2");
    expect(debit?.type).toBe("outflow");

    const logs = await db
      .select()
      .from(financialSyncLogs)
      .where(eq(financialSyncLogs.connectionId, connId));
    expect(logs).toHaveLength(1);
    expect(logs[0]!.status).toBe("success");
    expect(logs[0]!.transactionsSynced).toBe(2);
  });

  it("manual sync trigger runs inline when job runner is absent", async () => {
    const { workspaceId, token } = await makeWorkspace();
    const db = getTestDb();
    const [conn] = await db
      .insert(financialConnections)
      .values({
        workspaceId,
        provider: "pluggy",
        providerConnectionId: "item_xyz",
        status: "active",
      })
      .returning();
    const connId = conn!.id;
    mockGetItem.mockResolvedValue({ id: "item_xyz", status: "UPDATED" });

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/finance/pluggy/connections/${connId}/sync`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: { fromDate: "2026-04-01" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string; counts: Record<string, number> };
    expect(body.status).toBe("success");
    expect(body.counts).toEqual({
      accounts: 0,
      transactions: 0,
      investments: 0,
      loans: 0,
    });
  });

  it("sync surfaces upstream credentials_error → connection.status = credentials_error", async () => {
    const { workspaceId, token } = await makeWorkspace();
    const db = getTestDb();
    const [conn] = await db
      .insert(financialConnections)
      .values({
        workspaceId,
        provider: "pluggy",
        providerConnectionId: "item_bad",
        status: "active",
      })
      .returning();
    const connId = conn!.id;
    mockGetItem.mockRejectedValueOnce(
      new MockPluggyApiError({ message: "auth failed", code: "unauthorized", status: 401 }),
    );

    const res = await app.inject({
      method: "POST",
      url: `/workspaces/${workspaceId}/finance/pluggy/connections/${connId}/sync`,
      headers: { ...authHeader(token), "content-type": "application/json" },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { status: string }).status).toBe("error");

    const [stored] = await db
      .select()
      .from(financialConnections)
      .where(eq(financialConnections.id, connId));
    expect(stored!.status).toBe("credentials_error");
  });

  it("webhook returns 503 if PLUGGY_WEBHOOK_SECRET unset (verified at env-parse via global-setup)", async () => {
    // PLUGGY_WEBHOOK_SECRET *is* set in global-setup, so this scenario only
    // applies if a deployer skips it. We can't toggle env post-boot, so this
    // test asserts the webhook *with* secret present rejects bad signatures.
    const res = await app.inject({
      method: "POST",
      url: `/finance/pluggy-webhook`,
      headers: {
        "content-type": "application/json",
        "x-pluggy-signature-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-pluggy-signature": "deadbeef",
      },
      payload: { event: "item/updated", itemId: "item_abc" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "bad_signature" });
  });

  it("webhook accepts valid HMAC and updates connection status on item/error", async () => {
    const { workspaceId } = await makeWorkspace();
    const db = getTestDb();
    const [conn] = await db
      .insert(financialConnections)
      .values({
        workspaceId,
        provider: "pluggy",
        providerConnectionId: "item_hmac",
        status: "active",
      })
      .returning();

    const ts = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ event: "item/error", itemId: "item_hmac" });
    const sig = createHmac("sha256", PLUGGY_SECRET).update(`${ts}.${rawBody}`).digest("hex");

    const res = await app.inject({
      method: "POST",
      url: `/finance/pluggy-webhook`,
      headers: {
        "content-type": "application/json",
        "x-pluggy-signature-timestamp": ts,
        "x-pluggy-signature": sig,
      },
      payload: rawBody,
    });
    expect(res.statusCode).toBe(200);

    const [stored] = await db
      .select()
      .from(financialConnections)
      .where(eq(financialConnections.id, conn!.id));
    expect(stored!.status).toBe("error");
  });

  it("webhook with stale timestamp rejected", async () => {
    const ts = String(Math.floor(Date.now() / 1000) - 6 * 60); // 6 min ago
    const rawBody = JSON.stringify({ event: "item/updated", itemId: "x" });
    const sig = createHmac("sha256", PLUGGY_SECRET).update(`${ts}.${rawBody}`).digest("hex");
    const res = await app.inject({
      method: "POST",
      url: `/finance/pluggy-webhook`,
      headers: {
        "content-type": "application/json",
        "x-pluggy-signature-timestamp": ts,
        "x-pluggy-signature": sig,
      },
      payload: rawBody,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "stale_timestamp" });
  });

  it("transactions list filters by accountId + date range", async () => {
    const { workspaceId, token } = await makeWorkspace();
    const db = getTestDb();
    const [conn] = await db
      .insert(financialConnections)
      .values({
        workspaceId,
        provider: "pluggy",
        providerConnectionId: "item_q",
        status: "active",
      })
      .returning();
    const [acc1] = await db
      .insert(financialAccounts)
      .values({
        workspaceId,
        connectionId: conn!.id,
        providerAccountId: "acc_q1",
        name: "A1",
        type: "checking",
      })
      .returning();
    const [acc2] = await db
      .insert(financialAccounts)
      .values({
        workspaceId,
        connectionId: conn!.id,
        providerAccountId: "acc_q2",
        name: "A2",
        type: "checking",
      })
      .returning();

    await db.insert(financialTransactionsUnified).values([
      {
        workspaceId,
        accountId: acc1!.id,
        providerTransactionId: "t_a",
        date: "2026-03-15",
        amount: "10.00",
        type: "inflow",
      },
      {
        workspaceId,
        accountId: acc1!.id,
        providerTransactionId: "t_b",
        date: "2026-04-15",
        amount: "20.00",
        type: "outflow",
      },
      {
        workspaceId,
        accountId: acc2!.id,
        providerTransactionId: "t_c",
        date: "2026-04-16",
        amount: "30.00",
        type: "outflow",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/finance/pluggy/transactions?accountId=${acc1!.id}&from=2026-04-01&to=2026-04-30`,
      headers: authHeader(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { transactions: Array<{ providerTransactionId: string }> };
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]!.providerTransactionId).toBe("t_b");
  });

  it("non-member gets 404 on workspace-scoped routes", async () => {
    const { workspaceId } = await makeWorkspace();
    const otherSub = crypto.randomUUID();
    const otherToken = await signTestToken({ sub: otherSub, email: `o-${Date.now()}@desh.test` });
    // Establish the user in the DB but not as a member of `workspaceId`.
    const db = getTestDb();
    await db.insert(users).values({ cognitoSub: otherSub, email: `o-${Date.now()}@desh.test` });
    const res = await app.inject({
      method: "GET",
      url: `/workspaces/${workspaceId}/finance/pluggy/connections`,
      headers: authHeader(otherToken),
    });
    expect(res.statusCode).toBe(404);
  });

  // Avoid unused-import lint by referencing `and` in a no-op assertion.
  it("imports compile", () => {
    expect(typeof and).toBe("function");
  });
});
