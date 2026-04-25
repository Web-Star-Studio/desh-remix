#!/usr/bin/env node
/**
 * PWA Service Worker Smoke Test (production HTTPS URLs)
 * -----------------------------------------------------
 * Simulates what the browser does when registering a service worker:
 *
 *   1. Resolve the SW URL relative to the production origin (default: /sw.js).
 *   2. HEAD the URL — must return 200, must be served over HTTPS.
 *   3. GET the URL — must return JS content, non-empty, with Workbox markers.
 *   4. Verify the response headers a browser cares about:
 *        - Content-Type ≈ application/javascript (or text/javascript)
 *        - Service-Worker-Allowed (optional, only if scope is broader than path)
 *        - Cache-Control should NOT be 'immutable' or long-lived for sw.js
 *          (browsers expect the SW script to be revalidated frequently).
 *   5. HEAD the manifest too (/manifest.json) — must be reachable & JSON.
 *
 * Usage:
 *   PWA_PRODUCTION_URL="https://desh.life,https://www.desh.life" \
 *     node scripts/smoke-test-pwa-sw.mjs
 *
 * Optional env:
 *   PWA_SW_PATH          Override SW path (default: "/sw.js").
 *   PWA_MANIFEST_PATH    Override manifest path (default: "/manifest.json").
 *   PWA_SMOKE_REQUIRED   "1" to fail when PWA_PRODUCTION_URL is missing.
 *                        Defaults to "0" (skip with warning, useful for PRs
 *                        that haven't deployed yet).
 *   PWA_SMOKE_TIMEOUT_MS Per-request timeout in ms (default: 10000).
 */

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const errors = [];
const warnings = [];
const log = (m) => console.log(m);
const ok = (msg) => log(`${GREEN}✓${RESET} ${msg}`);
const err = (where, msg, hint) => errors.push({ where, msg, hint });
const warn = (where, msg) => warnings.push({ where, msg });

log(`${BOLD}━━ PWA Service Worker Smoke Test ━━${RESET}\n`);

const SW_PATH = process.env.PWA_SW_PATH || "/sw.js";
const MANIFEST_PATH = process.env.PWA_MANIFEST_PATH || "/manifest.json";
const REQUIRED = process.env.PWA_SMOKE_REQUIRED === "1";
const TIMEOUT_MS = Number.parseInt(process.env.PWA_SMOKE_TIMEOUT_MS ?? "10000", 10);
const MIN_SW_BYTES = 4 * 1024; // 4 KB — anything smaller is almost certainly a stub

const rawUrls = (process.env.PWA_PRODUCTION_URL || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (rawUrls.length === 0) {
  const message =
    "PWA_PRODUCTION_URL is not set — no production origins to smoke-test.";
  if (REQUIRED) {
    log(`${RED}${BOLD}✗ ${message}${RESET}`);
    process.exit(1);
  }
  log(`${YELLOW}⚠ ${message} (skipping; set PWA_SMOKE_REQUIRED=1 to enforce)${RESET}\n`);
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      redirect: "manual", // browsers treat redirects on sw.js as registration failures
      headers: {
        "User-Agent":
          "PWA-Smoke-Test/1.0 (+https://lovable.dev) Mozilla/5.0",
        Accept: init.method === "GET" ? "*/*" : "application/javascript",
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

function joinUrl(origin, path) {
  return new URL(path, origin).href;
}

function classifyContentType(ct) {
  if (!ct) return { ok: false, reason: "missing Content-Type" };
  const lower = ct.toLowerCase();
  if (
    lower.includes("application/javascript") ||
    lower.includes("text/javascript") ||
    lower.includes("application/x-javascript")
  ) {
    return { ok: true };
  }
  return { ok: false, reason: `unexpected Content-Type "${ct}"` };
}

function isHttps(u) {
  try { return new URL(u).protocol === "https:"; } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────
// Per-origin probe
// ─────────────────────────────────────────────────────────────────────
async function probeOrigin(origin) {
  log(`${CYAN}${BOLD}→ ${origin}${RESET}`);

  if (!isHttps(origin)) {
    err(
      origin,
      `Origin is not HTTPS — service workers cannot register on http:// origins.`,
      `Provide an https:// URL in PWA_PRODUCTION_URL.`
    );
    return;
  }
  ok(`Origin uses HTTPS`);

  const swUrl = joinUrl(origin, SW_PATH);
  const manifestUrl = joinUrl(origin, MANIFEST_PATH);

  // ── 1. HEAD sw.js ──────────────────────────────────────────────
  let headRes;
  try {
    headRes = await fetchWithTimeout(swUrl, { method: "HEAD" });
  } catch (e) {
    err(origin, `HEAD ${swUrl} failed: ${e.message}`);
    return;
  }

  if (headRes.status >= 300 && headRes.status < 400) {
    err(
      origin,
      `HEAD ${swUrl} returned redirect ${headRes.status} → "${headRes.headers.get("location") || "?"}". Browsers fail SW registration on redirects.`,
      `Serve sw.js directly at the requested path (no 301/302/308).`
    );
    return;
  }
  if (headRes.status === 405) {
    // Some CDNs reject HEAD; fall through to GET.
    warn(origin, `HEAD ${swUrl} returned 405 — falling back to GET.`);
  } else if (!headRes.ok) {
    err(
      origin,
      `HEAD ${swUrl} returned status ${headRes.status} ${headRes.statusText}.`,
      `Verify the build emitted dist/sw.js and your host is serving it at ${SW_PATH}.`
    );
    return;
  } else {
    ok(`HEAD ${SW_PATH} → 200`);
  }

  // ── 2. GET sw.js ───────────────────────────────────────────────
  let getRes;
  try {
    getRes = await fetchWithTimeout(swUrl, { method: "GET" });
  } catch (e) {
    err(origin, `GET ${swUrl} failed: ${e.message}`);
    return;
  }

  if (getRes.status >= 300 && getRes.status < 400) {
    err(
      origin,
      `GET ${swUrl} returned redirect ${getRes.status} — browsers reject this for SW scripts.`
    );
    return;
  }
  if (!getRes.ok) {
    err(origin, `GET ${swUrl} returned status ${getRes.status} ${getRes.statusText}.`);
    return;
  }

  const contentTypeCheck = classifyContentType(getRes.headers.get("content-type"));
  if (!contentTypeCheck.ok) {
    err(
      origin,
      `sw.js ${contentTypeCheck.reason}. Browsers refuse to register SWs without a JS MIME type.`,
      `Configure your host to serve .js with Content-Type: application/javascript.`
    );
  } else {
    ok(`Content-Type is JavaScript (${getRes.headers.get("content-type")})`);
  }

  // Cache-Control sanity (warn only — host-dependent)
  const cacheControl = getRes.headers.get("cache-control") || "";
  if (/immutable|max-age=\s*[1-9]\d{5,}/i.test(cacheControl)) {
    warn(
      origin,
      `sw.js Cache-Control "${cacheControl}" is very long-lived. Browsers may serve a stale SW; prefer no-cache or short max-age.`
    );
  }

  // Service-Worker-Allowed only matters when scope > script directory; informational.
  const swAllowed = getRes.headers.get("service-worker-allowed");
  if (swAllowed) ok(`Service-Worker-Allowed: ${swAllowed}`);

  // Body size + Workbox marker checks
  const buf = Buffer.from(await getRes.arrayBuffer());
  if (buf.length < MIN_SW_BYTES) {
    err(
      origin,
      `sw.js body is only ${buf.length} bytes (< ${MIN_SW_BYTES}). Likely a stub or upload failure.`
    );
    return;
  }
  ok(`sw.js body is ${buf.length.toLocaleString()} bytes`);

  const body = buf.toString("utf8");
  const hasPrecache = /precacheAndRoute|__WB_MANIFEST/.test(body);
  const hasWorkbox = /workbox/i.test(body) || /importScripts\s*\(/.test(body);
  if (!hasPrecache) {
    err(
      origin,
      `sw.js does not contain Workbox precache markers (precacheAndRoute/__WB_MANIFEST). Build may have produced an empty SW.`
    );
  } else {
    ok(`Workbox precache markers present`);
  }
  if (!hasWorkbox) {
    warn(origin, `sw.js does not reference workbox or importScripts — verify vite-plugin-pwa output.`);
  } else {
    ok(`Workbox runtime references present`);
  }

  // ── 3. Manifest reachability ───────────────────────────────────
  try {
    const mRes = await fetchWithTimeout(manifestUrl, { method: "GET" });
    if (!mRes.ok) {
      err(origin, `GET ${manifestUrl} returned ${mRes.status} ${mRes.statusText}.`);
    } else {
      const mCt = (mRes.headers.get("content-type") || "").toLowerCase();
      if (!mCt.includes("application/manifest+json") && !mCt.includes("application/json")) {
        warn(
          origin,
          `manifest.json Content-Type is "${mCt || "unknown"}" — expected application/manifest+json.`
        );
      }
      try {
        const json = JSON.parse(await mRes.text());
        if (!json.start_url || !json.icons) {
          err(origin, `manifest.json is missing required fields (start_url/icons).`);
        } else {
          ok(`manifest.json reachable and parseable`);
        }
      } catch (e) {
        err(origin, `manifest.json is not valid JSON: ${e.message}`);
      }
    }
  } catch (e) {
    err(origin, `GET ${manifestUrl} failed: ${e.message}`);
  }

  log("");
}

// ─────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────
for (const u of rawUrls) {
  // Normalize: accept bare host or full URL; ensure trailing path is dropped
  // (we want the origin so we can join /sw.js and /manifest.json).
  let origin;
  try {
    origin = new URL(u).origin;
  } catch {
    err(u, `Not a valid URL.`);
    continue;
  }
  await probeOrigin(origin);
}

if (warnings.length > 0) {
  log(`${YELLOW}${BOLD}⚠ ${warnings.length} warning(s):${RESET}`);
  warnings.forEach((w) => log(`  ${YELLOW}⚠${RESET} ${BOLD}${w.where}${RESET} — ${w.msg}`));
  log("");
}

if (errors.length > 0) {
  log(`${RED}${BOLD}✗ PWA SW smoke test FAILED with ${errors.length} error(s):${RESET}`);
  errors.forEach((e) => {
    log(`  ${RED}✗${RESET} ${BOLD}${e.where}${RESET} — ${e.msg}`);
    if (e.hint) log(`     ${CYAN}Hint: ${e.hint}${RESET}`);
  });
  log(`\n${RED}The deployed PWA would not register correctly in browsers.${RESET}`);
  process.exit(1);
}

log(`${GREEN}${BOLD}✓ Service worker is reachable and well-formed on all production URLs${RESET}\n`);
process.exit(0);
