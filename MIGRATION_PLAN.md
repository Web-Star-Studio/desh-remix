# Desh Migration Plan

This document inventories the existing Supabase-backed Vite SPA (now under `apps/web/`) and lays out the migration to a workspace-scoped Hermes-Agent backend (`apps/api/`) with first-party Postgres (`packages/database/`).

The PRD is the source of truth: workspace = Hermes profile, user ≠ profile, OpenRouter is the only inference provider, default model `moonshotai/kimi-k2.6`.

This pass is **scaffolding only**. Code under `apps/web/` continues to call Supabase as it did before. Code under `apps/api/` only serves `/health`; every other endpoint returns `501 Not Implemented`.

## Decisions


| Topic                        | Choice                                                        | Rationale                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend framework            | **Fastify 5**                                                 | Node-first, mature plugin ecosystem (CORS, JWT, sensible, SSE), and `fastify-type-provider-zod` lets `@desh/shared` zod schemas type request/response payloads end-to-end. Hono is edge-first and would be additional ceremony for our localhost-Hermes-callback story. |
| ORM + driver                 | **Drizzle ORM + `postgres`**                                  | One TS schema generates both migrations (drizzle-kit) and typed queries; integrates cleanly with the zod schemas in `@desh/shared`. Lighter than Prisma, more typed than raw `node-pg-migrate`.                                                                         |
| Target auth provider         | **AWS Cognito**                                               | RS256 JWTs verified via JWKS (no shared secret), Hosted UI handles Google/Apple OAuth, multi-region.                                                                                                                                                                    |
| Auth bridge during migration | **Cognito (target) + Supabase (legacy), tried in that order** | Lets the SPA keep working with Supabase tokens while the Cognito user pool is provisioned. The plugin tries Cognito first if configured, falls back to Supabase. Token shapes are disjoint (RS256 vs HS256) so a token only succeeds under one path.                    |
| Inference provider           | **OpenRouter only**                                           | Locked at the schema level (`agent_profiles.provider = 'openrouter'` CHECK constraint) and the API level (`AgentSettingsPatchSchema` only accepts a model id).                                                                                                          |
| Default model                | `moonshotai/kimi-k2.6`                                        | DB default + zod default.                                                                                                                                                                                                                                               |
| Data strategy                | **Greenfield reset**                                          | New DB starts empty. Legacy Supabase data is left in place on the legacy project. No backfill scripts in this pass.                                                                                                                                                     |
| Monorepo tooling             | **pnpm workspaces only**                                      | 2 apps × 3 packages doesn't justify Turborepo or Nx. `pnpm -r` and `pnpm --filter` are sufficient.                                                                                                                                                                      |
| `packages/config`            | **Deferred**                                                  | Single root `tsconfig.base.json` + per-package overrides instead. Re-evaluate when shared rules grow past ~3 identical lines.                                                                                                                                           |


## Architecture target

```
React SPA (apps/web)
  → REST/SSE (apps/api, Fastify on Node)
    → Postgres (packages/database, Drizzle)
    → Per-workspace Hermes gateway (saas_web adapter @ http://127.0.0.1:<port>/messages)
      → AIAgent
      → Composio toolkits / memory / sessions
```

`apps/api` owns: auth, workspaces, conversations, agent_events, agent profile lifecycle (create/start/stop/restart/health), Composio connections, Hermes adapter callbacks. It is **not** the agent runtime — Hermes is.

## Repository layout

```
desh-remix/
├── package.json                  monorepo-level scripts only
├── pnpm-workspace.yaml           apps/* + packages/*
├── tsconfig.base.json            shared compiler defaults
├── .prettierrc
├── .gitignore                    excludes apps/*/.env etc.
├── docs/                         existing docs (DATABASE_MAP.md, etc.)
├── legacy/
│   └── supabase/                 130+ migrations + 54 edge functions, untouched
├── apps/
│   ├── web/                      React + Vite SPA, moved untouched (Lovable plugin removed)
│   └── api/                      Fastify backend; today only /health is real
└── packages/
    ├── shared/                   zod schemas + Hermes contract types
    └── database/                 Drizzle schema for the 8 PRD tables + migrate/seed
```

## Supabase usage inventory

The SPA at `apps/web/` imports the Supabase client in 199 files. Categories (file paths relative to repo root):

### Auth (Supabase JS)

- `apps/web/src/contexts/AuthContext.tsx` — central auth state, `onAuthStateChange`, `getSession`, profile fetch.
- `apps/web/src/hooks/common/useAuthSession.ts` — session helper.
- `apps/web/src/components/onboarding/OnboardingWizard.tsx` — sign-up flow.
- `apps/web/src/pages/AuthPage.tsx` — auth UI.

### Database (`.from`/`.select`/`.insert`/`.update`/`.delete`/`.rpc`)

~120 files. Largest concentrations:

- `apps/web/src/contexts/WorkspaceContext.tsx` — workspaces, workspace_preferences, workspace_documents.
- `apps/web/src/hooks/ai/*` — ai_conversations, ai_agents, ai_projects.
- `apps/web/src/hooks/finance/useDbFinances.ts` — transactions/budgets/recurring.
- `apps/web/src/hooks/messages/useMessagesSyncEngine.ts` — whatsapp_*.
- `apps/web/src/hooks/automation/useAutomations.ts` — automation_rules, automation_history.
- `apps/web/src/pages/BillingPage.tsx` — credit_packages, credit_transactions.
- `apps/web/src/pages/ActivityLogsPage.tsx` — user_activity_logs.

### Storage (`.storage.from('user-files')`)

- `apps/web/src/components/profile/ProfileDocumentsSection.tsx`
- `apps/web/src/components/onboarding/OnboardingWizard.tsx` (avatar)
- `apps/web/src/lib/noteImageUpload.ts`

### Realtime (`.channel`/`.subscribe`)

- `apps/web/src/components/messages/ChatView.tsx`
- `apps/web/src/components/messages/ConversationList.tsx`
- `apps/web/src/components/dashboard/WhatsAppWebMonitor.tsx`
- `apps/web/src/hooks/messages/useMessagesSyncEngine.ts`

### Edge functions (`.functions.invoke`)

54 functions live in `legacy/supabase/functions/`. Heavily used by the SPA today; classified per feature below.

## Per-feature migration matrix

Scope tags:

- **PRD-now** — touched in this scaffolding pass (stubs only or plan/schema lands).
- **PRD-future** — planned post-scaffolding, not in this PR.
- **Out-of-scope** — legacy, leave running on Supabase, decide later.


| Feature                | Current (legacy)                                                                                                                                                                              | Target                                                                                    | Next step                                                                                                                                                                                                                                                                                                                        | Scope                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Auth                   | `@supabase/supabase-js` + Supabase JWTs in localStorage; `auth-email-hook`, `auth-phone-otp` edge fns; Lovable Cloud auth (REMOVED)                                                           | **AWS Cognito** user pool + Hosted UI for OAuth; `users` table seeded from Cognito `sub`  | Backend Cognito JWT verifier scaffolded (`apps/api/src/auth/cognito-jwt.ts`) and `/auth/me` returns `{id,email,source}` whenever a valid token (Cognito or Supabase) is presented. Frontend swap (replace `@supabase/supabase-js` auth with `@aws-amplify/auth`) ships once a real user pool exists — see "Cognito setup" below. | PRD-now (in progress)                                          |
| Workspace mgmt         | `workspaces` table user-owned; `workspace_shares` for read sharing                                                                                                                            | `workspaces` + `workspace_members` with roles                                             | Schema lands in `packages/database`; routes are 501 stubs                                                                                                                                                                                                                                                                        | PRD-now                                                        |
| Chat / conversations   | `ai_conversations` with embedded JSONB messages; `ai-router`, `chat`, `pandora-`* edge fns                                                                                                    | `conversations` + append-only `agent_events` driven by Hermes; SSE from `apps/api` to web | Schema lands; `/conversations/*` is 501; will own this once Hermes lifecycle exists                                                                                                                                                                                                                                              | PRD-now                                                        |
| Agent settings / model | Hardcoded model dropdown in `AgentForm.tsx` (Gemini/GPT)                                                                                                                                      | OpenRouter only; free-text model id input, default `moonshotai/kimi-k2.6`                 | `AgentSettingsPatchSchema` exported from `@desh/shared`; `PATCH /workspaces/:id/agent/settings/model` is 501; web-side input swap follows                                                                                                                                                                                        | PRD-now                                                        |
| Composio               | `composio-proxy` / `composio-webhook` edge fns; `composio_user_emails`, `composio_action_logs`                                                                                                | `composio_connections` table; backend owns OAuth callback + tool dispatch                 | Table lands; routes deferred                                                                                                                                                                                                                                                                                                     | PRD-future                                                     |
| Automations / cron     | `automation-cron` + `automation-execute` + `automation-listener` (pg_cron every 5 min)                                                                                                        | Backend scheduler (e.g. `pg-boss`) inside `apps/api`                                      | Out of scaffolding scope; pg_cron keeps running on legacy                                                                                                                                                                                                                                                                        | PRD-future                                                     |
| File storage           | Supabase storage `user-files` bucket; `files-storage` edge fn                                                                                                                                 | Backend-owned object storage (S3 vs R2 TBD)                                               | Defer until provider is chosen; SPA keeps using Supabase                                                                                                                                                                                                                                                                         | PRD-future                                                     |
| Existing AI features   | `ai-router`, `deep-research`, `pandora-mcp`, `pandora-whatsapp`, `tool-worker`, `media-gen`, `welcome-chat`, `ai-proactive-insights`, `chat`                                                  | Sunset once Hermes path proves out                                                        | Run in parallel; do not extend; mark with `// LEGACY:` when touched                                                                                                                                                                                                                                                              | PRD-future (sunset)                                            |
| Billing / Stripe       | `billing`, `stripe-webhook` edge fns; credit_* tables                                                                                                                                         | Not migrating in MVP                                                                      | Decision deferred                                                                                                                                                                                                                                                                                                                | Out-of-scope                                                   |
| Finance                | `finance-sync`, `pluggy-proxy`, `zernio-`*, `financial-*`, `financial_*` tables                                                                                                               | None                                                                                      | Legacy, leave running                                                                                                                                                                                                                                                                                                            | Out-of-scope                                                   |
| WhatsApp               | `whatsapp-proxy`, `whatsapp-webhook`, `whatsapp-gateway-callback`, `whatsapp-web-proxy`, `whatsapp-embedded-signup`, `whatsapp-transfer`, `late-proxy`, `pandora-whatsapp`; whatsapp_* tables | None                                                                                      | Legacy                                                                                                                                                                                                                                                                                                                           | Out-of-scope (re-evaluate when Hermes adds messaging adapters) |
| Email                  | `email-system`, `email-automation-runner`, `email-unsubscribe`, `gmail-gateway`, `gmail-webhook`, `send-notification-email`                                                                   | None                                                                                      | Legacy                                                                                                                                                                                                                                                                                                                           | Out-of-scope                                                   |
| Blog                   | `generate-blog-draft`, `sitemap`                                                                                                                                                              | None                                                                                      | Legacy                                                                                                                                                                                                                                                                                                                           | Out-of-scope                                                   |
| Social / search / misc | `search-web`, `serp-proxy`, `mapbox-proxy`, `widgets-proxy`, `late-proxy`, `facebook-auth`                                                                                                    | None                                                                                      | Legacy                                                                                                                                                                                                                                                                                                                           | Out-of-scope                                                   |


## Cognito setup (manual, in AWS Console)

Required to flip the SPA from Supabase auth to Cognito. The backend already accepts Cognito JWTs once the env vars are populated; this list creates the resources those env vars point to.

1. **User Pool** (`aws cognito-idp create-user-pool` or Console → Cognito → Create user pool)
  - Sign-in options: email
  - Password policy: defaults are fine for dev
  - MFA: optional / off for MVP
  - Account recovery: email
  - Note the **User Pool ID** (e.g. `us-east-1_AbCdEfGhI`)
2. **App Client** (User pool → App integration → App clients → Create app client)
  - Type: **Public client** (no secret) — the SPA is browser-only
  - Auth flows: `ALLOW_USER_SRP_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
  - Note the **Client ID**
3. **Hosted UI** (App client → Edit hosted UI settings)
  - Allowed callback URL: `http://localhost:8080/auth/callback` (dev) + your production origin
  - Allowed sign-out URL: `http://localhost:8080`
  - OAuth grant types: `Authorization code grant`
  - OAuth scopes: `email`, `openid`, `profile`
4. **Identity providers** (User pool → Sign-in experience → Federated identity provider sign-in)
  - **Google**: create OAuth credentials in Google Cloud Console, paste Client ID + secret. Map `email`, `name`, `picture` to Cognito attributes.
  - **Apple**: enroll in Apple Developer, generate Service ID + key.
5. **Domain** (User pool → App integration → Cognito domain)
  - Pick a Cognito-hosted prefix (free) or wire a custom domain.

Drop the values into `apps/api/.env`:

```
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_AbCdEfGhI
COGNITO_CLIENT_ID=<app-client-id>
```

Frontend swap (next PR, not in this pass):

- `pnpm --filter @desh/web add @aws-amplify/auth aws-amplify`
- Replace `apps/web/src/contexts/AuthContext.tsx`'s Supabase calls with Amplify's `signIn`, `signOut`, `getCurrentUser`, `fetchAuthSession`.
- Replace `apps/web/src/pages/AuthPage.tsx`'s direct `supabase.auth.signInWithOAuth` with Amplify's `signInWithRedirect({ provider: "Google" })` (or redirect into the Hosted UI).
- Send Cognito access tokens to `apps/api` in the `Authorization: Bearer …` header. The auth bridge already accepts them.

Once the SPA is on Cognito, drop `SUPABASE_JWT_SECRET` from `apps/api/.env` and remove the Supabase fallback from `apps/api/src/auth/plugin.ts`.

## Hermes integration plan (post-scaffolding)

The `apps/api/src/services/hermes-client.ts` stub captures the contract: `POST http://127.0.0.1:<port>/messages` with `Authorization: Bearer <adapter_secret>`, payload shape per `@desh/shared/hermes`. `apps/api/src/routes/hermes.ts` accepts callbacks at `/internal/hermes/events` guarded by `INTERNAL_CALLBACK_TOKEN`.

Profile lifecycle (to implement): `create` (renders `config.yaml` + `.env`, allocates port, writes `agent_profiles` row), `start` / `stop` / `restart` (manages the gateway process), `health` (HTTP `GET /health` against the gateway). Per-profile env-vars include `OPENROUTER_API_KEY`, `SAAS_WEB_KEY` (= `adapter_secret`), `SAAS_WEB_CALLBACK_URL`, `SAAS_WEB_CALLBACK_KEY`, `SAAS_WEB_PORT`, `SAAS_WEB_WORKSPACE_ID`, `SAAS_WEB_WORKSPACE_NAME`. Port allocation must come from `agent_profiles.hermes_port` (DB-stored, not derived).

The DB enforces the stable `hermes_profile_name` invariant via a STORED generated column: `'ws_' || replace(workspace_id::text, '-', '')`. This means workspace renames cannot break the Hermes profile mapping.

## Risks & open questions

1. **Hermes deployment topology.** PRD assumes `127.0.0.1:<port>` co-location. Multi-instance API + sticky-routing to the right Hermes host is unsolved.
2. **Hermes profile re-creation collisions.** If a workspace UUID is ever reissued (restore-from-backup), `hermes_profile_name` collides. Decide: hard-delete with cascading Hermes-side cleanup, or never reuse UUIDs.
3. **OpenRouter API key ownership.** PRD recommends platform-managed for MVP. Schema supports per-workspace via `workspace_credentials`, but the API will start by reading a platform key from env. Document the switchover path before launch.
4. `**workspace_credentials` envelope encryption.** KMS provider unchosen. The column exists but the encrypt/decrypt path is `TODO: pick KMS`. Block production deploy on this.
5. **Auth bridge longevity.** Bridge stays in place until the Cognito user pool is provisioned and the SPA is on `@aws-amplify/auth`. Once the swap lands, `SUPABASE_JWT_SECRET` is removed from `apps/api/.env` and the Supabase fallback in `apps/api/src/auth/plugin.ts` is deleted.
6. **54 legacy edge functions.** Until the survivability list is frozen, none can be removed from `legacy/supabase/functions/`.
7. **Lovable cleanup status.** `@lovable.dev/cloud-auth-js` and `lovable-tagger` REMOVED. `apps/web/src/integrations/lovable/` directory deleted. Service-worker preview-host gate in `apps/web/src/main.tsx` removed. Cosmetic string references remain (admin docs, landing page, email template defaults that mention `lovable.app` / `lovable.dev`); these are user-facing copy to update when the production domain is finalized.
8. **PWA after the move.** `vite-plugin-pwa`'s virtual module + 9 validation scripts under `apps/web/scripts/` are sensitive to layout. Smoke-test `pnpm build` carefully.
9. **Sunset signal for legacy AI.** No code path is being deleted in this pass, but the PRD implies new Hermes-driven chat replaces `ai-router`/`chat`/`pandora-`*. Need a dated sunset commitment or the codebases drift.

## Verification (run from repo root after scaffolding)

```sh
pnpm install                        # regenerates pnpm-lock.yaml for the workspace
pnpm typecheck                      # all packages compile
pnpm lint                           # all packages lint
pnpm build                          # apps/web builds (PWA validators run); apps/api emits dist
pnpm db:generate                    # produces packages/database/migrations/0000_*.sql
pnpm dev:web                        # SPA still serves at http://localhost:8080
pnpm dev:api                        # Fastify on http://localhost:3001 → curl /health
pnpm test                           # vitest passes (existing web tests + new health.test.ts)
```

The greenfield Postgres is **not** required for `pnpm dev:api` — `/health` returns `db: "down"` if `DATABASE_URL` is unset. To exercise the schema:

```sh
createdb desh_dev
DATABASE_URL=postgres://localhost:5432/desh_dev pnpm db:migrate
DATABASE_URL=postgres://localhost:5432/desh_dev pnpm db:seed
```

