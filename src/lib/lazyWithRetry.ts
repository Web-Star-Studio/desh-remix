import React from "react";

/**
 * lazyWithRetry
 * -------------
 * Wraps React.lazy with automatic retry-on-failure logic for dynamic chunk
 * loading. This is critical because:
 *
 *   1. After a deploy, users on the old version may try to load chunks that
 *      no longer exist at the cached URL → "Failed to fetch dynamically
 *      imported module" / "Loading chunk X failed".
 *   2. Transient network blips can fail a chunk load.
 *
 * Strategy:
 *   - Try to import the module.
 *   - On failure, wait briefly and try once more (network blip recovery).
 *   - If it still fails AND the error pattern matches a chunk/module load
 *     failure, force a one-time hard reload to fetch the latest manifest.
 *     A sessionStorage flag prevents reload loops.
 *   - Otherwise, rethrow so the nearest ChunkErrorBoundary can present a UI.
 */

const RELOAD_FLAG_PREFIX = "desh:chunk-reload:";

function isChunkLoadError(err: unknown): boolean {
  const msg = (err as any)?.message?.toLowerCase?.() || "";
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("loading chunk") ||
    msg.includes("loading css chunk") ||
    msg.includes("import error") ||
    msg.includes("module script failed") ||
    msg.includes("dynamically imported module")
  );
}

export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName?: string
): React.LazyExoticComponent<T> {
  const key = `${RELOAD_FLAG_PREFIX}${chunkName || factory.toString().slice(0, 40)}`;

  return React.lazy(async () => {
    try {
      const mod = await factory();
      // Successful load — clear any stale reload flag for this chunk.
      try { sessionStorage.removeItem(key); } catch {}
      return mod;
    } catch (firstError) {
      console.warn(`[lazyWithRetry] First load failed for "${chunkName}":`, firstError);

      // Retry once after a short delay (network blip recovery).
      try {
        await new Promise((r) => setTimeout(r, 400));
        const mod = await factory();
        try { sessionStorage.removeItem(key); } catch {}
        console.info(`[lazyWithRetry] Retry succeeded for "${chunkName}"`);
        return mod;
      } catch (secondError) {
        console.error(`[lazyWithRetry] Both attempts failed for "${chunkName}":`, secondError);

        // If this looks like a stale-deploy chunk error, force-refresh ONCE.
        if (isChunkLoadError(secondError)) {
          let alreadyReloaded = false;
          try { alreadyReloaded = sessionStorage.getItem(key) === "1"; } catch {}

          if (!alreadyReloaded) {
            try { sessionStorage.setItem(key, "1"); } catch {}
            console.warn(`[lazyWithRetry] Forcing reload to fetch fresh manifest for "${chunkName}"`);
            // Defer slightly so React doesn't swallow the navigation.
            setTimeout(() => { window.location.reload(); }, 50);
            // Throw so the boundary briefly shows fallback UI before reload.
            throw secondError;
          }
        }

        // Either not a chunk error, or we already tried reloading — surface
        // the error so a ChunkErrorBoundary can render a friendly fallback.
        throw secondError;
      }
    }
  });
}
