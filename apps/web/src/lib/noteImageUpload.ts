import { uploadFile, getDownloadUrl, type FileRow } from "@/lib/storage";

/**
 * Upload an image file to S3 (via the API) and return both the persisted
 * file row and a freshly-signed display URL. The editor uses the URL for
 * live preview and embeds the file id (not the URL) into note HTML so the
 * persisted form stays stable across signed-URL TTLs.
 */
export interface UploadedNoteImage {
  fileId: string;
  url: string;
  file: FileRow;
}

export async function uploadNoteImage(
  workspaceId: string,
  file: File,
): Promise<UploadedNoteImage> {
  // The uploader returns `{ file, duplicate, existing? }`; for note images the
  // duplicate path is harmless — we get the existing row and use it directly.
  const result = await uploadFile(workspaceId, file, { category: "note-image" });
  const row = result.file;
  const url = await getDownloadUrl(workspaceId, row.id);
  return { fileId: row.id, url, file: row };
}
