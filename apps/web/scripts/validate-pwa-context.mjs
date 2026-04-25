#!/usr/bin/env node
/**
 * PWA Context Validation
 * ----------------------
 * Validates that the PWA is configured to actually work in the production
 * runtime context. PWAs have hard browser requirements that don't surface as
 * build errors but break installability and offline mode silently.
 *
 * Checks:
 *   1. Production URLs are HTTPS (service workers require secure context).
 *   2. Manifest `scope` and `start_url` are coherent and within the served origin.
 *   3. start_url is reachable under scope (no path mismatch).
 *   4. index.html actually links to /manifest.json with rel="manifest".
 *   5. vite-plugin-pwa registration guards against preview/iframe contexts
 *      (a Lovable-specific hardening rule we've already enforced in code).
 *   6. SW navigateFallbackDenylist excludes auth callback paths.
 *
 * Usage:
 *   node scripts/validate-pwa-context.mjs
 *
 * Optional env vars:
 *   PWA_PRODUCTION_URL   Comma-separated production URLs to verify HTTPS
 *                        (default: derived from project_urls in CI or skipped).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

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

log(`${BOLD}━━ PWA Context Validation ━━${RESET}\n`);

// ─────────────────────────────────────────────────────────────────────
// 1. Manifest exists and parses
// ─────────────────────────────────────────────────────────────────────
const manifestPath = resolve(projectRoot, "public/manifest.json");
if (!existsSync(manifestPath)) {
  log(`${RED}${BOLD}✗ public/manifest.json not found.${RESET}`);
  process.exit(1);
}
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  log(`${RED}${BOLD}✗ Manifest is not valid JSON: ${e.message}${RESET}`);
  process.exit(1);
}
ok("Manifest parsed");

// ─────────────────────────────────────────────────────────────────────
// 2. start_url and scope are coherent
// ─────────────────────────────────────────────────────────────────────
const startUrl = manifest.start_url ?? "/";
const scope = manifest.scope ?? "/";

function isAbsolute(u) { return /^https?:\/\//i.test(u); }

if (!startUrl.startsWith("/") && !isAbsolute(startUrl)) {
  err("start_url", `"${startUrl}" must start with "/" or be a full HTTPS URL.`);
} else {
  ok(`start_url: ${YELLOW}"${startUrl}"${RESET}`);
}

if (!scope.startsWith("/") && !isAbsolute(scope)) {
  err("scope", `"${scope}" must start with "/" or be a full HTTPS URL.`);
} else {
  ok(`scope: ${YELLOW}"${scope}"${RESET}`);
}

// start_url must be within scope
function pathOf(u) {
  if (isAbsolute(u)) {
    try { return new URL(u).pathname; } catch { return u; }
  }
  return u;
}
const startPath = pathOf(startUrl);
const scopePath = pathOf(scope);
if (!startPath.startsWith(scopePath)) {
  err(
    "start_url",
    `start_url "${startPath}" is outside scope "${scopePath}". Browser will refuse to register the PWA.`,
    `Set scope to "/" or change start_url to begin with "${scopePath}".`
  );
} else {
  ok(`start_url is within scope`);
}

// Production HTTPS requirement (manifest has absolute URL)
if (isAbsolute(startUrl) && !startUrl.startsWith("https://")) {
  err(
    "start_url",
    `Absolute start_url uses non-HTTPS scheme: "${startUrl}". Service workers require HTTPS in production.`
  );
}
if (isAbsolute(scope) && !scope.startsWith("https://")) {
  err(
    "scope",
    `Absolute scope uses non-HTTPS scheme: "${scope}". Service workers require HTTPS in production.`
  );
}

// display value relevant for installability
if (manifest.display && !["standalone", "fullscreen", "minimal-ui"].includes(manifest.display)) {
  warn(
    "display",
    `"${manifest.display}" — only standalone/fullscreen/minimal-ui trigger the install prompt.`
  );
} else if (manifest.display) {
  ok(`display: ${YELLOW}"${manifest.display}"${RESET} (installable)`);
}

// ─────────────────────────────────────────────────────────────────────
// 3. index.html links the manifest (must be exactly one, with expected href)
// ─────────────────────────────────────────────────────────────────────
const EXPECTED_MANIFEST_HREF = "/manifest.json";

const indexPath = resolve(projectRoot, "index.html");
if (!existsSync(indexPath)) {
  err("index.html", "File not found in project root.");
} else {
  const html = readFileSync(indexPath, "utf8");
  // Match every <link ... rel="manifest" ...> tag (rel attribute can appear in any position)
  const manifestLinkRegex = /<link\b[^>]*\brel\s*=\s*["']manifest["'][^>]*>/gi;
  const manifestLinks = html.match(manifestLinkRegex) || [];

  if (manifestLinks.length === 0) {
    err(
      "index.html",
      `Missing <link rel="manifest" href="${EXPECTED_MANIFEST_HREF}"> tag. The browser will not discover the manifest.`,
      `Add exactly one tag inside <head>: <link rel="manifest" href="${EXPECTED_MANIFEST_HREF}" />`
    );
  } else if (manifestLinks.length > 1) {
    err(
      "index.html",
      `Found ${manifestLinks.length} <link rel="manifest"> tags — exactly 1 is required. Browsers may pick an unintended manifest.`,
      `Keep only one tag in <head>: <link rel="manifest" href="${EXPECTED_MANIFEST_HREF}" />. Duplicates found:\n     ${manifestLinks.map((t, i) => `${i + 1}. ${t}`).join("\n     ")}`
    );
  } else {
    const tag = manifestLinks[0];
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    const href = hrefMatch?.[1];

    if (!href) {
      err(
        "index.html",
        `<link rel="manifest"> tag is missing the href attribute.`,
        `Use: <link rel="manifest" href="${EXPECTED_MANIFEST_HREF}" />`
      );
    } else if (href !== EXPECTED_MANIFEST_HREF) {
      err(
        "index.html",
        `Manifest link href is "${href}" — expected exactly "${EXPECTED_MANIFEST_HREF}".`,
        `Update the tag to: <link rel="manifest" href="${EXPECTED_MANIFEST_HREF}" />`
      );
    } else {
      ok(`index.html links manifest at ${YELLOW}"${href}"${RESET} (exactly 1 tag)`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. vite.config.ts: VitePWA must NOT enable devOptions in production AND
//    must include navigateFallbackDenylist for auth routes.
// ─────────────────────────────────────────────────────────────────────
const viteCfgPath = resolve(projectRoot, "vite.config.ts");
if (!existsSync(viteCfgPath)) {
  warn("vite.config.ts", "Not found — skipping PWA plugin config audit.");
} else {
  const cfg = readFileSync(viteCfgPath, "utf8");

  if (!/VitePWA\s*\(/.test(cfg)) {
    err("vite.config.ts", "VitePWA(...) is not registered in the plugins array.");
  } else {
    ok("vite.config.ts registers VitePWA(...)");
  }

  // devOptions.enabled true would cause the SW to register inside the
  // Lovable preview iframe and break HMR/cache.
  const devOptsMatch = cfg.match(/devOptions\s*:\s*\{[^}]*\}/);
  if (devOptsMatch && /enabled\s*:\s*true/.test(devOptsMatch[0])) {
    err(
      "vite.config.ts",
      "devOptions.enabled is true — service worker will activate in dev/preview iframes and break HMR.",
      "Set devOptions.enabled = false."
    );
  } else {
    ok("VitePWA devOptions does not enable SW in development");
  }

  if (!/navigateFallbackDenylist/.test(cfg)) {
    warn(
      "vite.config.ts",
      "workbox.navigateFallbackDenylist not configured — OAuth callbacks may be intercepted by the SW."
    );
  } else {
    ok("workbox.navigateFallbackDenylist is configured");
  }
}

// ─────────────────────────────────────────────────────────────────────
// 5. src/main.tsx: registration must guard against iframe + preview hosts
// ─────────────────────────────────────────────────────────────────────
const mainPath = resolve(projectRoot, "src/main.tsx");
if (!existsSync(mainPath)) {
  warn("src/main.tsx", "Not found — skipping registration guard audit.");
} else {
  const mainSrc = readFileSync(mainPath, "utf8");
  const hasIframeGuard = /window\.self\s*!==\s*window\.top|isInIframe/.test(mainSrc);
  const hasPreviewGuard = /id-preview--|lovableproject\.com|isPreviewHost/.test(mainSrc);
  const hasSecureGuard = /isSecureContext|location\.protocol/.test(mainSrc);

  if (!hasIframeGuard) {
    err(
      "src/main.tsx",
      "Service worker registration is not guarded against iframe contexts.",
      "Add a `window.self !== window.top` check before calling registerSW()."
    );
  } else {
    ok("src/main.tsx guards against iframe contexts");
  }
  if (!hasPreviewGuard) {
    err(
      "src/main.tsx",
      "Service worker registration is not guarded against Lovable preview hosts.",
      "Skip registerSW() when window.location.hostname includes id-preview-- or lovableproject.com."
    );
  } else {
    ok("src/main.tsx guards against Lovable preview hosts");
  }
  if (!hasSecureGuard) {
    warn(
      "src/main.tsx",
      "No explicit isSecureContext / HTTPS check before SW registration. Browser will silently no-op on HTTP."
    );
  } else {
    ok("src/main.tsx checks secure context / protocol before registering");
  }
}

// ─────────────────────────────────────────────────────────────────────
// 6. Production URLs must be HTTPS (when provided)
// ─────────────────────────────────────────────────────────────────────
const prodUrlsRaw = process.env.PWA_PRODUCTION_URL || "";
const prodUrls = prodUrlsRaw.split(",").map((s) => s.trim()).filter(Boolean);

if (prodUrls.length === 0) {
  warn(
    "production URLs",
    "PWA_PRODUCTION_URL env not set — skipped HTTPS scheme check on deployed origins."
  );
} else {
  const validProdOrigins = [];
  for (const u of prodUrls) {
    let parsed;
    try { parsed = new URL(u); } catch {
      err("production URLs", `"${u}" is not a valid URL.`);
      continue;
    }
    if (parsed.protocol !== "https:") {
      err(
        "production URLs",
        `"${u}" is not HTTPS. Service workers will refuse to register.`
      );
      continue;
    }
    ok(`Production URL is HTTPS: ${YELLOW}${u}${RESET}`);
    validProdOrigins.push(parsed);
  }

  // ─────────────────────────────────────────────────────────────────
  // 6b. Cross-check manifest start_url & scope against PWA_PRODUCTION_URL.
  //     Goals:
  //       - If start_url/scope are absolute, they MUST match one of the
  //         declared production origins (no domain mismatch).
  //       - If relative, simulate resolution under each prod origin and
  //         confirm start_url stays within scope (no path mismatch).
  //       - Warn when scope is narrower than the production root path,
  //         which would silently exclude pages from the PWA.
  // ─────────────────────────────────────────────────────────────────
  if (validProdOrigins.length > 0) {
    const prodOriginSet = new Set(validProdOrigins.map((p) => p.origin));
    const prodOriginList = [...prodOriginSet].join(", ");

    function checkAbsoluteOriginMatch(field, value) {
      if (!isAbsolute(value)) return null;
      let url;
      try { url = new URL(value); } catch {
        err(`manifest.${field}`, `"${value}" is not a valid absolute URL.`);
        return null;
      }
      if (!prodOriginSet.has(url.origin)) {
        err(
          `manifest.${field}`,
          `Absolute ${field} origin "${url.origin}" does not match any PWA_PRODUCTION_URL (${prodOriginList}).`,
          `Either change ${field} to a relative path (e.g. "/") or add "${url.origin}" to PWA_PRODUCTION_URL.`
        );
      } else {
        ok(`manifest.${field} origin matches a production URL: ${YELLOW}${url.origin}${RESET}`);
      }
      return url;
    }

    checkAbsoluteOriginMatch("start_url", startUrl);
    checkAbsoluteOriginMatch("scope", scope);

    // Per-origin coherence: resolve relative paths under each prod origin
    // and ensure start_url ∈ scope. Catches the case where someone sets
    // scope: "/app" but start_url: "/" or vice-versa.
    for (const prod of validProdOrigins) {
      let resolvedScope, resolvedStart;
      try {
        resolvedScope = new URL(scope, prod.origin);
        resolvedStart = new URL(startUrl, prod.origin);
      } catch (e) {
        err(
          "manifest vs production URL",
          `Failed to resolve manifest under "${prod.origin}": ${e.message}`
        );
        continue;
      }

      // Origin sanity (only triggers if scope/start_url were absolute and
      // pointed at a different host than `prod`).
      if (resolvedScope.origin !== prod.origin) {
        err(
          "manifest.scope",
          `Under production URL "${prod.origin}", scope resolves to a different origin "${resolvedScope.origin}".`,
          `Use a relative scope (e.g. "/") so it follows the served origin.`
        );
        continue;
      }
      if (resolvedStart.origin !== prod.origin) {
        err(
          "manifest.start_url",
          `Under production URL "${prod.origin}", start_url resolves to a different origin "${resolvedStart.origin}".`,
          `Use a relative start_url (e.g. "/") so it follows the served origin.`
        );
        continue;
      }

      // Path containment.
      if (!resolvedStart.href.startsWith(resolvedScope.href)) {
        err(
          "manifest vs production URL",
          `Under "${prod.origin}", start_url "${resolvedStart.pathname}" is outside scope "${resolvedScope.pathname}".`,
          `Bring start_url inside scope, or widen scope to "/" .`
        );
        continue;
      }

      // Production URL path itself should sit within scope (otherwise
      // navigating to the deployed root would not trigger the PWA shell).
      if (prod.pathname && prod.pathname !== "/" && !prod.pathname.startsWith(resolvedScope.pathname)) {
        warn(
          "manifest.scope",
          `Production URL path "${prod.pathname}" is outside scope "${resolvedScope.pathname}" — visitors may not be in the PWA scope.`
        );
      }

      ok(`Manifest coherent under production origin: ${YELLOW}${prod.origin}${RESET} (scope=${resolvedScope.pathname}, start=${resolvedStart.pathname})`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Final report
// ─────────────────────────────────────────────────────────────────────
log("");
if (warnings.length > 0) {
  log(`${YELLOW}${BOLD}⚠ ${warnings.length} warning(s):${RESET}`);
  warnings.forEach((w) => log(`  ${YELLOW}⚠${RESET} ${BOLD}${w.where}${RESET} — ${w.msg}`));
  log("");
}

if (errors.length > 0) {
  log(`${RED}${BOLD}✗ PWA context validation FAILED with ${errors.length} error(s):${RESET}`);
  errors.forEach((e) => {
    log(`  ${RED}✗${RESET} ${BOLD}${e.where}${RESET} — ${e.msg}`);
    if (e.hint) log(`     ${CYAN}Hint: ${e.hint}${RESET}`);
  });
  log(`\n${RED}Fix the issues above — the PWA would not install/activate in production.${RESET}`);
  process.exit(1);
}

log(`${GREEN}${BOLD}✓ PWA context configured correctly for production deploy${RESET}\n`);
process.exit(0);
