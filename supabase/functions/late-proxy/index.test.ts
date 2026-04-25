/**
 * Integration tests for `late-proxy` WhatsApp send pipeline.
 *
 * Two modes:
 *   1. MOCK (default) — stubs `globalThis.fetch` and the Supabase client to
 *      verify that a WhatsApp send through `/posts` deducts credits and returns
 *      the mocked `messageId`.
 *   2. LIVE (opt-in) — set `RUN_LIVE_WHATSAPP=1` plus `TEST_PHONE`, `TEST_ACCOUNT_ID`,
 *      `LATE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a real user
 *      JWT in `TEST_USER_JWT`. Hits the deployed function.
 *
 * Run via the test runner tool — these tests use --allow-net and --allow-env.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  WHATSAPP_POSTS_FIXTURES,
  type WhatsAppPostsFixture,
} from "../../../src/lib/whatsapp/postsFixtures.ts";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK MODE
// ─────────────────────────────────────────────────────────────────────────────

Deno.test({
  name: "mock: WhatsApp /posts deducts wa_message_send credit and returns messageId",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
  // Arrange env
  Deno.env.set("LATE_API_KEY", "test-late-key");
  Deno.env.set("SUPABASE_URL", Deno.env.get("VITE_SUPABASE_URL") ?? "http://localhost");
  Deno.env.set("SUPABASE_ANON_KEY", Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
  Deno.env.set("LATE_PROXY_TEST_MODE", "1");

  // Track upstream call + credit deduction
  let upstreamUrl = "";
  let upstreamBody: unknown = null;
  let creditCalls = 0;
  let lastCreditAction = "";
  const FAKE_MESSAGE_ID = "wamid.MOCKED_12345";

  // Build a syntactically valid JWT with sub claim — supabase-js falls back to
  // local decode when JWKS is unavailable.
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    sub: "00000000-0000-0000-0000-000000000001",
    email: "test@test.dev",
    aud: "authenticated",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  const FAKE_JWT = `${header}.${payload}.signature`;

  // Stub fetch — intercept Zernio + Supabase REST/RPC + Auth/JWKS
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    // Supabase JWKS — return empty keys so auth-js falls back to local decode
    if (url.includes("/.well-known/jwks.json") || url.includes("/auth/v1/jwks")) {
      return new Response(JSON.stringify({ keys: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Any other auth call — return ok
    if (url.includes("/auth/v1/")) {
      return new Response(
        JSON.stringify({ id: "00000000-0000-0000-0000-000000000001", email: "test@test.dev" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Supabase RPC consume_credits
    if (url.includes("/rest/v1/rpc/consume_credits")) {
      creditCalls++;
      try {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        lastCreditAction = body._action ?? "";
      } catch { /* noop */ }
      return new Response(JSON.stringify({ success: true, balance: 49 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Supabase REST: social_accounts lookup, log inserts, etc. — just return empty.
    if (url.includes("/rest/v1/social_accounts")) {
      return new Response(JSON.stringify([{ late_account_id: "test-account-id" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/rest/v1/whatsapp_proxy_logs")) {
      return new Response("[]", {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/rest/v1/social_subscriptions")) {
      return new Response(JSON.stringify({ status: "active" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Upstream Zernio /posts
    if (url.includes("zernio.com/api/v1/posts")) {
      upstreamUrl = url;
      try { upstreamBody = init?.body ? JSON.parse(init.body as string) : null; } catch { /* noop */ }
      return new Response(
        JSON.stringify({
          id: "post_mock_001",
          messageId: FAKE_MESSAGE_ID,
          platforms: [{ platform: "whatsapp", status: "sent", messageId: FAKE_MESSAGE_ID }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fallback: empty 200 to avoid breaking unrelated calls
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const { handleRequest } = await import("./index.ts");

    const req = new Request("http://localhost/late-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FAKE_JWT}`,
      },
      body: JSON.stringify({
        route: "/posts",
        method: "POST",
        body: {
          content: "Olá!",
          publishNow: true,
          platforms: [
            {
              platform: "whatsapp",
              accountId: "test-account-id",
              whatsappOptions: { to: "+15555550000", type: "text", text: "Olá!" },
            },
          ],
        },
      }),
    });

    const resp = await handleRequest(req);
    const text = await resp.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text); } catch { /* noop */ }

    // Assert: success
    assertEquals(resp.status, 200, `expected 200, got ${resp.status}: ${text}`);
    // Assert: credit deducted with the right action
    assert(creditCalls === 1, `expected 1 credit call, got ${creditCalls}`);
    assertEquals(lastCreditAction, "wa_message_send");
    // Assert: upstream URL is the canonical /posts route
    assert(upstreamUrl.includes("/api/v1/posts"), `unexpected upstream URL: ${upstreamUrl}`);
    // Assert: payload forwarded with whatsappOptions
    const platforms = (upstreamBody as { platforms?: Array<{ platform?: string }> } | null)
      ?.platforms ?? [];
    assert(platforms.some((p) => p.platform === "whatsapp"), "platforms[].whatsapp missing");
    // Assert: messageId returned to caller
    assertEquals(json.messageId, FAKE_MESSAGE_ID);
    } finally {
      globalThis.fetch = realFetch;
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PARAMETRIZED: /posts payload variations → expected credit action
// ─────────────────────────────────────────────────────────────────────────────

// Fixtures are the single source of truth — shared with the UI replay panel.
// See: src/lib/whatsapp/postsFixtures.ts
const POSTS_CASES: WhatsAppPostsFixture[] = WHATSAPP_POSTS_FIXTURES;

function buildFakeJwt(): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    sub: "00000000-0000-0000-0000-000000000001",
    email: "test@test.dev",
    aud: "authenticated",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  return `${header}.${payload}.signature`;
}

function installFetchStub(state: { creditCalls: number; lastAction: string }) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (url.includes("/.well-known/jwks.json") || url.includes("/auth/v1/jwks")) {
      return new Response(JSON.stringify({ keys: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/auth/v1/")) {
      return new Response(JSON.stringify({ id: "00000000-0000-0000-0000-000000000001" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/rest/v1/rpc/consume_credits")) {
      state.creditCalls++;
      try {
        const body = init?.body ? JSON.parse(init.body as string) : {};
        state.lastAction = body._action ?? "";
      } catch { /* noop */ }
      return new Response(JSON.stringify({ success: true, balance: 49 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/rest/v1/social_accounts")) {
      return new Response(JSON.stringify([
        { late_account_id: "test-account-id" },
        { late_account_id: "ig-acct" },
        { late_account_id: "fb-acct" },
      ]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/rest/v1/whatsapp_proxy_logs")) {
      return new Response("[]", { status: 201, headers: { "Content-Type": "application/json" } });
    }
    if (url.includes("/rest/v1/social_subscriptions")) {
      return new Response(JSON.stringify({ status: "active" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("zernio.com/api/v1/posts")) {
      return new Response(
        JSON.stringify({
          id: "post_mock_001",
          messageId: "wamid.MOCKED_PARAM",
          platforms: [{ platform: "whatsapp", status: "sent", messageId: "wamid.MOCKED_PARAM" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return realFetch;
}

for (const tc of POSTS_CASES) {
  Deno.test({
    name: `mock: /posts fixture [${tc.id}] — ${tc.label}`,
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
      Deno.env.set("LATE_API_KEY", "test-late-key");
      Deno.env.set("SUPABASE_URL", Deno.env.get("VITE_SUPABASE_URL") ?? "http://localhost");
      Deno.env.set("SUPABASE_ANON_KEY", Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "anon");
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
      Deno.env.set("LATE_PROXY_TEST_MODE", "1");

      const state = { creditCalls: 0, lastAction: "" };
      const realFetch = installFetchStub(state);
      try {
        const { handleRequest } = await import("./index.ts");
        const req = new Request("http://localhost/late-proxy", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${buildFakeJwt()}`,
          },
          body: JSON.stringify({ route: "/posts", method: "POST", body: tc.body }),
        });
        const resp = await handleRequest(req);
        const text = await resp.text();
        assertEquals(resp.status, 200, `expected 200, got ${resp.status}: ${text}`);

        if (tc.expectedAction === null) {
          assertEquals(state.creditCalls, 0, `expected 0 credit calls, got ${state.creditCalls}`);
        } else {
          assertEquals(state.creditCalls, 1, `expected 1 credit call, got ${state.creditCalls}`);
          assertEquals(
            state.lastAction,
            tc.expectedAction,
            `expected action "${tc.expectedAction}", got "${state.lastAction}"`,
          );
        }
      } finally {
        globalThis.fetch = realFetch;
      }
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE MODE (opt-in)
// ─────────────────────────────────────────────────────────────────────────────

Deno.test({
  name: "live: real WhatsApp send deducts credit and returns messageId",
  ignore: Deno.env.get("RUN_LIVE_WHATSAPP") !== "1",
  fn: async () => {
    const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const USER_JWT = Deno.env.get("TEST_USER_JWT")!;
    const TEST_PHONE = Deno.env.get("TEST_PHONE")!;
    const ACCOUNT_ID = Deno.env.get("TEST_ACCOUNT_ID")!;
    assert(SUPABASE_URL && SERVICE_ROLE && USER_JWT && TEST_PHONE && ACCOUNT_ID,
      "Missing live env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USER_JWT, TEST_PHONE, TEST_ACCOUNT_ID",
    );

    // Decode user_id from JWT
    const payload = JSON.parse(atob(USER_JWT.split(".")[1]));
    const userId = payload.sub as string;

    // Snapshot credit balance BEFORE
    const balRes = await fetch(`${SUPABASE_URL}/rest/v1/user_credits?user_id=eq.${userId}&select=balance`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    const balRows = await balRes.json() as Array<{ balance: number }>;
    const balanceBefore = balRows[0]?.balance ?? 0;

    // Invoke late-proxy
    const invokeRes = await fetch(`${SUPABASE_URL}/functions/v1/late-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${USER_JWT}`,
      },
      body: JSON.stringify({
        route: "/posts",
        method: "POST",
        body: {
          content: "Teste automatizado DESH",
          publishNow: true,
          platforms: [{
            platform: "whatsapp",
            accountId: ACCOUNT_ID,
            whatsappOptions: { to: TEST_PHONE, type: "text", text: "Teste automatizado DESH" },
          }],
        },
      }),
    });
    const text = await invokeRes.text();
    let json: Record<string, unknown> = {};
    try { json = JSON.parse(text); } catch { /* noop */ }

    assertEquals(invokeRes.status, 200, `live send failed (${invokeRes.status}): ${text}`);
    assert(
      typeof json.messageId === "string" || typeof json.id === "string",
      `expected messageId or id in response, got: ${text}`,
    );

    // Verify credit deducted
    const balRes2 = await fetch(`${SUPABASE_URL}/rest/v1/user_credits?user_id=eq.${userId}&select=balance`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    const balRows2 = await balRes2.json() as Array<{ balance: number }>;
    const balanceAfter = balRows2[0]?.balance ?? 0;
    assert(
      balanceAfter < balanceBefore,
      `expected credit deduction, balance ${balanceBefore} → ${balanceAfter}`,
    );
  },
});
