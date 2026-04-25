#!/usr/bin/env node
/**
 * PWA Dependency Validation
 * -------------------------
 * Verifies that all runtime dependencies required for the PWA service worker
 * registration flow are installed AND compatible with the project's browser
 * targets BEFORE the production build runs.
 *
 * Checks:
 *   1. Required packages declared in package.json
 *   2. Packages physically installed and resolvable
 *   3. workbox-window major version is supported (>=7) and matches the
 *      Vite `build.target` / tsconfig `target` (must be ES2020 or newer)
 *   4. Service Worker registration code in src/main.tsx uses APIs that the
 *      configured browser target actually supports
 *
 * Usage:
 *   node scripts/validate-pwa-deps.mjs
 */

import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const REQUIRED = [
  {
    name: "workbox-window",
    reason: "Required by virtual:pwa-register at runtime to register the SW.",
    install: "npm install workbox-window",
    minMajor: 7,
    requiresEsTarget: 2020, // workbox-window 7+ ships ES2020 syntax
  },
  {
    name: "vite-plugin-pwa",
    reason: "Generates the virtual:pwa-register module and the service worker.",
    install: "npm install -D vite-plugin-pwa",
    minMajor: 0, // any
    requiresEsTarget: 2017,
  },
];

let failed = false;
const report = [];

function log(msg) { console.log(msg); }
function ok(name, version, extra = "") {
  report.push({ name, status: "ok", version });
  log(`${GREEN}✓${RESET} ${name} ${YELLOW}${version}${RESET}${extra ? "  " + CYAN + extra + RESET : ""}`);
}
function fail(name, message) {
  failed = true;
  report.push({ name, status: "fail", message });
  log(`${RED}✗${RESET} ${BOLD}${name}${RESET} — ${message}`);
}
function warn(name, message) {
  log(`${YELLOW}⚠${RESET} ${BOLD}${name}${RESET} — ${message}`);
}

log(`${BOLD}━━ PWA Dependency Validation ━━${RESET}\n`);

// 1. package.json
const pkgPath = resolve(projectRoot, "package.json");
if (!existsSync(pkgPath)) {
  console.error(`${RED}✗ package.json not found at ${pkgPath}${RESET}`);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

// ─────────────────────────────────────────────────────────────────────────
// Detect browser target from build config
// ─────────────────────────────────────────────────────────────────────────
function detectViteTarget() {
  const viteCfgPath = resolve(projectRoot, "vite.config.ts");
  if (!existsSync(viteCfgPath)) return null;
  const src = readFileSync(viteCfgPath, "utf8");
  const m = src.match(/target:\s*["']([a-z0-9]+)["']/i);
  return m ? m[1].toLowerCase() : null;
}

function detectTsTarget() {
  const tsAppPath = resolve(projectRoot, "tsconfig.app.json");
  if (!existsSync(tsAppPath)) return null;
  try {
    const cfg = JSON.parse(readFileSync(tsAppPath, "utf8"));
    return (cfg.compilerOptions?.target || "").toLowerCase();
  } catch { return null; }
}

function detectBrowserslist() {
  if (pkg.browserslist) return pkg.browserslist;
  const brc = resolve(projectRoot, ".browserslistrc");
  if (existsSync(brc)) return readFileSync(brc, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  return null;
}

const viteTarget = detectViteTarget();          // e.g. "es2020"
const tsTarget = detectTsTarget();              // e.g. "es2020"
const browserslist = detectBrowserslist();

function targetToYear(t) {
  if (!t) return null;
  const m = t.match(/es(\d+)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  // Handle short forms: es5, es6 → 2009/2015, then es2015+
  if (n < 100) return n === 5 ? 2009 : n === 6 ? 2015 : 2000 + n;
  return n;
}

const viteYear = targetToYear(viteTarget);
const tsYear = targetToYear(tsTarget);
const effectiveYear = Math.min(viteYear ?? 9999, tsYear ?? 9999);

log(`${CYAN}Build targets detected:${RESET}`);
log(`  Vite build.target:     ${viteTarget || "(default — modules)"} ${viteYear ? `→ ES${viteYear}` : ""}`);
log(`  tsconfig target:       ${tsTarget || "(unset)"} ${tsYear ? `→ ES${tsYear}` : ""}`);
log(`  browserslist:          ${browserslist ? JSON.stringify(browserslist) : "(none — using Vite default)"}`);
log(`  Effective ES year:     ${effectiveYear === 9999 ? "unknown" : `ES${effectiveYear}`}\n`);

// ─────────────────────────────────────────────────────────────────────────
// 2. Validate each required package
// ─────────────────────────────────────────────────────────────────────────
for (const dep of REQUIRED) {
  if (!allDeps[dep.name]) {
    fail(dep.name, `Missing from package.json. ${dep.reason}\n     Fix: ${dep.install}`);
    continue;
  }

  let depPkg;
  try {
    const entryPath = require.resolve(`${dep.name}/package.json`, { paths: [projectRoot] });
    depPkg = JSON.parse(readFileSync(entryPath, "utf8"));
  } catch (err) {
    fail(
      dep.name,
      `Declared in package.json but not resolvable in node_modules. ` +
        `Run \`npm install\` (or \`bun install\`).\n     Underlying error: ${err.message}`
    );
    continue;
  }

  // Major version check
  const major = parseInt(String(depPkg.version).split(".")[0], 10);
  if (dep.minMajor && major < dep.minMajor) {
    fail(
      dep.name,
      `Installed v${depPkg.version} is below required major v${dep.minMajor}. Upgrade with: ${dep.install}@latest`
    );
    continue;
  }

  // Browser target compatibility
  if (dep.requiresEsTarget && effectiveYear !== 9999 && effectiveYear < dep.requiresEsTarget) {
    fail(
      dep.name,
      `Requires ES${dep.requiresEsTarget}+ but project target is ES${effectiveYear}. ` +
        `Update vite.config.ts \`build.target\` and tsconfig \`target\` to "es${dep.requiresEsTarget}" or newer.`
    );
    continue;
  }

  ok(dep.name, depPkg.version, `requires ES${dep.requiresEsTarget}+`);
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Audit src/main.tsx — make sure SW registration uses APIs supported
//    by the configured target. Flags use of newer APIs that need polyfills
//    or a higher target.
// ─────────────────────────────────────────────────────────────────────────
const mainPath = resolve(projectRoot, "src/main.tsx");
if (existsSync(mainPath)) {
  const mainSrc = readFileSync(mainPath, "utf8");

  // API → minimum ES year (or feature year) it requires
  const apiChecks = [
    { pattern: /\bnavigator\.serviceWorker\b/, name: "navigator.serviceWorker", minYear: 2017, note: "Requires secure context (HTTPS)" },
    { pattern: /\bcaches\.keys\(\)/, name: "CacheStorage API", minYear: 2017 },
    { pattern: /\brequestIdleCallback\b/, name: "requestIdleCallback", minYear: 2018, note: "Not supported in Safari — fallback to setTimeout is recommended" },
    { pattern: /\bawait\s+import\(/, name: "Dynamic import (top-level await)", minYear: 2020 },
    { pattern: /\?\?[^=]/, name: "Nullish coalescing (??)", minYear: 2020 },
    { pattern: /\?\.[a-zA-Z_]/, name: "Optional chaining (?.)", minYear: 2020 },
    { pattern: /\bisSecureContext\b/, name: "window.isSecureContext", minYear: 2018 },
  ];

  log(`${CYAN}Auditing src/main.tsx SW register code:${RESET}`);
  let mainOk = true;
  for (const check of apiChecks) {
    if (check.pattern.test(mainSrc)) {
      const compatible = effectiveYear === 9999 || effectiveYear >= check.minYear;
      if (compatible) {
        log(`  ${GREEN}✓${RESET} ${check.name} ${YELLOW}(needs ES${check.minYear})${RESET}${check.note ? "  " + CYAN + check.note + RESET : ""}`);
      } else {
        mainOk = false;
        fail(
          "src/main.tsx",
          `Uses ${check.name} which needs ES${check.minYear}+ but project target is ES${effectiveYear}.`
        );
      }
    }
  }

  // Make sure registration is guarded against preview/iframe contexts —
  // a hardening rule we already enforce, regression-test it here.
  if (!/isPreviewHost|isInIframe/.test(mainSrc)) {
    warn(
      "src/main.tsx",
      "Service worker registration does not appear to guard against preview/iframe contexts. " +
        "This can cause stale-cache issues in the Lovable editor."
    );
  } else {
    log(`  ${GREEN}✓${RESET} Preview/iframe guard present`);
  }

  // Dynamic import of workbox / virtual:pwa-register isolates failures.
  if (!/import\(["']virtual:pwa-register["']\)/.test(mainSrc) && !/import\(["']workbox-window["']\)/.test(mainSrc)) {
    warn(
      "src/main.tsx",
      "PWA modules are not dynamically imported — a missing dependency could block app boot."
    );
  } else {
    log(`  ${GREEN}✓${RESET} PWA modules loaded via dynamic import (failure-isolated)`);
  }

  if (mainOk) log("");
} else {
  warn("src/main.tsx", "File not found — skipping SW register code audit.");
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Final report
// ─────────────────────────────────────────────────────────────────────────
if (failed) {
  log(`${RED}${BOLD}✗ PWA dependency validation FAILED${RESET}`);
  log(`${RED}Cannot proceed with build — fix the issues above first.${RESET}\n`);
  process.exit(1);
}

log(`${GREEN}${BOLD}✓ All PWA dependencies validated and target-compatible${RESET}\n`);
process.exit(0);
