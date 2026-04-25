#!/usr/bin/env node
/**
 * PWA Manifest Validation
 * -----------------------
 * Ensures public/manifest.json exists and contains all fields required for a
 * valid, installable Progressive Web App. Fails the CI build with descriptive
 * errors before deploy if any required field is missing or malformed.
 *
 * Spec reference: https://www.w3.org/TR/appmanifest/
 *
 * Usage:
 *   node scripts/validate-pwa-manifest.mjs
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
const err = (field, msg) => errors.push({ field, msg });
const warn = (field, msg) => warnings.push({ field, msg });

log(`${BOLD}━━ PWA Manifest Validation ━━${RESET}\n`);

// 1. Locate manifest
const candidates = ["public/manifest.json", "public/manifest.webmanifest"];
const manifestPath = candidates
  .map((p) => resolve(projectRoot, p))
  .find((p) => existsSync(p));

if (!manifestPath) {
  log(`${RED}${BOLD}✗ Manifest file not found${RESET}`);
  log(`${RED}Looked for: ${candidates.join(", ")}${RESET}`);
  process.exit(1);
}
ok(`Manifest located at ${CYAN}${manifestPath.replace(projectRoot + "/", "")}${RESET}`);

// 2. Parse JSON
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  ok("Manifest is valid JSON");
} catch (e) {
  log(`${RED}${BOLD}✗ Manifest is not valid JSON: ${e.message}${RESET}`);
  process.exit(1);
}

// 3. Required fields
const REQUIRED_STRING_FIELDS = ["name", "short_name", "start_url", "display"];
const VALID_DISPLAY = ["fullscreen", "standalone", "minimal-ui", "browser"];

for (const field of REQUIRED_STRING_FIELDS) {
  const value = manifest[field];
  if (value === undefined || value === null || value === "") {
    err(field, `Required field is missing or empty.`);
  } else if (typeof value !== "string") {
    err(field, `Must be a string, got ${typeof value}.`);
  } else {
    ok(`${field}: ${YELLOW}"${value}"${RESET}`);
  }
}

// short_name length recommendation (Chrome enforces ~12 chars)
if (typeof manifest.short_name === "string" && manifest.short_name.length > 12) {
  warn(
    "short_name",
    `Length is ${manifest.short_name.length} — may be truncated by some launchers (recommended ≤12).`
  );
}

// display value
if (manifest.display && !VALID_DISPLAY.includes(manifest.display)) {
  err(
    "display",
    `Invalid value "${manifest.display}". Must be one of: ${VALID_DISPLAY.join(", ")}.`
  );
}

// 4. Icons array
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  err("icons", "Required field is missing or empty. Must be a non-empty array.");
} else {
  ok(`icons: ${manifest.icons.length} entries`);

  let has192 = false;
  let has512 = false;
  let hasMaskable = false;

  manifest.icons.forEach((icon, i) => {
    const ctx = `icons[${i}]`;
    if (!icon || typeof icon !== "object") {
      err(ctx, "Must be an object.");
      return;
    }
    if (!icon.src || typeof icon.src !== "string") {
      err(ctx, "Missing required `src`.");
    } else {
      // Verify the file actually exists in /public
      const iconRelative = icon.src.replace(/^\//, "");
      const iconPath = join(projectRoot, "public", iconRelative);
      if (!existsSync(iconPath)) {
        err(ctx, `File not found at public/${iconRelative} (referenced as ${icon.src}).`);
      }
    }
    if (!icon.sizes || typeof icon.sizes !== "string") {
      err(ctx, "Missing required `sizes`.");
    } else {
      if (icon.sizes.includes("192x192")) has192 = true;
      if (icon.sizes.includes("512x512")) has512 = true;
    }
    if (!icon.type || typeof icon.type !== "string") {
      warn(ctx, "Missing recommended `type` (e.g. \"image/png\").");
    }
    if (icon.purpose && /maskable/.test(icon.purpose)) {
      hasMaskable = true;
    }
  });

  if (!has192) err("icons", "Missing required 192x192 icon (Chrome installability requirement).");
  else ok("icons include 192x192");
  if (!has512) err("icons", "Missing required 512x512 icon (Chrome installability requirement).");
  else ok("icons include 512x512");
  if (!hasMaskable) warn("icons", "No maskable icon present — recommended for adaptive launcher icons.");
  else ok("icons include a maskable variant");
}

// 5. Recommended fields
const RECOMMENDED = ["description", "background_color", "theme_color", "lang"];
for (const field of RECOMMENDED) {
  if (!manifest[field]) {
    warn(field, "Recommended field is missing.");
  }
}

// 6. start_url shape
if (manifest.start_url && typeof manifest.start_url === "string") {
  if (!manifest.start_url.startsWith("/") && !/^https?:\/\//.test(manifest.start_url)) {
    warn(
      "start_url",
      `"${manifest.start_url}" should start with "/" or be a full URL.`
    );
  }
}

// 7. Final report
log("");
if (warnings.length > 0) {
  log(`${YELLOW}${BOLD}⚠ ${warnings.length} warning(s):${RESET}`);
  warnings.forEach((w) => log(`  ${YELLOW}⚠${RESET} ${BOLD}${w.field}${RESET} — ${w.msg}`));
  log("");
}

if (errors.length > 0) {
  log(`${RED}${BOLD}✗ PWA manifest validation FAILED with ${errors.length} error(s):${RESET}`);
  errors.forEach((e) => log(`  ${RED}✗${RESET} ${BOLD}${e.field}${RESET} — ${e.msg}`));
  log(`\n${RED}Fix the issues above before deploying.${RESET}`);
  process.exit(1);
}

log(`${GREEN}${BOLD}✓ PWA manifest is valid and installable${RESET}\n`);
process.exit(0);
