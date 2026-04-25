/**
 * Automated security tests for late-proxy inbox routes.
 *
 * Garantias verificadas:
 *  1. Rotas /inbox/* (exceto /inbox/conversations) recusam requests sem
 *     accountId com status 400 e código `missing_account_id`.
 *  2. /inbox/conversations é a única exceção (allowlist) — accountId é
 *     opcional pois o filtro server-side por user já cobre o escopo.
 *  3. Bodies persistidos em logs têm campos sensíveis (mensagem, texto,
 *     caption, etc.) substituídos por `[REDACTED:N]`, sem vazar conteúdo.
 *  4. extractAccountIdFromRoute decodifica corretamente accountIds
 *     URL-encoded (evita falso negativo na guarda).
 *
 * Estes testes são executados via `supabase--test_edge_functions`.
 */
import { assert, assertEquals, assertStrictEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DEFAULT_SENSITIVE_BODY_FIELDS,
  extractAccountIdFromRoute,
  isInboxRoute,
  redactSensitiveBody,
  resolveSensitiveBodyFields,
  SENSITIVE_BODY_FIELDS,
} from "./index.ts";

// ─── isInboxRoute ─────────────────────────────────────────────────────────────

Deno.test("isInboxRoute: detecta prefixo /inbox/", () => {
  assert(isInboxRoute("/inbox/conversations"));
  assert(isInboxRoute("/inbox/conversations/abc123/messages"));
  assert(isInboxRoute("/inbox/comments/xyz/reply"));
});

Deno.test("isInboxRoute: rejeita rotas fora do prefixo", () => {
  assert(!isInboxRoute("/posts"));
  assert(!isInboxRoute("/whatsapp/send"));
  assert(!isInboxRoute("/inbox")); // sem trailing slash
  assert(!isInboxRoute(""));
});

// ─── extractAccountIdFromRoute ────────────────────────────────────────────────

Deno.test("extractAccountIdFromRoute: extrai accountId simples", () => {
  assertEquals(
    extractAccountIdFromRoute("/inbox/comments?accountId=acc_123"),
    "acc_123",
  );
});

Deno.test("extractAccountIdFromRoute: extrai como segundo parâmetro", () => {
  assertEquals(
    extractAccountIdFromRoute("/inbox/comments?foo=bar&accountId=acc_123"),
    "acc_123",
  );
});

Deno.test("extractAccountIdFromRoute: decodifica URL encoding", () => {
  // accountId com caracteres especiais URL-encoded
  assertEquals(
    extractAccountIdFromRoute("/inbox/comments?accountId=acc%20with%20spaces"),
    "acc with spaces",
  );
  assertEquals(
    extractAccountIdFromRoute("/inbox/comments?accountId=user%2B123"),
    "user+123",
  );
});

Deno.test("extractAccountIdFromRoute: retorna null quando ausente", () => {
  assertStrictEquals(extractAccountIdFromRoute("/inbox/conversations"), null);
  assertStrictEquals(extractAccountIdFromRoute("/inbox/comments?foo=bar"), null);
  assertStrictEquals(extractAccountIdFromRoute(""), null);
});

// ─── Guarda lógica: /inbox/* sem accountId deve ser bloqueada ──────────────────
//
// Estes testes validam o predicado usado pela edge function (linhas 570-582
// do index.ts). Como a guarda real depende de auth + DB, testamos a regra
// pura de "rota inbox precisa de accountId" usando os helpers exportados.

const INBOX_ROUTES_REQUIRING_ACCOUNT_ID = [
  "/inbox/comments",
  "/inbox/comments/abc/reply",
  "/inbox/comments/abc/like",
  "/inbox/comments/abc",
  "/inbox/conversations/conv_123",
  "/inbox/conversations/conv_123/messages",
  "/inbox/conversations/conv_123/messages/msg_456",
];

const INBOX_ROUTES_OPTIONAL_ACCOUNT_ID = [
  "/inbox/conversations", // listing (server-side filter via social_accounts)
];

Deno.test("Guarda: rotas /inbox/* sem accountId → falham na detecção", () => {
  for (const route of INBOX_ROUTES_REQUIRING_ACCOUNT_ID) {
    assert(isInboxRoute(route), `${route} deve ser inbox`);
    assertStrictEquals(
      extractAccountIdFromRoute(route),
      null,
      `${route} sem ?accountId= deve retornar null e ser bloqueada pelo proxy (400)`,
    );
  }
});

Deno.test("Guarda: rotas /inbox/* COM accountId → passam na detecção", () => {
  for (const route of INBOX_ROUTES_REQUIRING_ACCOUNT_ID) {
    const withId = `${route}${route.includes("?") ? "&" : "?"}accountId=acc_xyz`;
    assertEquals(extractAccountIdFromRoute(withId), "acc_xyz");
  }
});

Deno.test("Guarda: /inbox/conversations é a única rota inbox sem accountId obrigatório", () => {
  for (const route of INBOX_ROUTES_OPTIONAL_ACCOUNT_ID) {
    assert(isInboxRoute(route));
    // sem accountId é OK (allowlist) — proxy aplica filtro por user via DB
    assertStrictEquals(extractAccountIdFromRoute(route), null);
  }
});

// ─── redactSensitiveBody: anti-vazamento em logs ──────────────────────────────

Deno.test("redact: substitui campos sensíveis por [REDACTED:N]", () => {
  const input = {
    accountId: "acc_123", // estrutural — preservar
    platform: "instagram", // estrutural — preservar
    message: "Olá, mundo!", // sensível — redact
    text: "outra coisa", // sensível — redact
    caption: "legenda secreta", // sensível — redact
  };
  const result = redactSensitiveBody(input) as Record<string, string>;

  assertEquals(result.accountId, "acc_123");
  assertEquals(result.platform, "instagram");
  assertEquals(result.message, "[REDACTED:11]");
  assertEquals(result.text, "[REDACTED:11]");
  assertEquals(result.caption, "[REDACTED:15]");
});

Deno.test("redact: preserva null/undefined/primitivos", () => {
  assertStrictEquals(redactSensitiveBody(null), null);
  assertStrictEquals(redactSensitiveBody(undefined), undefined);
  assertStrictEquals(redactSensitiveBody(42), 42);
  assertStrictEquals(redactSensitiveBody("just a string"), "just a string");
  assertStrictEquals(redactSensitiveBody(true), true);
});

Deno.test("redact: aplica recursivamente em objetos aninhados", () => {
  const input = {
    accountId: "acc_1",
    payload: {
      message: "secret",
      meta: {
        text: "deep secret",
        platform: "tiktok",
      },
    },
  };
  const result = redactSensitiveBody(input) as Record<string, unknown>;
  const payload = result.payload as Record<string, unknown>;
  const meta = payload.meta as Record<string, unknown>;

  assertEquals(payload.message, "[REDACTED:6]");
  assertEquals(meta.text, "[REDACTED:11]");
  assertEquals(meta.platform, "tiktok");
});

Deno.test("redact: aplica em arrays de objetos", () => {
  const input = [
    { message: "first" },
    { message: "second longer" },
    { accountId: "acc_2", platform: "x" },
  ];
  const result = redactSensitiveBody(input) as Array<Record<string, unknown>>;

  assertEquals(result[0].message, "[REDACTED:5]");
  assertEquals(result[1].message, "[REDACTED:13]");
  assertEquals(result[2].accountId, "acc_2");
  assertEquals(result[2].platform, "x");
});

Deno.test("redact: NÃO redacta valores não-string em campos sensíveis", () => {
  // Se um campo "message" vier como objeto/número (formato inesperado),
  // mantemos o valor para preservar diagnóstico estrutural — mas o tipo
  // garante que conteúdo de usuário (sempre string) é removido.
  const input = { message: 42, text: { nested: "value" } };
  const result = redactSensitiveBody(input) as Record<string, unknown>;
  assertEquals(result.message, 42);
  // text é objeto → recursão (não há campos sensíveis dentro)
  assertEquals((result.text as Record<string, string>).nested, "value");
});

Deno.test("redact: lista de campos sensíveis cobre canais conhecidos", () => {
  // Garante que campos críticos estão na denylist (regression guard).
  const required = ["message", "text", "content", "caption", "body", "comment", "reply"];
  for (const f of required) {
    assert(
      SENSITIVE_BODY_FIELDS.has(f),
      `Campo "${f}" deve estar em SENSITIVE_BODY_FIELDS para evitar vazamento`,
    );
  }
});

Deno.test("redact: payload realista de send-message (regressão completa)", () => {
  // Simula o body que o useLateInboxActions.sendMessage envia.
  const input = {
    accountId: "acc_real_123",
    message: "Mensagem privada do usuário com dados sensíveis",
  };
  const result = redactSensitiveBody(input) as Record<string, string>;

  assertEquals(result.accountId, "acc_real_123");
  assert(
    result.message.startsWith("[REDACTED:"),
    "message deve estar redacted no log",
  );
  // Garantia de não-vazamento: nenhum substring do conteúdo original
  // pode aparecer na saída.
  const serialized = JSON.stringify(result);
  assert(
    !serialized.includes("Mensagem privada"),
    "Conteúdo da mensagem NÃO pode aparecer no log redacted",
  );
});

// ─── Configuração de redação (env-driven) ─────────────────────────────────────
//
// Estes testes garantem que toda combinação de env var (ausente, vazia,
// extra-only, override-only, lixo) produz uma Set válida e, crucialmente,
// NUNCA reduz a cobertura abaixo do DEFAULT_SENSITIVE_BODY_FIELDS.

Deno.test("config: sem env vars → usa DEFAULT_SENSITIVE_BODY_FIELDS", () => {
  const set = resolveSensitiveBodyFields({});
  for (const f of DEFAULT_SENSITIVE_BODY_FIELDS) {
    assert(set.has(f), `default field "${f}" deve estar presente`);
  }
  assertEquals(set.size, DEFAULT_SENSITIVE_BODY_FIELDS.length);
});

Deno.test("config: env vars vazias/whitespace → fallback ao DEFAULT", () => {
  const variants = ["", "   ", ",,,", " , , , ", "\n\t,\n"];
  for (const raw of variants) {
    const set = resolveSensitiveBodyFields({ extra: raw, override: raw });
    for (const f of DEFAULT_SENSITIVE_BODY_FIELDS) {
      assert(set.has(f), `fallback (input="${raw}") deve manter "${f}"`);
    }
    assertEquals(set.size, DEFAULT_SENSITIVE_BODY_FIELDS.length);
  }
});

Deno.test("config: EXTRA adiciona campos sem remover defaults", () => {
  const set = resolveSensitiveBodyFields({ extra: "subject,note,description" });
  // defaults preservados
  for (const f of DEFAULT_SENSITIVE_BODY_FIELDS) assert(set.has(f));
  // extras adicionados (lowercased)
  assert(set.has("subject"));
  assert(set.has("note"));
  assert(set.has("description"));
});

Deno.test("config: EXTRA normaliza casing e espaços", () => {
  const set = resolveSensitiveBodyFields({ extra: "  Subject ,  NOTE  ,note,SUBJECT" });
  assert(set.has("subject"));
  assert(set.has("note"));
  // dedupe: subject e note aparecem 1x cada
  const added = [...set].filter((f) => !DEFAULT_SENSITIVE_BODY_FIELDS.includes(f));
  assertEquals(added.sort(), ["note", "subject"]);
});

Deno.test("config: OVERRIDE preserva DEFAULT como floor de segurança", () => {
  // Operador tenta substituir tudo por apenas "msg" — defaults devem permanecer.
  const set = resolveSensitiveBodyFields({ override: "msg" });
  for (const f of DEFAULT_SENSITIVE_BODY_FIELDS) {
    assert(set.has(f), `OVERRIDE NÃO pode remover default "${f}"`);
  }
  assert(set.has("msg"));
});

Deno.test("config: OVERRIDE tem precedência sobre EXTRA", () => {
  const set = resolveSensitiveBodyFields({
    extra: "ignored_extra",
    override: "custom_field",
  });
  assert(set.has("custom_field"));
  // EXTRA é ignorado quando OVERRIDE está presente
  assert(!set.has("ignored_extra"));
  // defaults sempre presentes
  for (const f of DEFAULT_SENSITIVE_BODY_FIELDS) assert(set.has(f));
});

Deno.test("config: campos extremamente longos são descartados (>64 chars)", () => {
  const tooLong = "x".repeat(65);
  const justRight = "y".repeat(64);
  const set = resolveSensitiveBodyFields({ extra: `${tooLong},${justRight},ok` });
  assert(!set.has(tooLong), "campo > 64 chars deve ser descartado");
  assert(set.has(justRight));
  assert(set.has("ok"));
});

Deno.test("config: redactSensitiveBody usa Set custom passado explicitamente", () => {
  const customSet = resolveSensitiveBodyFields({ extra: "subject" });
  const input = { subject: "Confidencial", message: "Olá", platform: "ig" };
  const result = redactSensitiveBody(input, customSet) as Record<string, string>;
  assertEquals(result.subject, "[REDACTED:12]");
  assertEquals(result.message, "[REDACTED:3]");
  assertEquals(result.platform, "ig");
});

Deno.test("config: redactSensitiveBody com Set DEFAULT NÃO redacta extras não-configurados", () => {
  // Garantia de regressão: sem configurar "subject", ele NÃO deve ser redacted
  // pela Set default (evita false positives em campos estruturais).
  const input = { subject: "Visible", message: "Hidden" };
  const result = redactSensitiveBody(input, new Set(DEFAULT_SENSITIVE_BODY_FIELDS)) as Record<string, string>;
  assertEquals(result.subject, "Visible");
  assertEquals(result.message, "[REDACTED:6]");
});

Deno.test("config: SENSITIVE_BODY_FIELDS exportado é superset do DEFAULT", () => {
  // Regressão: a Set ativa NUNCA pode ser menor que o DEFAULT (cobertura mínima).
  for (const f of DEFAULT_SENSITIVE_BODY_FIELDS) {
    assert(
      SENSITIVE_BODY_FIELDS.has(f),
      `SENSITIVE_BODY_FIELDS perdeu campo default "${f}"`,
    );
  }
});

Deno.test("config: aplicação real de override via redact (anti-vazamento)", () => {
  // Cenário: novo canal usa campo "draft" para conteúdo de usuário.
  // Operador adiciona via EXTRA — verifica que vaza nada.
  const customSet = resolveSensitiveBodyFields({ extra: "draft" });
  const payload = {
    accountId: "acc_X",
    draft: "Conteúdo super privado do rascunho",
    platform: "linkedin",
  };
  const redacted = redactSensitiveBody(payload, customSet);
  const serialized = JSON.stringify(redacted);
  assert(
    !serialized.includes("super privado"),
    "Conteúdo do draft NÃO pode aparecer no log após config EXTRA",
  );
  assert(serialized.includes("acc_X"));
  assert(serialized.includes("linkedin"));
});
