/**
 * E2E integration tests for the Late Inbox flow through `late-proxy`.
 *
 * Cobre os dois fluxos mais críticos do módulo Mensagens:
 *  1. `sendMessage`         → POST /inbox/conversations/:id/messages
 *  2. `updateConversation`  → PUT  /inbox/conversations/:id
 *
 * Garantias verificadas (camadas frontend → edge → upstream → frontend):
 *  - O helper de frontend (`buildLateInboxRequest`) produz a rota e o body
 *    exatos esperados pelo proxy (accountId em query E body).
 *  - A edge function `handleRequest` aceita o request, valida accountId,
 *    encaminha para `https://zernio.com/api/v1/...` com método correto,
 *    URL preservada e body forwardado intacto.
 *  - A resposta JSON da Late chega de volta ao chamador (frontend) sem
 *    mutação não esperada — confirmando que as camadas E2E estão alinhadas.
 *
 * Mock-based: nunca toca a Late real. Roda via `--allow-net --allow-env`.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildLateInboxRequest,
  lateInboxRoutes,
  validateSendMessagePayload,
  validateUpdateConversationPayload,
} from "../../../src/hooks/messages/lateInboxHelpers.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Test rig
// ─────────────────────────────────────────────────────────────────────────────

const ACCOUNT_ID = "acct_test_inbox_001";
const CONVO_ID = "late_conv_abc"; // prefixo `late_` deve ser removido
const STRIPPED_CONVO_ID = "conv_abc";

interface UpstreamCall {
  url: string;
  method: string;
  body: unknown;
}

function buildFakeJwt(): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      sub: "00000000-0000-0000-0000-000000000abc",
      email: "e2e@test.dev",
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.signature`;
}

/**
 * Install a fetch stub that:
 *  - Returns a valid Supabase auth/JWKS response (so JWT decode succeeds).
 *  - Returns the test ACCOUNT_ID as the only social_account for this user.
 *  - Captures the upstream call to zernio.com and returns `upstreamResponse`.
 */
function installFetchStub(
  upstreamResponse: { status: number; body: unknown },
): { restore: () => void; calls: UpstreamCall[] } {
  const calls: UpstreamCall[] = [];
  const realFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;
    const method = (init?.method ?? "GET").toUpperCase();

    // Supabase JWKS — empty keys forces local decode of the fake JWT.
    if (url.includes("/.well-known/jwks.json") || url.includes("/auth/v1/jwks")) {
      return new Response(JSON.stringify({ keys: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/auth/v1/")) {
      return new Response(
        JSON.stringify({
          id: "00000000-0000-0000-0000-000000000abc",
          email: "e2e@test.dev",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // social_accounts: this user owns ACCOUNT_ID.
    if (url.includes("/rest/v1/social_accounts")) {
      return new Response(
        JSON.stringify([{ late_account_id: ACCOUNT_ID }]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // social_subscriptions: active.
    if (url.includes("/rest/v1/social_subscriptions")) {
      return new Response(JSON.stringify({ status: "active" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Logging table — accept silently.
    if (url.includes("/rest/v1/whatsapp_proxy_logs")) {
      return new Response("[]", {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Upstream Late API — capture and respond with the configured body.
    if (url.includes("zernio.com/api/v1/")) {
      let parsedBody: unknown = null;
      try {
        parsedBody = init?.body ? JSON.parse(init.body as string) : null;
      } catch {
        parsedBody = null;
      }
      calls.push({ url, method, body: parsedBody });
      return new Response(JSON.stringify(upstreamResponse.body), {
        status: upstreamResponse.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fallback: never break unrelated calls.
    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  return { restore: () => (globalThis.fetch = realFetch), calls };
}

function setBaseEnv() {
  Deno.env.set("LATE_API_KEY", "test-late-key");
  Deno.env.set(
    "SUPABASE_URL",
    Deno.env.get("VITE_SUPABASE_URL") ?? "http://localhost",
  );
  Deno.env.set(
    "SUPABASE_ANON_KEY",
    Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "anon",
  );
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role");
  Deno.env.set("LATE_PROXY_TEST_MODE", "1");
}

// ─────────────────────────────────────────────────────────────────────────────
// E2E: sendMessage
// ─────────────────────────────────────────────────────────────────────────────

Deno.test({
  name: "e2e: sendMessage — frontend payload chega na upstream com accountId em query+body",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    setBaseEnv();

    // 1) Frontend monta o payload via helper compartilhado
    const messagePayload = { message: "Olá, integração E2E!" };
    const validated = validateSendMessagePayload(messagePayload);
    assert(validated.ok, "payload de send deve ser válido");

    const { route, body } = buildLateInboxRequest(
      lateInboxRoutes.sendMessage(CONVO_ID),
      ACCOUNT_ID,
      "POST",
      messagePayload,
    );

    // Sanity: helper já aplica as garantias estruturais
    assert(route.includes(`/inbox/conversations/${STRIPPED_CONVO_ID}/messages`));
    assert(
      route.includes(`accountId=${ACCOUNT_ID}`),
      `accountId ausente da query: ${route}`,
    );
    assertEquals((body as { accountId?: string }).accountId, ACCOUNT_ID);
    assertEquals((body as { message?: string }).message, "Olá, integração E2E!");

    // 2) Stub upstream: simula resposta da Late
    const upstream = {
      status: 200,
      body: {
        success: true,
        message: {
          id: "msg_e2e_001",
          conversationId: STRIPPED_CONVO_ID,
          text: "Olá, integração E2E!",
          status: "sent",
          createdAt: "2026-04-23T10:00:00Z",
        },
      },
    };
    const { restore, calls } = installFetchStub(upstream);

    try {
      // 3) Edge function processa o request como o frontend faria
      const { handleRequest } = await import("./index.ts");
      const req = new Request("http://localhost/late-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buildFakeJwt()}`,
        },
        body: JSON.stringify({ route, method: "POST", body }),
      });

      const resp = await handleRequest(req);
      const text = await resp.text();
      assertEquals(
        resp.status,
        200,
        `proxy deveria retornar 200, retornou ${resp.status}: ${text}`,
      );

      // 4) Verifica que a chamada upstream tem URL + body corretos
      assertEquals(calls.length, 1, "esperava 1 chamada à upstream");
      const upstreamCall = calls[0];
      assertEquals(upstreamCall.method, "POST");
      assert(
        upstreamCall.url.startsWith(
          `https://zernio.com/api/v1/inbox/conversations/${STRIPPED_CONVO_ID}/messages?`,
        ),
        `URL upstream inesperada: ${upstreamCall.url}`,
      );
      assert(
        upstreamCall.url.includes(`accountId=${ACCOUNT_ID}`),
        `accountId ausente da URL upstream: ${upstreamCall.url}`,
      );
      assertEquals(
        (upstreamCall.body as { message?: string; accountId?: string })?.message,
        "Olá, integração E2E!",
      );
      assertEquals(
        (upstreamCall.body as { accountId?: string })?.accountId,
        ACCOUNT_ID,
      );

      // 5) Resposta da upstream chega ao "frontend" sem mutação
      const json = JSON.parse(text) as {
        success?: boolean;
        message?: { id?: string; status?: string };
      };
      assertEquals(json.success, true);
      assertEquals(json.message?.id, "msg_e2e_001");
      assertEquals(json.message?.status, "sent");
    } finally {
      restore();
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// E2E: updateConversation
// ─────────────────────────────────────────────────────────────────────────────

Deno.test({
  name: "e2e: updateConversation — status 'read' propaga até a upstream e retorna ao frontend",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    setBaseEnv();

    const updatePayload = { status: "read" as const };
    const validated = validateUpdateConversationPayload(updatePayload);
    assert(validated.ok, "payload de update deve ser válido");

    const { route, body } = buildLateInboxRequest(
      lateInboxRoutes.updateConversation(CONVO_ID),
      ACCOUNT_ID,
      "PUT",
      updatePayload,
    );

    assert(route.includes(`/inbox/conversations/${STRIPPED_CONVO_ID}`));
    assert(route.includes(`accountId=${ACCOUNT_ID}`));
    assertEquals((body as { accountId?: string }).accountId, ACCOUNT_ID);
    assertEquals((body as { status?: string }).status, "read");

    const upstream = {
      status: 200,
      body: {
        success: true,
        conversation: {
          id: STRIPPED_CONVO_ID,
          status: "read",
          updatedAt: "2026-04-23T10:01:00Z",
        },
      },
    };
    const { restore, calls } = installFetchStub(upstream);

    try {
      const { handleRequest } = await import("./index.ts");
      const req = new Request("http://localhost/late-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buildFakeJwt()}`,
        },
        body: JSON.stringify({ route, method: "PUT", body }),
      });

      const resp = await handleRequest(req);
      const text = await resp.text();
      assertEquals(
        resp.status,
        200,
        `proxy deveria retornar 200, retornou ${resp.status}: ${text}`,
      );

      assertEquals(calls.length, 1);
      const upstreamCall = calls[0];
      assertEquals(upstreamCall.method, "PUT");
      assert(
        upstreamCall.url.startsWith(
          `https://zernio.com/api/v1/inbox/conversations/${STRIPPED_CONVO_ID}?`,
        ),
        `URL upstream inesperada: ${upstreamCall.url}`,
      );
      assert(upstreamCall.url.includes(`accountId=${ACCOUNT_ID}`));
      assertEquals(
        (upstreamCall.body as { status?: string; accountId?: string })?.status,
        "read",
      );
      assertEquals(
        (upstreamCall.body as { accountId?: string })?.accountId,
        ACCOUNT_ID,
      );

      const json = JSON.parse(text) as {
        success?: boolean;
        conversation?: { status?: string; id?: string };
      };
      assertEquals(json.success, true);
      assertEquals(json.conversation?.status, "read");
      assertEquals(json.conversation?.id, STRIPPED_CONVO_ID);
    } finally {
      restore();
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Negativos: garantia de que a guarda 400 também atua no fluxo E2E
// ─────────────────────────────────────────────────────────────────────────────

Deno.test({
  name: "e2e: sendMessage SEM accountId é rejeitado com 400 e nunca chega à upstream",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    setBaseEnv();
    const { restore, calls } = installFetchStub({ status: 200, body: {} });

    try {
      const { handleRequest } = await import("./index.ts");
      const req = new Request("http://localhost/late-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${buildFakeJwt()}`,
        },
        body: JSON.stringify({
          // Rota crua, SEM accountId em query nem body
          route: lateInboxRoutes.sendMessage(CONVO_ID),
          method: "POST",
          body: { message: "vai falhar" },
        }),
      });

      const resp = await handleRequest(req);
      const text = await resp.text();
      assertEquals(resp.status, 400, `esperava 400, recebeu ${resp.status}: ${text}`);
      const json = JSON.parse(text) as { code?: string };
      assertEquals(json.code, "missing_account_id");
      assertEquals(
        calls.length,
        0,
        "nenhuma chamada à upstream deveria ter ocorrido",
      );
    } finally {
      restore();
    }
  },
});
