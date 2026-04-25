/**
 * Reusable JSON fixtures for WhatsApp `/posts` payload variations.
 *
 * Single source of truth shared between:
 *   • UI: WhatsAppActionClassifier replay panel (test-mode, no real send)
 *   • Tests: supabase/functions/late-proxy/index.test.ts parametrized cases
 *
 * Each fixture documents the expected credit action so behaviour regressions
 * are obvious when the payload schema evolves. Whenever Zernio (or the late
 * proxy) changes how it interprets `/posts`, update the fixture + bump the
 * `schemaVersion` so callers can detect drift.
 *
 * Replay flow:
 *   1. Pick a fixture by `id`.
 *   2. POST `body` to the `__classify_action` dry-run route.
 *   3. Assert the returned `action` matches `expectedAction`.
 */

export type ExpectedAction = "wa_message_send" | "wa_broadcast_send" | null;

export type WhatsAppPostsFixtureCategory =
  | "message"
  | "template"
  | "media"
  | "broadcast"
  | "mixed"
  | "alias"
  | "edge";

export interface WhatsAppPostsFixture {
  /** Stable identifier (used for replay UI + test naming) */
  id: string;
  /** Short, human-friendly label */
  label: string;
  /** Bucket for grouping in UI / docs */
  category: WhatsAppPostsFixtureCategory;
  /** What the credit pipeline should pick — `null` = no charge */
  expectedAction: ExpectedAction;
  /** One-liner explaining what the fixture exercises */
  description: string;
  /** The JSON body sent to `/posts` (or `__classify_action` for dry-run) */
  body: Record<string, unknown>;
}

/** Bumped whenever the fixture set or schema changes shape. */
export const FIXTURES_SCHEMA_VERSION = "2026-04-22";

// ─── Shared classification helpers ─────────────────────────────────────────
// Mirrors `classifyPostsAction` in supabase/functions/late-proxy/index.ts so
// the UI (logs viewer, classifier panel) and the test suite stay in lock-step
// with the backend billing logic. NEVER duplicate these constants in
// components — always import from here so a single edit fixes every caller.

/** Canonical WhatsApp aliases (lowercased + alphanumeric only). */
export const WHATSAPP_PLATFORM_ALIASES = new Set([
  "whatsapp",
  "wa",
  "waba",
  "whatsappbusiness",
  "whatsappcloud",
  "whatsappcloudapi",
  "whatsappbusinessapi",
  "metawhatsapp",
]);

/** Normalize a free-form platform value to the canonical comparison token. */
export function normalizePlatformToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True when a platform string resolves to any WhatsApp alias. */
export function isWhatsAppPlatform(value: unknown): boolean {
  const token = normalizePlatformToken(value);
  return token !== null && WHATSAPP_PLATFORM_ALIASES.has(token);
}

/** Count distinct, non-empty recipients (array OR delimited string). */
export function countRecipients(value: unknown): number {
  if (value == null) return 0;
  if (Array.isArray(value)) {
    return value.filter(
      (v) => (typeof v === "string" && v.trim().length > 0) || (typeof v === "object" && v !== null),
    ).length;
  }
  if (typeof value === "string") {
    return value.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean).length;
  }
  return 0;
}

/** Payload-shape categories surfaced in the proxy logs viewer / replay UI. */
export type WhatsAppPayloadKind = "text" | "template" | "media" | "broadcast" | "other" | "n/a";

/**
 * Client-side payload-shape classifier — mirrors `classifyPostsAction` in the
 * late-proxy. Used by the logs viewer to filter rows even when the backend
 * `action` column is null (older logs / non-billed routes). Broadcast wins
 * over template/media/text since it's the billing-relevant signal.
 */
export function classifyWhatsAppPayloadKind(route: string, body: unknown): WhatsAppPayloadKind {
  if (!route.includes("/posts")) return "n/a";
  if (!body || typeof body !== "object") return "other";
  const root = body as Record<string, unknown>;

  const waOptions: Record<string, unknown>[] = [];
  if (Array.isArray(root.platforms)) {
    for (const entry of root.platforms) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      if (isWhatsAppPlatform(e.platform) && e.whatsappOptions && typeof e.whatsappOptions === "object") {
        waOptions.push(e.whatsappOptions as Record<string, unknown>);
      }
    }
  }
  if (root.whatsappOptions && typeof root.whatsappOptions === "object") {
    waOptions.push(root.whatsappOptions as Record<string, unknown>);
  }
  // Top-level WA without options (e.g. platform: "whatsapp" + recipients[])
  if (waOptions.length === 0 && !isWhatsAppPlatform(root.platform)) return "other";

  const isNonEmpty = (v: unknown) => typeof v === "string" && v.trim().length > 0;

  for (const o of waOptions) {
    if (isNonEmpty(o.broadcastId) || isNonEmpty(o.audienceId) || countRecipients(o.recipients) > 1) {
      return "broadcast";
    }
  }
  if (
    isNonEmpty(root.broadcastId) ||
    isNonEmpty(root.audienceId) ||
    countRecipients(root.recipients) > 1
  ) {
    return "broadcast";
  }

  for (const o of waOptions) {
    const type = typeof o.type === "string" ? o.type.toLowerCase() : "";
    if (type === "template" || (o.template && typeof o.template === "object")) return "template";
    if (
      ["image", "video", "audio", "document", "sticker"].includes(type) ||
      (o.media && typeof o.media === "object")
    ) {
      return "media";
    }
  }
  return "text";
}

/**
 * Lightweight client-side preview of which credit action would be charged for
 * a /posts payload — mirrors the backend without an extra round-trip. Use this
 * for instant UI feedback (e.g. logs viewer when action column is null).
 * For authoritative classification with detailed reasons, call the
 * `__classify_action` dry-run route on the late-proxy.
 */
export function previewCreditAction(body: unknown): "wa_message_send" | "wa_broadcast_send" | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const kind = classifyWhatsAppPayloadKind("/posts", root);
  if (kind === "n/a" || kind === "other") return null;
  return kind === "broadcast" ? "wa_broadcast_send" : "wa_message_send";
}

/** Stable test phone / account placeholders — keep consistent across fixtures. */
const TEST_PHONE = "+15555550000";
const TEST_ACCOUNT_ID = "test-account-id";

export const WHATSAPP_POSTS_FIXTURES: WhatsAppPostsFixture[] = [
  // ── Message variants ────────────────────────────────────────────────────────
  {
    id: "text-platforms",
    label: "Texto simples",
    category: "message",
    expectedAction: "wa_message_send",
    description: "Mensagem de texto via platforms[].whatsappOptions",
    body: {
      content: "Olá!",
      publishNow: true,
      platforms: [{
        platform: "whatsapp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { to: TEST_PHONE, type: "text", text: "Olá!" },
      }],
    },
  },
  {
    id: "template",
    label: "Template",
    category: "template",
    expectedAction: "wa_message_send",
    description: "Mensagem com template aprovado (welcome_v1 / pt_BR)",
    body: {
      publishNow: true,
      platforms: [{
        platform: "whatsapp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: {
          to: TEST_PHONE,
          type: "template",
          template: { name: "welcome_v1", language: "pt_BR" },
        },
      }],
    },
  },
  {
    id: "media-image",
    label: "Mídia (imagem)",
    category: "media",
    expectedAction: "wa_message_send",
    description: "Envio de imagem via URL pública",
    body: {
      publishNow: true,
      platforms: [{
        platform: "whatsapp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: {
          to: TEST_PHONE,
          type: "image",
          media: { url: "https://example.com/img.jpg" },
        },
      }],
    },
  },

  // ── Broadcast variants ──────────────────────────────────────────────────────
  {
    id: "broadcast-by-id",
    label: "Broadcast (broadcastId)",
    category: "broadcast",
    expectedAction: "wa_broadcast_send",
    description: "Envio massivo referenciando um broadcast pré-existente",
    body: {
      publishNow: true,
      platforms: [{
        platform: "whatsapp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { broadcastId: "bcast_123", type: "text", text: "Promo!" },
      }],
    },
  },
  {
    id: "broadcast-by-audience",
    label: "Broadcast (audienceId)",
    category: "broadcast",
    expectedAction: "wa_broadcast_send",
    description: "Envio segmentado por audiência salva",
    body: {
      publishNow: true,
      platforms: [{
        platform: "whatsapp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { audienceId: "aud_42", type: "text", text: "Anúncio!" },
      }],
    },
  },
  {
    id: "broadcast-recipients-array",
    label: "Broadcast (recipients[])",
    category: "broadcast",
    expectedAction: "wa_broadcast_send",
    description: "Múltiplos destinatários em array — vira broadcast",
    body: {
      publishNow: true,
      platforms: [{
        platform: "whatsapp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: {
          type: "text",
          text: "Massivo",
          recipients: ["+15555550001", "+15555550002", "+15555550003"],
        },
      }],
    },
  },
  {
    id: "broadcast-recipients-csv",
    label: "Broadcast (recipients string)",
    category: "broadcast",
    expectedAction: "wa_broadcast_send",
    description: "Recipients como string separada por vírgula",
    body: {
      publishNow: true,
      platforms: [{
        platform: "whatsapp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: {
          type: "text",
          text: "Massivo",
          recipients: "+15555550001,+15555550002,+15555550003",
        },
      }],
    },
  },
  {
    id: "single-recipient-not-broadcast",
    label: "Recipient único (não-broadcast)",
    category: "broadcast",
    expectedAction: "wa_message_send",
    description: "Apenas 1 entrada em recipients[] não dispara broadcast",
    body: {
      publishNow: true,
      platforms: [{
        platform: "whatsapp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { recipients: [TEST_PHONE], type: "text", text: "Olá" },
      }],
    },
  },

  // ── Mixed-platform variants ────────────────────────────────────────────────
  {
    id: "mixed-wa-instagram",
    label: "Mistura (WA + Instagram)",
    category: "mixed",
    expectedAction: "wa_message_send",
    description: "Cross-post com WhatsApp 1:1 + Instagram (cobra apenas WA)",
    body: {
      content: "Cross-post",
      publishNow: true,
      platforms: [
        { platform: "instagram", accountId: "ig-acct" },
        {
          platform: "whatsapp",
          accountId: TEST_ACCOUNT_ID,
          whatsappOptions: { to: TEST_PHONE, type: "text", text: "Cross-post" },
        },
      ],
    },
  },
  {
    id: "mixed-broadcast-facebook",
    label: "Mistura (broadcast + Facebook)",
    category: "mixed",
    expectedAction: "wa_broadcast_send",
    description: "WA broadcast cross-postado com Facebook",
    body: {
      content: "Mega",
      publishNow: true,
      platforms: [
        { platform: "facebook", accountId: "fb-acct" },
        {
          platform: "whatsapp",
          accountId: TEST_ACCOUNT_ID,
          whatsappOptions: { broadcastId: "bcast_999", type: "text", text: "Mega" },
        },
      ],
    },
  },
  {
    id: "instagram-only",
    label: "Sem WhatsApp (IG only)",
    category: "mixed",
    expectedAction: null,
    description: "Payload sem WhatsApp — não deve cobrar crédito",
    body: {
      content: "Apenas IG",
      publishNow: true,
      platforms: [{ platform: "instagram", accountId: "ig-acct" }],
    },
  },

  // ── Top-level fallbacks ────────────────────────────────────────────────────
  {
    id: "top-level-wa",
    label: "Top-level whatsappOptions",
    category: "message",
    expectedAction: "wa_message_send",
    description: "Sem array platforms[] — usa platform + whatsappOptions no topo",
    body: {
      publishNow: true,
      platform: "whatsapp",
      whatsappOptions: { to: TEST_PHONE, type: "text", text: "Top-level" },
    },
  },
  {
    id: "top-level-broadcast",
    label: "Top-level recipients (broadcast)",
    category: "broadcast",
    expectedAction: "wa_broadcast_send",
    description: "Recipients no topo do payload com múltiplos números",
    body: {
      publishNow: true,
      platform: "whatsapp",
      whatsappOptions: { type: "text", text: "Hi" },
      recipients: ["+15555550001", "+15555550002"],
    },
  },

  // ── Aliases & normalização ────────────────────────────────────────────────
  {
    id: "alias-camelcase",
    label: "Alias: WhatsApp (CamelCase)",
    category: "alias",
    expectedAction: "wa_message_send",
    description: "Aceita variações de capitalização do nome da plataforma",
    body: {
      publishNow: true,
      platforms: [{
        platform: "WhatsApp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { to: TEST_PHONE, type: "text", text: "Olá" },
      }],
    },
  },
  {
    id: "alias-uppercase-business",
    label: "Alias: WHATSAPP_BUSINESS",
    category: "alias",
    expectedAction: "wa_message_send",
    description: "Aceita o nome canônico em caixa alta",
    body: {
      publishNow: true,
      platforms: [{
        platform: "WHATSAPP_BUSINESS",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { to: TEST_PHONE, type: "text", text: "Olá" },
      }],
    },
  },
  {
    id: "alias-wa-shorthand",
    label: "Alias: 'wa' (shorthand)",
    category: "alias",
    expectedAction: "wa_message_send",
    description: "Aceita o atalho 'wa' como sinônimo",
    body: {
      publishNow: true,
      platforms: [{
        platform: "wa",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { to: TEST_PHONE, type: "text", text: "Olá" },
      }],
    },
  },
  {
    id: "alias-hyphenated",
    label: "Alias: 'whats-app'",
    category: "alias",
    expectedAction: "wa_message_send",
    description: "Aceita variações com hífen",
    body: {
      publishNow: true,
      platforms: [{
        platform: "Whats-App",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { to: TEST_PHONE, type: "text", text: "Olá" },
      }],
    },
  },
  {
    id: "alias-waba-top-level",
    label: "Alias: 'WABA' top-level",
    category: "alias",
    expectedAction: "wa_message_send",
    description: "Sigla WABA no campo platform de topo",
    body: {
      publishNow: true,
      platform: "WABA",
      whatsappOptions: { to: TEST_PHONE, type: "text", text: "Olá" },
    },
  },
  {
    id: "alias-whitespace",
    label: "Alias: whitespace",
    category: "alias",
    expectedAction: "wa_message_send",
    description: "Espaços em volta do nome da plataforma são ignorados",
    body: {
      publishNow: true,
      platforms: [{
        platform: "  whatsapp  ",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { to: TEST_PHONE, type: "text", text: "Olá" },
      }],
    },
  },

  // ── Edge cases / robustez ──────────────────────────────────────────────────
  {
    id: "edge-empty-broadcast-id",
    label: "Edge: broadcastId vazio",
    category: "edge",
    expectedAction: "wa_message_send",
    description: "broadcastId em branco não deve disparar broadcast",
    body: {
      publishNow: true,
      platforms: [{
        platform: "whatsapp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { broadcastId: "   ", type: "text", text: "Olá" },
      }],
    },
  },
  {
    id: "edge-empty-audience-id",
    label: "Edge: audienceId vazio",
    category: "edge",
    expectedAction: "wa_message_send",
    description: "audienceId em string vazia não deve disparar broadcast",
    body: {
      publishNow: true,
      platforms: [{
        platform: "whatsapp",
        accountId: TEST_ACCOUNT_ID,
        whatsappOptions: { audienceId: "", type: "text", text: "Olá" },
      }],
    },
  },
  {
    id: "edge-null-options",
    label: "Edge: whatsappOptions=null",
    category: "edge",
    expectedAction: "wa_message_send",
    description: "Tolera whatsappOptions nulo desde que platform=whatsapp",
    body: {
      publishNow: true,
      platforms: [{ platform: "whatsapp", accountId: TEST_ACCOUNT_ID, whatsappOptions: null }],
    },
  },
  {
    id: "edge-null-platform-entry",
    label: "Edge: entrada nula em platforms[]",
    category: "edge",
    expectedAction: "wa_message_send",
    description: "Ignora entradas nulas e detecta a plataforma WhatsApp restante",
    body: {
      publishNow: true,
      platforms: [
        null,
        {
          platform: "whatsapp",
          accountId: TEST_ACCOUNT_ID,
          whatsappOptions: { to: TEST_PHONE, type: "text", text: "Hi" },
        },
      ],
    },
  },
  {
    id: "edge-platforms-not-array",
    label: "Edge: platforms não é array",
    category: "edge",
    expectedAction: null,
    description: "platforms como objeto único não conta como envio",
    body: {
      publishNow: true,
      platforms: { platform: "whatsapp" },
    },
  },
  {
    id: "edge-empty-recipients-string",
    label: "Edge: recipients string vazia",
    category: "edge",
    expectedAction: "wa_message_send",
    description: "Recipients vazia no topo não deve virar broadcast",
    body: {
      publishNow: true,
      platform: "whatsapp",
      whatsappOptions: { type: "text", text: "Hi" },
      recipients: "",
    },
  },
];

/** Lookup helper used by the UI replay panel. */
export function getFixtureById(id: string): WhatsAppPostsFixture | undefined {
  return WHATSAPP_POSTS_FIXTURES.find((f) => f.id === id);
}

/** Group fixtures for sectioned UI rendering. */
export function groupFixturesByCategory(): Record<WhatsAppPostsFixtureCategory, WhatsAppPostsFixture[]> {
  const grouped = {
    message: [],
    template: [],
    media: [],
    broadcast: [],
    mixed: [],
    alias: [],
    edge: [],
  } as Record<WhatsAppPostsFixtureCategory, WhatsAppPostsFixture[]>;
  for (const f of WHATSAPP_POSTS_FIXTURES) grouped[f.category].push(f);
  return grouped;
}
