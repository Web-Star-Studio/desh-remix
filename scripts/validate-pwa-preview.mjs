#!/usr/bin/env node
/**
 * PWA Preview-Environment Validation
 * ----------------------------------
 * Ensures the PWA setup is SAFE for Lovable preview environments
 * (id-preview--*.lovable.app, *.lovableproject.com) and any iframe context.
 *
 * In preview/iframe contexts the service worker MUST NOT register, otherwise:
 *   - The SW caches stale builds and the editor preview stops reflecting code changes.
 *   - navigateFallback intercepts iframe routing and breaks preview navigation.
 *   - Persistent caches survive across sessions and pollute later previews.
 *
 * This validator simulates the runtime environment for each preview host
 * and asserts that:
 *   1. The registration code path in src/main.tsx detects the host as preview.
 *   2. The code path early-returns BEFORE invoking registerSW / virtual:pwa-register.
 *   3. Existing service workers are explicitly unregistered on preview hosts.
 *   4. Manifest scope/start_url remain coherent under the preview origin
 *      (the browser must be able to compute a valid scope from the served URL).
 *   5. VitePWA devOptions.enabled is false (dev server === preview-like behavior).
 *
 * Usage:
 *   node scripts/validate-pwa-preview.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
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

log(`${BOLD}━━ PWA Preview-Environment Validation ━━${RESET}\n`);

// Hosts that MUST be treated as preview/iframe and MUST NOT register the SW.
const PREVIEW_HOSTS = [
  "id-preview--45bbd015-0fd5-479b-aac0-c3d135e59f89.lovable.app",
  "id-preview--abc123.lovable.app",
  "myproject.lovableproject.com",
  "preview.lovableproject.com",
];

// ─────────────────────────────────────────────────────────────────────
// 1. src/main.tsx must implement the preview/iframe guard correctly.
// ─────────────────────────────────────────────────────────────────────
const mainPath = resolve(projectRoot, "src/main.tsx");
if (!existsSync(mainPath)) {
  err("src/main.tsx", "Entry file not found — cannot audit SW registration guards.");
} else {
  const src = readFileSync(mainPath, "utf8");

  // 1a. Host detection must match BOTH "id-preview--" and "lovableproject.com"
  const detectsIdPreview = /id-preview--/.test(src);
  const detectsLovableProject = /lovableproject\.com/.test(src);
  if (!detectsIdPreview || !detectsLovableProject) {
    err(
      "src/main.tsx",
      `Preview host detection is incomplete. Found id-preview--=${detectsIdPreview}, lovableproject.com=${detectsLovableProject}.`,
      `Detect BOTH substrings: window.location.hostname.includes("id-preview--") || window.location.hostname.includes("lovableproject.com").`
    );
  } else {
    ok("Detects both id-preview-- and lovableproject.com hosts");
  }

  // 1b. Iframe detection via window.self !== window.top
  if (!/window\.self\s*!==\s*window\.top/.test(src)) {
    err(
      "src/main.tsx",
      "Iframe detection guard (window.self !== window.top) is missing.",
      "Add a try/catch that returns true when window.self !== window.top."
    );
  } else {
    ok("Iframe detection guard present (window.self !== window.top)");
  }

  // 1c. The SW boot function must early-return when in preview/iframe
  //     BEFORE importing virtual:pwa-register or calling registerSW.
  //     Extract the full block by counting balanced braces (the guard contains
  //     nested try/catch blocks that simple regex cannot match).
  function extractGuardBlock(source) {
    const re = /if\s*\(\s*isPreviewHost\s*\|\|\s*isInIframe\s*\)\s*\{/;
    const match = re.exec(source);
    if (!match) return null;
    const startIdx = match.index + match[0].length; // first char inside `{`
    let depth = 1;
    for (let i = startIdx; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return source.slice(startIdx, i);
      }
    }
    return null;
  }

  const block = extractGuardBlock(src);
  if (block === null) {
    err(
      "src/main.tsx",
      "No `if (isPreviewHost || isInIframe) { ... }` short-circuit block found in PWA bootstrap.",
      "Wrap an early `return;` inside this guard before any registerSW() call."
    );
  } else {
    if (!/\breturn\s*;?/.test(block)) {
      err(
        "src/main.tsx",
        "Preview/iframe guard exists but does not early-return — registration code may still execute.",
        "Add `return;` inside the guard block."
      );
    } else {
      ok("Preview/iframe guard early-returns before SW registration");
    }
    if (!/unregister\s*\(/.test(block)) {
      err(
        "src/main.tsx",
        "Preview/iframe guard does not unregister stale service workers.",
        "Inside the guard, call navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))."
      );
    } else {
      ok("Preview/iframe guard unregisters stale service workers");
    }
    if (!/caches\.(keys|delete)/.test(block)) {
      warn(
        "src/main.tsx",
        "Preview/iframe guard does not clear caches — stale assets may persist across preview sessions."
      );
    } else {
      ok("Preview/iframe guard clears Cache Storage entries");
    }
  }

  // 1d. registerSW / virtual:pwa-register must NOT be called BEFORE the guard.
  //     Find the first occurrence of registerSW( and the guard line, then assert order.
  const guardIdx = src.search(/if\s*\(\s*isPreviewHost\s*\|\|\s*isInIframe\s*\)/);
  const registerIdx = src.search(/registerSW\s*\(/);
  const virtualImportIdx = src.search(/import\s*\(\s*["']virtual:pwa-register["']\s*\)/);
  if (guardIdx >= 0) {
    if (registerIdx >= 0 && registerIdx < guardIdx) {
      err(
        "src/main.tsx",
        "registerSW() is invoked BEFORE the preview/iframe guard. SW will register on preview hosts.",
        "Move the guard to run before any registerSW() call."
      );
    }
    if (virtualImportIdx >= 0 && virtualImportIdx < guardIdx) {
      err(
        "src/main.tsx",
        "import('virtual:pwa-register') happens BEFORE the preview/iframe guard.",
        "Defer the dynamic import until after the guard early-returns for preview hosts."
      );
    }
    if (
      (registerIdx === -1 || registerIdx > guardIdx) &&
      (virtualImportIdx === -1 || virtualImportIdx > guardIdx)
    ) {
      ok("SW registration code is positioned AFTER the preview/iframe guard");
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2. Simulate the runtime guard for each preview host.
  // ─────────────────────────────────────────────────────────────────────
  function simulateIsPreviewHost(hostname) {
    return (
      hostname.includes("id-preview--") || hostname.includes("lovableproject.com")
    );
  }

  for (const host of PREVIEW_HOSTS) {
    const detected = simulateIsPreviewHost(host);
    if (!detected) {
      err(
        "preview simulation",
        `Host "${host}" would NOT be detected as preview. SW would register here.`,
        "Update host detection in src/main.tsx to cover this domain."
      );
    } else {
      ok(`Host detected as preview: ${YELLOW}${host}${RESET}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 3. Manifest scope/start_url must remain valid under preview origins.
// ─────────────────────────────────────────────────────────────────────
const manifestPath = resolve(projectRoot, "public/manifest.json");
if (!existsSync(manifestPath)) {
  err("public/manifest.json", "Manifest not found — cannot validate preview-origin coherence.");
} else {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    err("public/manifest.json", `Manifest is not valid JSON: ${e.message}`);
    manifest = null;
  }

  if (manifest) {
    const startUrl = manifest.start_url ?? "/";
    const scope = manifest.scope ?? "/";

    // Absolute URLs in scope/start_url would lock the manifest to a single
    // origin and break installability under preview hosts. They must be relative.
    if (/^https?:\/\//i.test(startUrl)) {
      err(
        "manifest.start_url",
        `start_url "${startUrl}" is absolute — locks the PWA to one origin and breaks under preview hosts.`,
        "Use a path like '/' so the manifest works under any served origin."
      );
    } else {
      ok(`start_url is origin-relative: ${YELLOW}"${startUrl}"${RESET}`);
    }

    if (/^https?:\/\//i.test(scope)) {
      err(
        "manifest.scope",
        `scope "${scope}" is absolute — locks the PWA to one origin and breaks under preview hosts.`,
        "Use a path like '/' so scope is computed from the served origin."
      );
    } else {
      ok(`scope is origin-relative: ${YELLOW}"${scope}"${RESET}`);
    }

    // Simulate the manifest under each preview origin: the resolved start_url
    // must always resolve to a URL within the resolved scope.
    for (const host of PREVIEW_HOSTS) {
      try {
        const origin = `https://${host}`;
        const resolvedScope = new URL(scope, origin);
        const resolvedStart = new URL(startUrl, origin);
        if (!resolvedStart.href.startsWith(resolvedScope.href)) {
          err(
            "preview manifest",
            `Under "${origin}", start_url "${resolvedStart.href}" falls outside scope "${resolvedScope.href}".`,
            "Ensure start_url is within scope using relative paths."
          );
        } else {
          ok(`Under ${YELLOW}${host}${RESET}: start_url within scope`);
        }
      } catch (e) {
        err("preview manifest", `Failed to resolve manifest under "${host}": ${e.message}`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 4. VitePWA must keep devOptions.enabled disabled (dev ≈ preview behavior).
// ─────────────────────────────────────────────────────────────────────
const viteCfgPath = resolve(projectRoot, "vite.config.ts");
if (!existsSync(viteCfgPath)) {
  warn("vite.config.ts", "Not found — skipping devOptions audit.");
} else {
  const cfg = readFileSync(viteCfgPath, "utf8");
  const devOptsMatch = cfg.match(/devOptions\s*:\s*\{[^}]*\}/);
  if (devOptsMatch && /enabled\s*:\s*true/.test(devOptsMatch[0])) {
    err(
      "vite.config.ts",
      "VitePWA devOptions.enabled is true — service worker would activate in dev/preview iframes.",
      "Set devOptions.enabled = false in vite.config.ts."
    );
  } else {
    ok("VitePWA devOptions does not enable SW in development/preview");
  }

  // navigateFallbackDenylist should also exclude OAuth/auth callbacks so they
  // are not intercepted by the SW even on production (preview parity).
  if (!/navigateFallbackDenylist/.test(cfg)) {
    warn(
      "vite.config.ts",
      "workbox.navigateFallbackDenylist not configured — auth callbacks may be intercepted by the SW."
    );
  } else {
    ok("workbox.navigateFallbackDenylist is configured");
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
  log(`${RED}${BOLD}✗ PWA preview validation FAILED with ${errors.length} error(s):${RESET}`);
  errors.forEach((e) => {
    log(`  ${RED}✗${RESET} ${BOLD}${e.where}${RESET} — ${e.msg}`);
    if (e.hint) log(`     ${CYAN}Hint: ${e.hint}${RESET}`);
  });
  log(
    `\n${RED}Fix the issues above — the PWA would interfere with Lovable preview environments.${RESET}`
  );
  process.exit(1);
}

log(`${GREEN}${BOLD}✓ PWA preview environment configured safely${RESET}\n`);
process.exit(0);
