#!/usr/bin/env node
/**
 * Verify virtual:pwa-register module resolution
 * ----------------------------------------------
 * This test creates a temporary entry file that imports `virtual:pwa-register`
 * and runs Vite's resolver against it. If `vite-plugin-pwa` is missing,
 * misconfigured, or `workbox-window` is absent, the resolution fails and
 * this script exits with a non-zero code BEFORE the production build runs.
 *
 * Why a dedicated test:
 *   `virtual:pwa-register` is a *virtual module* generated at build-time by
 *   `vite-plugin-pwa`. A standard `npm install` succeeds even if the plugin
 *   is broken — only an actual Vite resolution attempt confirms the module
 *   will exist at runtime. This script provides that guarantee in CI.
 *
 * Usage:
 *   node scripts/verify-pwa-virtual-module.mjs
 */

import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
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

const log = (m) => console.log(m);
const fail = (msg, hint) => {
  log(`${RED}${BOLD}✗ virtual:pwa-register verification FAILED${RESET}`);
  log(`${RED}${msg}${RESET}`);
  if (hint) log(`${YELLOW}Hint: ${hint}${RESET}`);
  process.exit(1);
};

log(`${BOLD}━━ virtual:pwa-register Module Verification ━━${RESET}\n`);

// Create a tiny temp entry that imports the virtual module.
const tmpDir = resolve(projectRoot, ".pwa-verify-tmp");
const tmpEntry = resolve(tmpDir, "entry.ts");

if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

writeFileSync(
  tmpEntry,
  `// Auto-generated. Do not edit. Used by scripts/verify-pwa-virtual-module.mjs
import { registerSW } from "virtual:pwa-register";
export default registerSW;
`,
  "utf8"
);

let viteApi;
try {
  viteApi = await import("vite");
} catch (err) {
  fail(
    `Could not load Vite: ${err.message}`,
    "Run `npm install` to restore dependencies."
  );
}

let resolved = null;
let server = null;
try {
  log(`${CYAN}Loading Vite config and resolving virtual:pwa-register...${RESET}`);
  // createServer with middlewareMode runs all plugins (including vite-plugin-pwa)
  // through their config/configResolved/buildStart hooks, which is what
  // generates the virtual module. We never start listening on a port.
  server = await viteApi.createServer({
    root: projectRoot,
    mode: "production",
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
    logLevel: "error",
  });

  resolved = await server.pluginContainer.resolveId(
    "virtual:pwa-register",
    tmpEntry,
    { ssr: false }
  );

  if (!resolved || !resolved.id) {
    fail(
      "vite-plugin-pwa did not register a resolver for `virtual:pwa-register`. " +
        "The module would be undefined at runtime.",
      "Verify `VitePWA(...)` is included in vite.config.ts plugins array."
    );
  }

  log(`  ${GREEN}✓${RESET} Resolved to: ${YELLOW}${resolved.id}${RESET}`);

  // Now actually load the module — this is what catches missing workbox-window.
  log(`${CYAN}Loading resolved module to confirm runtime availability...${RESET}`);
  const loaded = await server.pluginContainer.load(resolved.id, { ssr: false });
  if (!loaded || (typeof loaded === "object" && !loaded.code)) {
    fail(
      "Resolver returned an id but the module body is empty.",
      "vite-plugin-pwa may be misconfigured or incompatible with the installed Vite version."
    );
  }
  const code = typeof loaded === "string" ? loaded : loaded.code;
  if (!/registerSW/.test(code)) {
    fail(
      "Loaded virtual:pwa-register module does not export `registerSW`.",
      "Upgrade vite-plugin-pwa to a version that exports the standard registerSW API."
    );
  }
  log(`  ${GREEN}✓${RESET} Module body contains registerSW export\n`);
} catch (err) {
  // Surface workbox-window missing dependency clearly.
  const msg = String(err?.message || err);
  if (/workbox-window/i.test(msg)) {
    fail(
      `Resolution requires \`workbox-window\` but it failed: ${msg}`,
      "Install it: npm install workbox-window"
    );
  }
  fail(`Unexpected error during resolution: ${msg}`, "Check vite.config.ts and PWA plugin setup.");
} finally {
  if (server) await server.close().catch(() => {});
  try { unlinkSync(tmpEntry); } catch {}
}

log(`${GREEN}${BOLD}✓ virtual:pwa-register is resolvable and loadable${RESET}\n`);
process.exit(0);
