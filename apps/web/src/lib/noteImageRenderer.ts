import { getDownloadUrl } from "@/lib/storage";

/**
 * Bridge between the persisted note HTML format (`<img data-file-id="…">`)
 * and the in-editor live format (`<img src="…signed…" data-file-id="…">`).
 *
 * Persistence keeps only the stable file id; rendering resolves it to a
 * fresh signed URL each time. This avoids baking expiring URLs into note
 * rows and lets us delete the underlying object without leaving zombie
 * links behind.
 *
 * Parsing uses `DOMParser` (which doesn't execute scripts) followed by safe
 * DOM mutations (`setAttribute`/`removeAttribute`) — no innerHTML assignment.
 */

const FILE_ID_ATTR = "data-file-id";

// Walk the HTML, find all <img data-file-id="..."> tags, fetch download URLs
// in parallel, and return HTML with `src` attributes injected. Existing src
// attributes are overwritten so a re-render always shows a fresh URL.
//
// Images without `data-file-id` (e.g., external URLs pasted into a note) are
// left alone.
export async function enrichImageSrc(html: string, workspaceId: string): Promise<string> {
  if (!html || !html.includes(FILE_ID_ATTR)) return html;

  const doc = parseFragment(html);
  const imgs = Array.from(doc.body.querySelectorAll(`img[${FILE_ID_ATTR}]`));
  if (imgs.length === 0) return html;

  const fileIds = Array.from(
    new Set(imgs.map((el) => el.getAttribute(FILE_ID_ATTR)!).filter(Boolean)),
  );
  const urlMap = new Map<string, string>();

  await Promise.all(
    fileIds.map(async (fileId) => {
      try {
        const url = await getDownloadUrl(workspaceId, fileId);
        urlMap.set(fileId, url);
      } catch {
        // Leave broken; the <img> will render with no src and the browser's
        // alt text takes over. Beats stalling the whole note on one missing
        // image.
      }
    }),
  );

  for (const img of imgs) {
    const fileId = img.getAttribute(FILE_ID_ATTR);
    if (!fileId) continue;
    const url = urlMap.get(fileId);
    if (url) img.setAttribute("src", url);
    else img.removeAttribute("src");
  }

  return doc.body.innerHTML;
}

// Strip the `src` attribute from <img> tags that have a `data-file-id`.
// External images (no file-id) keep their src untouched. Idempotent.
export function stripImageSrc(html: string): string {
  if (!html || !html.includes(FILE_ID_ATTR)) return html;
  const doc = parseFragment(html);
  const imgs = doc.body.querySelectorAll(`img[${FILE_ID_ATTR}]`);
  for (const img of Array.from(imgs)) img.removeAttribute("src");
  return doc.body.innerHTML;
}

// Helpers --------------------------------------------------------------

function parseFragment(html: string): Document {
  return new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${html}</body></html>`,
    "text/html",
  );
}
