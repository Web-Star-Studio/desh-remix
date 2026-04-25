#!/usr/bin/env node
/**
 * PWA Icons Validation
 * --------------------
 * Deep validation of every icon referenced by the manifest (and its
 * `shortcuts[].icons`). Goes beyond presence-on-disk checks done by
 * validate-pwa-manifest.mjs:
 *
 *   1. Each `src` resolves to a real file under /public.
 *   2. The file MIME (PNG/SVG/WEBP) matches `type` and the file extension.
 *   3. For raster icons (PNG/WEBP), the actual pixel dimensions match every
 *      size declared in `sizes` (catches "renamed 192px to 512x512.png" bugs).
 *   4. SVG icons must declare `sizes: "any"` (per spec) OR contain a viewBox
 *      that is square and at least 48x48.
 *   5. Required size coverage for installability and adaptive launchers:
 *        - "any" purpose: 192x192 AND 512x512
 *        - "maskable" purpose: at least one 512x512 (recommended) or 192x192
 *        - shortcut icons: at least one ≥96x96
 *   6. Maskable PNG icons: warn if dimensions are not multiples of 8 (some
 *      launchers require this for clean masking).
 *   7. File size sanity: warn if any icon is suspiciously small (< 200 bytes,
 *      typically a placeholder) or larger than 1 MB (manifest bloat).
 *
 * Spec: https://www.w3.org/TR/appmanifest/#icons-member
 *
 * Usage:
 *   node scripts/validate-pwa-icons.mjs
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const publicDir = resolve(projectRoot, "public");

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

log(`${BOLD}━━ PWA Icons Validation ━━${RESET}\n`);

// ─────────────────────────────────────────────────────────────────────
// Locate manifest
// ─────────────────────────────────────────────────────────────────────
const manifestPath = ["public/manifest.json", "public/manifest.webmanifest"]
  .map((p) => resolve(projectRoot, p))
  .find((p) => existsSync(p));

if (!manifestPath) {
  log(`${RED}${BOLD}✗ Manifest not found${RESET}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  log(`${RED}${BOLD}✗ Manifest is not valid JSON: ${e.message}${RESET}`);
  process.exit(1);
}
ok(`Manifest loaded (${manifest.icons?.length ?? 0} icons declared)`);

// ─────────────────────────────────────────────────────────────────────
// Format detection helpers
// ─────────────────────────────────────────────────────────────────────
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function detectFormat(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return "png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  // SVG: must start with "<?xml" or "<svg" within the first 200 bytes (whitespace-tolerant).
  const head = buf.subarray(0, 200).toString("utf8").trimStart();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) return "svg";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 4 && buf.subarray(0, 4).toString("ascii") === "GIF8") return "gif";
  return null;
}

function readPngDimensions(buf) {
  // PNG: 8-byte signature, then IHDR chunk. Width = bytes 16-19, Height = 20-23.
  if (buf.length < 24) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function readWebpDimensions(buf) {
  // Supports VP8 (lossy), VP8L (lossless) and VP8X (extended). 30 bytes is enough for header.
  if (buf.length < 30) return null;
  const fourCC = buf.subarray(12, 16).toString("ascii");
  try {
    if (fourCC === "VP8 ") {
      // Frame tag: 3 bytes, then 0x9d 0x01 0x2a, then 2 bytes width + 2 bytes height (14 bits each).
      const w = buf.readUInt16LE(26) & 0x3fff;
      const h = buf.readUInt16LE(28) & 0x3fff;
      return { width: w, height: h };
    }
    if (fourCC === "VP8L") {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      const w = 1 + (((b1 & 0x3f) << 8) | b0);
      const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width: w, height: h };
    }
    if (fourCC === "VP8X") {
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { width: w, height: h };
    }
  } catch { /* fall through */ }
  return null;
}

function readSvgViewBox(text) {
  // Try viewBox first, then width/height attributes.
  const vb = text.match(/viewBox\s*=\s*["']\s*([\-\d.\s]+)\s*["']/i);
  if (vb) {
    const parts = vb[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { width: parts[2], height: parts[3], source: "viewBox" };
    }
  }
  const w = text.match(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i);
  const h = text.match(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i);
  if (w && h) return { width: Number(w[1]), height: Number(h[1]), source: "width/height" };
  return null;
}

function parseSizes(sizes) {
  // "192x192", "192x192 512x512", "any"
  if (!sizes || typeof sizes !== "string") return [];
  return sizes
    .trim()
    .split(/\s+/)
    .map((s) => {
      if (s.toLowerCase() === "any") return { any: true };
      const m = s.match(/^(\d+)x(\d+)$/i);
      return m ? { width: Number(m[1]), height: Number(m[2]) } : { invalid: s };
    });
}

const TYPE_BY_FORMAT = {
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  jpeg: "image/jpeg",
  gif: "image/gif",
};
const RECOMMENDED_FORMATS = new Set(["png", "svg", "webp"]);

// ─────────────────────────────────────────────────────────────────────
// Validate one icon entry
// ─────────────────────────────────────────────────────────────────────
const seenAnySizes = new Set();
const seenMaskableSizes = new Set();

function validateIcon(icon, ctx, { isShortcut = false } = {}) {
  if (!icon || typeof icon !== "object") {
    err(ctx, "Icon entry must be an object.");
    return;
  }
  if (!icon.src || typeof icon.src !== "string") {
    err(ctx, "Missing or invalid `src`.");
    return;
  }

  // Resolve file
  const rel = icon.src.replace(/^\//, "");
  const filePath = join(publicDir, rel);
  if (!existsSync(filePath)) {
    err(ctx, `File not found at public/${rel} (referenced as ${icon.src}).`,
      `Add the file to /public or fix the src path.`);
    return;
  }

  const stat = statSync(filePath);
  if (stat.size < 200) {
    warn(ctx, `File is suspiciously small (${stat.size} bytes) — possibly a placeholder.`);
  } else if (stat.size > 1024 * 1024) {
    warn(ctx, `File is larger than 1 MB (${(stat.size / 1024 / 1024).toFixed(2)} MB) — consider compressing.`);
  }

  const buf = readFileSync(filePath);
  const detectedFormat = detectFormat(buf);
  if (!detectedFormat) {
    err(ctx, `Unable to detect image format for ${icon.src}. Not a recognized PNG/SVG/WEBP/JPEG/GIF.`);
    return;
  }
  if (!RECOMMENDED_FORMATS.has(detectedFormat)) {
    warn(ctx, `Format "${detectedFormat}" is not recommended for PWA icons (use PNG, SVG, or WEBP).`);
  }

  // Extension vs format
  const ext = extname(rel).toLowerCase().slice(1);
  const expectedExtMap = { png: ["png"], svg: ["svg"], webp: ["webp"], jpeg: ["jpg", "jpeg"], gif: ["gif"] };
  if (ext && !(expectedExtMap[detectedFormat] || []).includes(ext)) {
    warn(ctx, `Extension ".${ext}" does not match detected format "${detectedFormat}".`);
  }

  // type vs detected format
  const expectedType = TYPE_BY_FORMAT[detectedFormat];
  if (!icon.type) {
    warn(ctx, `Missing recommended \`type\` (should be "${expectedType}").`);
  } else if (icon.type !== expectedType) {
    err(ctx, `Declared type "${icon.type}" does not match actual format "${detectedFormat}" (expected "${expectedType}").`);
  }

  // Validate purpose values
  const purposes = (icon.purpose || "any").split(/\s+/).filter(Boolean);
  const VALID_PURPOSES = new Set(["any", "maskable", "monochrome"]);
  for (const p of purposes) {
    if (!VALID_PURPOSES.has(p)) {
      err(ctx, `Invalid purpose "${p}". Must be one of: any, maskable, monochrome.`);
    }
  }

  // Parse declared sizes
  const declared = parseSizes(icon.sizes);
  if (!isShortcut && declared.length === 0) {
    err(ctx, `Missing or invalid \`sizes\` (got "${icon.sizes ?? ""}").`);
    return;
  }
  for (const d of declared) {
    if (d.invalid) {
      err(ctx, `Invalid size token "${d.invalid}" in \`sizes\`.`);
    }
  }

  // SVG handling
  if (detectedFormat === "svg") {
    const text = buf.toString("utf8");
    const vb = readSvgViewBox(text);
    const isAny = declared.some((d) => d.any);
    if (!isAny) {
      warn(ctx, `SVG icons should declare \`sizes: "any"\` per W3C spec.`);
    }
    if (vb) {
      if (vb.width !== vb.height) {
        warn(ctx, `SVG ${vb.source} is not square (${vb.width}x${vb.height}). Launchers may distort the icon.`);
      }
      if (Math.min(vb.width, vb.height) < 48) {
        warn(ctx, `SVG ${vb.source} is below 48px (${vb.width}x${vb.height}); too small for installation prompts.`);
      }
    } else {
      warn(ctx, `SVG has no viewBox or width/height — cannot verify dimensions.`);
    }
    // Track size coverage as "vector"
    if (purposes.includes("any")) seenAnySizes.add("vector");
    if (purposes.includes("maskable")) seenMaskableSizes.add("vector");
    ok(`${ctx} → ${icon.src} ${CYAN}(svg, ${declared.map(d => d.any ? "any" : `${d.width}x${d.height}`).join(",")}, purpose=${purposes.join(",")})${RESET}`);
    return;
  }

  // Raster: read actual dimensions
  let actual = null;
  if (detectedFormat === "png") actual = readPngDimensions(buf);
  else if (detectedFormat === "webp") actual = readWebpDimensions(buf);

  if (!actual) {
    err(ctx, `Could not read pixel dimensions from ${icon.src}.`);
    return;
  }

  // Each declared raster size MUST match actual file dimensions.
  // Multiple sizes on a single bitmap are not legal — the file has exactly one set of pixels.
  const concreteSizes = declared.filter((d) => !d.any && !d.invalid);
  if (concreteSizes.length > 1) {
    warn(ctx, `Declares multiple sizes (${icon.sizes}) on a single raster file. The bitmap has exactly one resolution (${actual.width}x${actual.height}); only that size will be honored.`);
  }
  for (const d of concreteSizes) {
    if (d.width !== actual.width || d.height !== actual.height) {
      err(
        ctx,
        `Declared size ${d.width}x${d.height} does not match actual ${detectedFormat.toUpperCase()} dimensions ${actual.width}x${actual.height} (${icon.src}).`,
        `Either re-export the asset at ${d.width}x${d.height}, or update \`sizes\` to "${actual.width}x${actual.height}".`
      );
    }
  }

  // Track coverage based on the ACTUAL resolution (not the declared one)
  const sizeKey = `${actual.width}x${actual.height}`;
  if (purposes.includes("any")) seenAnySizes.add(sizeKey);
  if (purposes.includes("maskable")) seenMaskableSizes.add(sizeKey);

  // Maskable: dimensions should be multiples of 8 (safe-area math)
  if (purposes.includes("maskable")) {
    if (actual.width % 8 !== 0 || actual.height % 8 !== 0) {
      warn(ctx, `Maskable icon dimensions (${actual.width}x${actual.height}) are not multiples of 8 — may render with rounding artifacts.`);
    }
    if (actual.width < 192) {
      warn(ctx, `Maskable icon is smaller than 192px (${actual.width}px). Recommended ≥512px for crisp adaptive icons.`);
    }
  }

  // Shortcut icons: at least 96x96 recommended
  if (isShortcut && (actual.width < 96 || actual.height < 96)) {
    warn(ctx, `Shortcut icon ${actual.width}x${actual.height} is below recommended 96x96.`);
  }

  ok(
    `${ctx} → ${icon.src} ${CYAN}(${detectedFormat}, ${actual.width}x${actual.height}, purpose=${purposes.join(",")})${RESET}`
  );
}

// ─────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  err("icons", "Manifest has no icons array. Add at least 192x192 and 512x512 PNGs.");
} else {
  manifest.icons.forEach((icon, i) => validateIcon(icon, `icons[${i}]`));
}

if (Array.isArray(manifest.shortcuts)) {
  manifest.shortcuts.forEach((sc, i) => {
    if (Array.isArray(sc.icons)) {
      sc.icons.forEach((icon, j) =>
        validateIcon(icon, `shortcuts[${i}].icons[${j}]`, { isShortcut: true })
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────
// Coverage requirements
// ─────────────────────────────────────────────────────────────────────
log("");
log(`${BOLD}Coverage:${RESET}`);

const has192Any = seenAnySizes.has("192x192") || seenAnySizes.has("vector");
const has512Any = seenAnySizes.has("512x512") || seenAnySizes.has("vector");
const hasMaskable = seenMaskableSizes.size > 0;
const hasMaskable512 = seenMaskableSizes.has("512x512") || seenMaskableSizes.has("vector");

if (!has192Any) {
  err("icons coverage", `No icon with purpose "any" at 192x192 (or vector). Required for installability.`);
} else {
  ok(`192x192 "any" icon present`);
}
if (!has512Any) {
  err("icons coverage", `No icon with purpose "any" at 512x512 (or vector). Required for installability.`);
} else {
  ok(`512x512 "any" icon present`);
}
if (!hasMaskable) {
  warn("icons coverage", `No maskable icon — adaptive launchers will fall back to letterboxed any-icons.`);
} else if (!hasMaskable512) {
  warn("icons coverage", `Maskable icons present but none at 512x512 — recommended for high-DPI launchers.`);
} else {
  ok(`Maskable 512x512 icon present`);
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
  log(`${RED}${BOLD}✗ PWA icons validation FAILED with ${errors.length} error(s):${RESET}`);
  errors.forEach((e) => {
    log(`  ${RED}✗${RESET} ${BOLD}${e.where}${RESET} — ${e.msg}`);
    if (e.hint) log(`     ${CYAN}Hint: ${e.hint}${RESET}`);
  });
  log(`\n${RED}Fix the icons above — Chrome / Android launchers will reject the PWA otherwise.${RESET}`);
  process.exit(1);
}

log(`${GREEN}${BOLD}✓ All PWA icons exist with correct dimensions and coverage${RESET}\n`);
process.exit(0);
