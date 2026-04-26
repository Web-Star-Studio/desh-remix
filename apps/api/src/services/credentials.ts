import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
} from "@aws-sdk/client-kms";
import { env } from "../config/env.js";

// Envelope-encryption layout (single bytea blob):
//   [version: 1 byte = 0x01]
//   [edk_len: 2 bytes BE]
//   [edk: edk_len bytes]            ← KMS-encrypted data key
//   [iv: 12 bytes]
//   [tag: 16 bytes]                 ← AES-GCM auth tag
//   [ciphertext: rest]
//
// Encryption context binds each ciphertext to a workspace; KMS refuses to
// decrypt if the context doesn't match, which prevents cross-workspace
// ciphertext swapping.
const VERSION = 0x01;
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedClient: KMSClient | null = null;

function getKms(): KMSClient {
  if (!env.KMS_KEY_ID) {
    throw new Error(
      "credentials.encrypt/decrypt requires KMS_KEY_ID (and AWS_REGION) to be set",
    );
  }
  cachedClient ??= new KMSClient({ region: env.AWS_REGION });
  return cachedClient;
}

export interface EncryptOptions {
  workspaceId: string;
}

export async function encryptCredential(
  plaintext: string | Uint8Array,
  opts: EncryptOptions,
): Promise<Buffer> {
  const kms = getKms();
  const data = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : Buffer.from(plaintext);

  const dk = await kms.send(
    new GenerateDataKeyCommand({
      KeyId: env.KMS_KEY_ID!,
      KeySpec: "AES_256",
      EncryptionContext: { workspace_id: opts.workspaceId },
    }),
  );
  if (!dk.Plaintext || !dk.CiphertextBlob) {
    throw new Error("KMS GenerateDataKey returned no key material");
  }

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(dk.Plaintext), iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Best-effort wipe of plaintext data key.
  Buffer.from(dk.Plaintext).fill(0);

  const edk = Buffer.from(dk.CiphertextBlob);
  const edkLen = Buffer.alloc(2);
  edkLen.writeUInt16BE(edk.length, 0);

  return Buffer.concat([
    Buffer.from([VERSION]),
    edkLen,
    edk,
    iv,
    tag,
    ciphertext,
  ]);
}

export async function decryptCredential(
  blob: Uint8Array | Buffer,
  opts: EncryptOptions,
): Promise<Buffer> {
  const buf = Buffer.from(blob);
  if (buf.length < 1 + 2 + IV_LEN + TAG_LEN) {
    throw new Error("ciphertext blob too short");
  }
  const version = buf.readUInt8(0);
  if (version !== VERSION) {
    throw new Error(`unsupported credential blob version ${version}`);
  }
  const edkLen = buf.readUInt16BE(1);
  let off = 3;
  const edk = buf.subarray(off, off + edkLen);
  off += edkLen;
  const iv = buf.subarray(off, off + IV_LEN);
  off += IV_LEN;
  const tag = buf.subarray(off, off + TAG_LEN);
  off += TAG_LEN;
  const ciphertext = buf.subarray(off);

  const kms = getKms();
  const dk = await kms.send(
    new DecryptCommand({
      CiphertextBlob: edk,
      EncryptionContext: { workspace_id: opts.workspaceId },
    }),
  );
  if (!dk.Plaintext) throw new Error("KMS Decrypt returned no key material");

  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(dk.Plaintext), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  Buffer.from(dk.Plaintext).fill(0);
  return plaintext;
}

export function isCredentialEncryptionConfigured(): boolean {
  return Boolean(env.KMS_KEY_ID);
}
