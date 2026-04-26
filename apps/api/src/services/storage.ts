import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

// File-storage thin layer. Presigned PUT for upload, presigned GET for
// download — the API never proxies bytes. Bucket-level "block public access"
// is the source of truth for visibility; signed URLs are the only way out.

let cachedClient: S3Client | null = null;

function getS3(): S3Client {
  if (cachedClient) return cachedClient;
  const credentials =
    env.AWS_S3_ACCESS_KEY_ID && env.AWS_S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.AWS_S3_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_S3_SECRET_ACCESS_KEY,
        }
      : undefined;
  cachedClient = new S3Client({
    region: env.AWS_REGION,
    ...(credentials ? { credentials } : {}),
  });
  return cachedClient;
}

function getBucket(): string {
  if (!env.AWS_S3_BUCKET) {
    throw new Error("storage requires AWS_S3_BUCKET to be set");
  }
  return env.AWS_S3_BUCKET;
}

export function isStorageConfigured(): boolean {
  return Boolean(env.AWS_S3_BUCKET);
}

// Reset the cached client. Tests use this between scenarios so a re-mocked
// SDK doesn't keep talking to the previous mock.
export function resetStorageClientForTests(): void {
  cachedClient = null;
}

export type FileCategory = "file" | "note-image" | "profile-doc";

export interface BuildKeyArgs {
  workspaceId: string;
  category: FileCategory;
  filename: string;
}

// Stable key shape: workspaces/{wsid}/{category-prefix}/{uuid}/{name}.
// The UUID isolates two uploads of the same filename and lets us look up
// the row by storage_key without parsing the rest.
export function buildStorageKey({ workspaceId, category, filename }: BuildKeyArgs): string {
  const prefix =
    category === "note-image"
      ? "note-images"
      : category === "profile-doc"
        ? "profile-docs"
        : "files";
  const uuid = crypto.randomUUID();
  // Normalize the filename: strip path traversal, collapse whitespace, cap
  // length. Real sanitization belongs at the route layer; this is defense in
  // depth so a bad name can't escape the prefix.
  const safe = filename
    .replace(/[\\/]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 200) || "file";
  return `workspaces/${workspaceId}/${prefix}/${uuid}/${safe}`;
}

export interface PresignArgs {
  storageKey: string;
  contentType?: string;
  ttlSeconds?: number;
}

export async function getUploadUrl({ storageKey, contentType, ttlSeconds }: PresignArgs): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
    ...(contentType ? { ContentType: contentType } : {}),
  });
  return getSignedUrl(getS3(), cmd, { expiresIn: ttlSeconds ?? env.AWS_S3_PRESIGN_TTL_SECONDS });
}

export async function getDownloadUrl({ storageKey, ttlSeconds }: { storageKey: string; ttlSeconds?: number }): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
  });
  return getSignedUrl(getS3(), cmd, { expiresIn: ttlSeconds ?? env.AWS_S3_PRESIGN_TTL_SECONDS });
}

export async function deleteObject(storageKey: string): Promise<void> {
  await getS3().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: storageKey,
    }),
  );
}

// Used by the confirm route to verify the SPA actually uploaded the bytes
// before we persist a row. Returns ContentLength when present so the route
// can compare against the size_bytes the SPA claimed.
export async function headObject(storageKey: string): Promise<{ exists: boolean; sizeBytes?: number }> {
  try {
    const res = await getS3().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: storageKey,
      }),
    );
    return { exists: true, sizeBytes: res.ContentLength };
  } catch (err) {
    if (err instanceof Error && (err.name === "NotFound" || err.name === "NoSuchKey")) {
      return { exists: false };
    }
    throw err;
  }
}
