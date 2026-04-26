# AWS provisioning runbook

One-time setup for the AWS resources that `apps/api` depends on. Run these against a fresh AWS account (or the existing project account, if you've consolidated). All resources live in `us-east-1` to match Cognito.

## What you'll create


| Resource                          | Used by                                                                              | Required                              |
| --------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- |
| Cognito User Pool + App Client    | Auth (`apps/api/src/auth/plugin.ts`)                                                 | Yes                                   |
| KMS customer-managed key          | `workspace_credentials` envelope encryption (`apps/api/src/services/credentials.ts`) | Yes for `/workspaces/:id/credentials` |
| S3 bucket                         | `files` storage (`apps/api/src/services/storage.ts`)                                 | Yes for `/workspaces/:id/files`       |
| IAM user (or role) for `apps/api` | Service principal that signs S3 URLs and calls KMS                                   | Yes                                   |


For Cognito, see `MIGRATION_PLAN.md` → "Cognito setup" — that section is canonical.

## 1. KMS key

Console → KMS → Customer managed keys → Create key.

- **Key type:** Symmetric.
- **Key usage:** Encrypt and decrypt.
- **Alias:** `desh-credentials-dev` / `desh-credentials-prod`.
- **Key administrators:** your IAM user (so you can manage rotation later).
- **Key users:** the API service principal you'll create in step 3.

After creation, capture the alias ARN (`arn:aws:kms:us-east-1:<account>:alias/desh-credentials-dev`) — that's `KMS_KEY_ID`.

The encryption layer uses `GenerateDataKey` + `Decrypt` only, with `EncryptionContext: { workspace_id: <uuid> }` bound on every call. KMS refuses to decrypt if the context doesn't match, which prevents cross-workspace ciphertext swapping at the cloud-provider level. Don't disable that.

## 2. S3 bucket

Console → S3 → Create bucket.

- **Name:** `desh-private-dev` / `desh-private-prod` (S3 names are global; pick alternatives if taken — e.g., `desh-private-dev-<initials>`).
- **Region:** `us-east-1`.
- **Block Public Access:** **all four checkboxes ON.** This is the "all private, signed URLs everywhere" decision in code form. Don't turn any off.
- **Bucket versioning:** off (v1).
- **Default encryption:** SSE-S3 (AES-256, AWS-managed). Free, on by default.
- **Object ownership:** Bucket owner enforced (disables ACLs).

After creation, also configure:

### CORS

The SPA does direct-browser PUT to S3 against presigned URLs. CORS must allow your dev + prod origins.

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["http://localhost:8080", "https://desh.app"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Replace `https://desh.app` with the production origin. If you have a staging origin, add it.

### Lifecycle (optional, recommended)

Add an aborted-multipart-upload cleanup rule (1 day). Doesn't affect single-PUT uploads but cheap insurance.

## 3. IAM user for `apps/api`

The API service signs presigned URLs (which requires AWS credentials at sign time) and calls KMS. Two principal options:

- **EC2/ECS instance role** (production): attach a role to the running compute, no static creds.
- **IAM user with access keys** (local dev / non-AWS host): static keys live in `apps/api/.env`.

Either way, the policy is the same. Console → IAM → Users → Create user (or attach to an existing role).

### Permissions policy (minimum scope)

Replace `<bucket>` with your bucket name and `<kms-arn>` with the KMS key ARN.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3ObjectAccess",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<bucket>/workspaces/*"
    },
    {
      "Sid": "S3ListBucketScoped",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<bucket>",
      "Condition": { "StringLike": { "s3:prefix": ["workspaces/*"] } }
    },
    {
      "Sid": "KmsCredentialEnvelope",
      "Effect": "Allow",
      "Action": ["kms:GenerateDataKey", "kms:Decrypt"],
      "Resource": "<kms-arn>"
    }
  ]
}
```

Notes:

- `s3:*` is **wrong** here — keep it scoped. The whole point of envelope encryption + presigned URLs is that a leak of the API's credentials shouldn't grant access to anything outside its bucket prefix.
- The S3 statement is scoped to `workspaces/`* — the same prefix the `buildStorageKey()` helper emits. If you ever add a non-workspace key prefix, widen carefully.
- If your IAM user generates access keys: rotate them on the AWS-recommended schedule and never commit them.

## 4. Wire it into `apps/api/.env`

```sh
# Cognito (per the existing MIGRATION_PLAN section)
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXX
COGNITO_CLIENT_ID=...

# KMS — the alias you created in step 1.
AWS_REGION=us-east-1
KMS_KEY_ID=arn:aws:kms:us-east-1:<account>:alias/desh-credentials-dev

# S3 — bucket + (optional) explicit credentials. If you're on EC2/ECS with
# an instance role, leave the access-key pair empty; the SDK picks up the
# role automatically. For local dev, set the keys from your IAM user.
AWS_S3_BUCKET=desh-private-dev
AWS_S3_ACCESS_KEY_ID=AKIA...
AWS_S3_SECRET_ACCESS_KEY=...
AWS_S3_PRESIGN_TTL_SECONDS=60

# Composio webhook (already in place)
COMPOSIO_WEBHOOK_SECRET=...
```

When unset, the routes fail closed: `/workspaces/:id/files/*` returns 503 if `AWS_S3_BUCKET` is missing; `/workspaces/:id/credentials` returns 503 if `KMS_KEY_ID` is missing. You'll see this on first `/dev/api` boot if you forget to populate them.

## 5. Verification

After populating the env vars, run a real round-trip from the host:

```sh
pnpm --filter @desh/api dev
```

In another shell, with a Cognito access token in `$TOKEN` and a workspace UUID in `$WS`:

```sh
# 1. Mint an upload URL.
curl -sS -X POST http://localhost:3001/workspaces/$WS/files/upload-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"hello.txt","mimeType":"text/plain","category":"file"}'
# Capture uploadUrl + storageKey.

# 2. PUT bytes to S3.
curl -sS -X PUT "$UPLOAD_URL" -H "Content-Type: text/plain" --data-binary "hello"

# 3. Confirm.
curl -sS -X POST http://localhost:3001/workspaces/$WS/files/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"storageKey\":\"$STORAGE_KEY\",\"name\":\"hello.txt\",\"mimeType\":\"text/plain\",\"sizeBytes\":5,\"category\":\"file\"}"
# Expect 201 with the file row.

# 4. Download URL.
curl -sS http://localhost:3001/workspaces/$WS/files/$FILE_ID/download-url \
  -H "Authorization: Bearer $TOKEN"
curl -sS "$DOWNLOAD_URL"
# → "hello"
```

For credentials:

```sh
# Encrypt + persist.
curl -sS -X PUT http://localhost:3001/workspaces/$WS/credentials/openrouter \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"value":"sk-or-test","meta":{"hint":"sk-or-…test"}}'

# Inspect — meta is visible, ciphertext is bytea (not human-readable).
psql "$DATABASE_URL" -c \
  "SELECT length(ciphertext), meta FROM workspace_credentials WHERE workspace_id='$WS';"
```

If any of these fail, the server log line includes the AWS-side error code (`AccessDenied`, `InvalidCiphertext`, etc.) — usually points straight at the IAM policy mistake.