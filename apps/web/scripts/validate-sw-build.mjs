#!/usr/bin/env node
/**
 * Service Worker Build Artifact Validation
 * ----------------------------------------
 * Runs after `vite build` to confirm that vite-plugin-pwa actually emitted a
 * functional service worker. A successful build does NOT guarantee a usable
 * SW — misconfiguration can yield an empty stub or a bundle missing the
 * Workbox runtime, leading to silent failures in production.
 *
 * Checks:
 *   1. dist/sw.js (or alternative SW file) exists
 *   2. File size is above a sane minimum (Workbox precache ≈ 8KB+)
 *   3. Content includes Workbox/precache markers (not an empty stub)
 *   4. registerSW.js exists and contains the SW registration call
 *   5. Manifest entries are non-empty (something is being precached)
 *
 * Usage:
 *   node scripts/validate-sw-build.mjs
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const distDir = resolve(projectRoot, "dist");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

// Minimum reasonable size for a Workbox-generated SW. A bare empty SW from
// vite-plugin-pwa misconfiguration is typically <500 bytes; a real one with
// the Workbox runtime + precache manifest is usually 8-30KB+.
const MIN_SW_BYTES = 4 * 1024; // 4KB — below this is almost certainly broken
const MIN_REGISTER_BYTES = 200; // registerSW.js is small but non-trivial

const errors = [];
const warnings = [];
const log = (m) => console.log(m);
const ok = (msg) => log(`${GREEN}✓${RESET} ${msg}`);
const err = (where, msg) => errors.push({ where, msg });
const warn = (where, msg) => warnings.push({ where, msg });

const fmtBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

log(`${BOLD}━━ Service Worker Build Validation ━━${RESET}\n`);

// 1. dist/ must exist
if (!existsSync(distDir)) {
  log(`${RED}${BOLD}✗ dist/ directory not found.${RESET}`);
  log(`${RED}Run \`npm run build\` first.${RESET}`);
  process.exit(1);
}
ok(`dist/ exists at ${CYAN}${distDir.replace(projectRoot + "/", "")}${RESET}`);

// 2. Locate the SW file. vite-plugin-pwa default is sw.js; some configs use
//    service-worker.js or a hashed workbox-*.js in the root.
const SW_CANDIDATES = ["sw.js", "service-worker.js"];
const swPath = SW_CANDIDATES.map((f) => join(distDir, f)).find((p) => existsSync(p));

if (!swPath) {
  err(
    "sw.js",
    `No service worker file found in dist/. Looked for: ${SW_CANDIDATES.join(", ")}.`
  );
} else {
  const swStat = statSync(swPath);
  const swName = swPath.replace(distDir + "/", "");

  if (swStat.size < MIN_SW_BYTES) {
    err(
      swName,
      `Size is only ${fmtBytes(swStat.size)} — below minimum ${fmtBytes(MIN_SW_BYTES)}. ` +
        `An empty/stub SW indicates vite-plugin-pwa misconfiguration.`
    );
  } else {
    ok(`${swName}: ${YELLOW}${fmtBytes(swStat.size)}${RESET} (above ${fmtBytes(MIN_SW_BYTES)} minimum)`);
  }

  // 3. Inspect content for Workbox runtime markers + precache manifest.
  const swContent = readFileSync(swPath, "utf8");

  const markers = [
    { name: "Workbox runtime", pattern: /workbox|importScripts/i, required: true },
    { name: "precache manifest", pattern: /precacheAndRoute|__WB_MANIFEST|self\.__WB_MANIFEST/, required: true },
    { name: "skipWaiting/clientsClaim", pattern: /skipWaiting|clientsClaim/, required: false },
  ];

  for (const m of markers) {
    if (m.pattern.test(swContent)) {
      ok(`${swName} contains ${m.name}`);
    } else if (m.required) {
      err(
        swName,
        `Missing expected marker: ${m.name}. The SW may be a stub or incompatible build output.`
      );
    } else {
      warn(swName, `Missing optional marker: ${m.name}.`);
    }
  }

  // 4. Verify the precache manifest is not empty. vite-plugin-pwa inlines an
  //    array like `precacheAndRoute([{revision:..., url:"..."}, ...])`. An
  //    empty array means nothing will be cached offline.
  const precacheArrayMatch = swContent.match(/precacheAndRoute\s*\(\s*(\[[\s\S]*?\])/);
  if (precacheArrayMatch) {
    const entries = (precacheArrayMatch[1].match(/\{[^}]*url\s*:/g) || []).length;
    if (entries === 0) {
      err(
        swName,
        `precacheAndRoute() called with empty array — no assets will be cached. ` +
          `Check workbox.globPatterns in vite.config.ts.`
      );
    } else {
      ok(`Precache manifest contains ${YELLOW}${entries}${RESET} entries`);
    }
  } else {
    warn(
      swName,
      "Could not locate precacheAndRoute([...]) call to count manifest entries."
    );
  }
}

// 5. registerSW.js (the snippet imported by virtual:pwa-register at runtime).
const registerPath = join(distDir, "registerSW.js");
if (!existsSync(registerPath)) {
  // Some builds inline registration into the main bundle instead of emitting
  // a standalone registerSW.js. Treat as warning, not fatal, if SW exists.
  warn(
    "registerSW.js",
    "Standalone registerSW.js not emitted — registration may be inlined into the main bundle."
  );
} else {
  const regStat = statSync(registerPath);
  if (regStat.size < MIN_REGISTER_BYTES) {
    err(
      "registerSW.js",
      `Size ${fmtBytes(regStat.size)} is below minimum ${fmtBytes(MIN_REGISTER_BYTES)}.`
    );
  } else {
    ok(`registerSW.js: ${YELLOW}${fmtBytes(regStat.size)}${RESET}`);
  }
  const regContent = readFileSync(registerPath, "utf8");
  if (!/navigator\s*\.\s*serviceWorker|\.register\s*\(/.test(regContent)) {
    err(
      "registerSW.js",
      "Does not contain navigator.serviceWorker.register call."
    );
  } else {
    ok("registerSW.js contains navigator.serviceWorker.register call");
  }
}

// 6. Check for any leftover workbox-*.js runtime chunks (older configs).
const distFiles = readdirSync(distDir);
const workboxChunks = distFiles.filter((f) => /^workbox-[a-z0-9]+\.js$/i.test(f));
if (workboxChunks.length > 0) {
  workboxChunks.forEach((f) => {
    const s = statSync(join(distDir, f));
    ok(`Workbox runtime chunk present: ${CYAN}${f}${RESET} (${fmtBytes(s.size)})`);
  });
}

// 7. Final report
log("");
if (warnings.length > 0) {
  log(`${YELLOW}${BOLD}⚠ ${warnings.length} warning(s):${RESET}`);
  warnings.forEach((w) => log(`  ${YELLOW}⚠${RESET} ${BOLD}${w.where}${RESET} — ${w.msg}`));
  log("");
}

if (errors.length > 0) {
  log(`${RED}${BOLD}✗ Service worker build validation FAILED with ${errors.length} error(s):${RESET}`);
  errors.forEach((e) => log(`  ${RED}✗${RESET} ${BOLD}${e.where}${RESET} — ${e.msg}`));
  log(`\n${RED}Do not deploy — the PWA would be broken in production.${RESET}`);
  process.exit(1);
}

log(`${GREEN}${BOLD}✓ Service worker artifacts validated and ready to deploy${RESET}\n`);
process.exit(0);
