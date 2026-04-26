# Desh Migration Plan

This document inventories the existing Supabase-backed Vite SPA (now under `apps/web/`) and lays out the migration to a workspace-scoped Hermes-Agent backend (`apps/api/`) with first-party Postgres (`packages/database/`).

The PRD is the source of truth: workspace = Hermes profile, user ≠ profile, OpenRouter is the only inference provider, default model `moonshotai/kimi-k2.6`.

The migration is incremental. Core auth/workspace/chat/Hermes pieces are moving into `apps/api`, while older feature modules continue to call Supabase until their replacement backend routes, jobs, webhooks, and schemas are implemented. Supabase is a bridge, not the target runtime.

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
│   ├── web/                      React + Vite SPA, gradually rewired from Supabase to apps/api
│   └── api/                      Fastify backend for auth/workspaces/Hermes and future feature modules
└── packages/
    ├── shared/                   zod schemas + Hermes contract types
    └── database/                 Drizzle schema for the 8 PRD tables + tasks/contacts + migrate/seed
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

- **Core migration** — required foundation before broad feature migration.
- **Feature migration** — product feature to keep; migrate from Supabase to `apps/api` after the core backend is stable.
- **Legacy bridge** — temporarily remains on Supabase only while the replacement backend route/schema/job is being built.


| Feature                | Current (legacy)                                                                                                                                                                              | Target                                                                                    | Next step                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Scope             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Auth                   | `@supabase/supabase-js` + Supabase JWTs in localStorage; `auth-email-hook`, `auth-phone-otp` edge fns; Lovable Cloud auth (REMOVED)                                                           | **AWS Cognito** user pool + Hosted UI for OAuth; `users` table seeded from Cognito `sub`  | **DONE.** `apps/api/src/auth/plugin.ts` is Cognito-only (RS256 via JWKS); the Supabase HS256 fallback and `apps/api/src/auth/supabase-jwt.ts` are gone. SPA already uses `aws-amplify/auth` (`AuthContext.tsx`, `AuthPage.tsx`, `api-client.ts`). Vitest setup mocks the Cognito verifier so test tokens still work. | Done    |
| Workspace mgmt         | `workspaces` table user-owned; `workspace_shares` for read sharing                                                                                                                            | `workspaces` + `workspace_members` with roles                                             | **DONE.** `apps/api` owns `GET/POST/PATCH/DELETE /workspaces`. `POST /workspaces` provisions the agent_profile (port + secrets) in the same transaction and fire-and-forgets the Composio MCP URL mint + `agent_profiles.config.composio_mcp_url` write. Onboarding wizard now creates workspaces explicitly — `ensureUser` only writes the `users` row.                                                                                                                            | Done              |
| Chat / conversations   | `ai_conversations` with embedded JSONB messages; `ai-router`, `chat`, `pandora-`* edge fns                                                                                                    | `conversations` + append-only `agent_events` driven by Hermes; SSE from `apps/api` to web | **DONE.** apps/api owns `GET/POST/PATCH/DELETE /conversations` + `POST /:id/messages` + `GET /:id/events` (SSE). Per-workspace Hermes gateways are lazy-spawned by `apps/api/src/services/hermes/process-supervisor.ts` on first message and idle-stopped after `HERMES_IDLE_TIMEOUT_MS` (default 10 min). `ChatPanel.tsx` rewritten as a slim Hermes-native consumer; `AIPage.tsx` rewritten with React Query hooks; `AIChatWidget` mount removed pending Hermes-rewire follow-up. | Done              |
| Agent settings / model | Hardcoded model dropdown in `AgentForm.tsx` (Gemini/GPT)                                                                                                                                      | OpenRouter only; free-text model id input, default `moonshotai/kimi-k2.6`                 | `AgentSettingsPatchSchema` exported from `@desh/shared`; `PATCH /workspaces/:id/agent/settings/model` is 501; web-side input swap follows                                                                                                                                                                                                                                                                                                                                           | Core migration    |
| Composio               | `composio-proxy` / `composio-webhook` edge fns; `composio_user_emails`, `composio_action_logs`                                                                                                | `composio_connections` table; backend owns OAuth callback + tool dispatch                 | **DONE.** Shipped: `/composio/connections` (list/disconnect), `/composio/connect` (OAuth start), `/composio/execute` (action proxy), `/composio/webhook` (HMAC-SHA256 verified ingestion that flips `composio_connections.status` on `connected_account.expired/created/updated/deleted`), entity resolution via `entityIdFor(workspaceId, userDbId)`, and a global custom MCP server (`desh-pandora`) with per-entity instance URLs minted on workspace creation. The MCP URL is wired into the workspace's Hermes profile via `mcp_servers.composio` in `config.yaml` with `x-api-key` from the per-profile `.env`. SPA-side: per-toolkit wrapper hooks (`useGmailActions`, `useCalendarActions`, `useDriveActions`) call `/composio/execute` and have replaced every in-scope `composio-proxy` call site (email/calendar/drive widgets + `EmailPage`). Remaining `composio-proxy` callers belong to deferred feature waves (AI/automation/contacts/files/search/social/tasks/notes/admin) and migrate with their wave. | Done    |
| Automations / cron     | `automation-cron` + `automation-execute` + `automation-listener` (pg_cron every 5 min)                                                                                                        | Backend scheduler (e.g. `pg-boss`) inside `apps/api`                                      | Keep running on legacy until scheduler tables/jobs are ported; then migrate automation routes and workers module-by-module.                                                                                                                                                                                                                                                                                                                                                         | Feature migration |
| File storage           | Supabase storage `user-files` bucket; `files-storage` edge fn (Cloudflare R2)                                                                                                                 | **AWS S3** behind `apps/api`; signed PUT/GET URLs, no public bucket                       | **PARTIALLY DONE.** Shipped: `files` table + `apps/api/src/services/storage.ts` + `/workspaces/:id/files/{upload-url,confirm,list,:id/download-url,:id}` + the SPA `lib/storage.ts` wrapper. SPA-side: note-image upload (`noteImageUpload.ts` + `RichTextEditor`) and `ProfileDocumentsSection` migrated to AWS S3 via the new API; note HTML now stores `<img data-file-id="…">` and resolves to fresh signed URLs at render time. Provisioning runbook in `docs/AWS_PROVISIONING.md`. **Still pending:** retire the legacy `/files` page (still calls the R2-backed `files-storage` edge fn) — moves with the Files feature wave; migrate `profile_documents` table itself off Supabase (profile feature wave). | Feature migration |
| Existing AI features   | `ai-router`, `deep-research`, `pandora-mcp`, `pandora-whatsapp`, `tool-worker`, `media-gen`, `welcome-chat`, `ai-proactive-insights`, `chat`                                                  | Rebuild on Hermes + backend tools, not Supabase edge functions                            | Keep only until the equivalent Hermes tool or backend route exists. Preserve user-facing capabilities; delete only replaced implementation paths.                                                                                                                                                                                                                                                                                                                                   | Feature migration |
| Billing / Stripe       | `billing`, `stripe-webhook` edge fns; credit_* tables                                                                                                                                         | Backend Stripe webhooks + credit ledger in Postgres                                       | Migrate after auth/workspace identities are stable so subscription ownership maps to `workspace_members`/billing owner correctly.                                                                                                                                                                                                                                                                                                                                                   | Feature migration |
| Finance                | `finance-sync`, `pluggy-proxy`, `zernio-`*, `financial-`*, `finance_*` and `financial_*` tables                                                                                               | Backend finance module: manual transactions/budgets/goals plus Pluggy/Open Finance sync   | Port schemas for manual finance and provider-backed accounts/transactions; move Pluggy/Zernio proxy/webhooks into `apps/api`; expose typed CRUD/sync routes; rewire finance pages and Hermes finance tools to backend APIs.                                                                                                                                                                                                                                                         | Feature migration |
| WhatsApp               | `whatsapp-proxy`, `whatsapp-webhook`, `whatsapp-gateway-callback`, `whatsapp-web-proxy`, `whatsapp-embedded-signup`, `whatsapp-transfer`, `late-proxy`, `pandora-whatsapp`; whatsapp_* tables | Backend messaging module with Meta WhatsApp + WhatsApp Web gateway support                | Port session/conversation/message tables; replace edge functions with API routes and webhook endpoints; keep gateway process external but make it callback into `apps/api`; wire Hermes tools through backend message APIs.                                                                                                                                                                                                                                                         | Feature migration |
| Email                  | `email-system`, `email-automation-runner`, `email-unsubscribe`, `gmail-gateway`, `gmail-webhook`, `send-notification-email`; email caches/templates/rate limits                               | Backend email module using Composio/Gmail plus notification/template services             | Unify `emails_cache` and `gmail_messages_cache`; migrate Gmail watch/webhook, unsubscribe, batch actions, notification send logs, and email automation runner; rewire email pages to backend routes.                                                                                                                                                                                                                                                                                | Feature migration |
| Blog                   | `generate-blog-draft`, `sitemap`, `blog_posts` admin CRUD                                                                                                                                     | Backend blog/admin module with draft generation and sitemap generation                    | Port `blog_posts` schema and admin CRUD first; then move draft generation and sitemap generation into `apps/api` jobs/routes.                                                                                                                                                                                                                                                                                                                                                       | Feature migration |
| Social / search / misc | `search-web`, `serp-proxy`, `mapbox-proxy`, `widgets-proxy`, `late-proxy`, `facebook-auth`; social_* and search_* tables                                                                      | Backend modules for social publishing/analytics, search history/monitors, and proxy APIs  | Port social account/profile/post/template/subscription tables, search history/projects/monitors/preferences, and provider proxy routes. Keep Mapbox/Serp/Late/Facebook secrets server-side in `apps/api`.                                                                                                                                                                                                                                                                           | Feature migration |


The rows above are all intended product surface. Supabase is a temporary bridge for any row not yet migrated; it is not the long-term runtime for Finance, WhatsApp, Email, Blog, Social, Search, or Misc provider proxies.

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

Frontend swap (✅ shipped):

- `aws-amplify` + `@aws-amplify/auth` are wired into `apps/web/src/contexts/AuthContext.tsx`, `apps/web/src/pages/AuthPage.tsx`, and the API client.
- `apps/api` accepts Cognito access tokens (`Authorization: Bearer …`); only RS256 is honored.
- `SUPABASE_JWT_SECRET` is removed and `apps/api/src/auth/supabase-jwt.ts` is deleted.

## Hermes integration plan (post-scaffolding)

The `apps/api/src/services/hermes-client.ts` stub captures the contract: `POST http://127.0.0.1:<port>/messages` with `Authorization: Bearer <adapter_secret>`, payload shape per `@desh/shared/hermes`. `apps/api/src/routes/hermes.ts` accepts callbacks at `/internal/hermes/events` guarded by `INTERNAL_CALLBACK_TOKEN`.

Profile lifecycle (to implement): `create` (renders `config.yaml` + `.env`, allocates port, writes `agent_profiles` row), `start` / `stop` / `restart` (manages the gateway process), `health` (HTTP `GET /health` against the gateway). Per-profile env-vars include `OPENROUTER_API_KEY`, `SAAS_WEB_KEY` (= `adapter_secret`), `SAAS_WEB_CALLBACK_URL`, `SAAS_WEB_CALLBACK_KEY`, `SAAS_WEB_PORT`, `SAAS_WEB_WORKSPACE_ID`, `SAAS_WEB_WORKSPACE_NAME`. Port allocation must come from `agent_profiles.hermes_port` (DB-stored, not derived).

The DB enforces the stable `hermes_profile_name` invariant via a STORED generated column: `'ws_' || replace(workspace_id::text, '-', '')`. This means workspace renames cannot break the Hermes profile mapping.

## Hermes integration — operational notes (live)

The Hermes lifecycle is **lazy**: `apps/api/src/services/hermes/process-supervisor.ts` does not eagerly spawn gateways. On the first `POST /conversations/:id/messages` for a workspace, it:

1. Renders `${HERMES_HOME_BASE}/ws_<uuid>/{config.yaml,.env}` from the agent_profile's stored secrets + port.
2. `spawn(env.HERMES_BIN, ['-p', '<hermes_profile_name>', 'gateway'])` with the rendered env.
3. Polls `GET http://127.0.0.1:<port>/health` until 200 (or `HERMES_HEALTH_TIMEOUT_MS` elapses → 503 returned to the SPA).
4. POSTs the user message to `http://127.0.0.1:<port>/messages` with the per-profile adapter secret.

Hermes responds asynchronously by POSTing to `${HERMES_CALLBACK_BASE_URL}/internal/hermes/events`. Each event is persisted as an `agent_events` row and broadcast via in-memory pub/sub to all SSE subscribers on `GET /conversations/:id/events`.

Idle gateways are stopped after `HERMES_IDLE_TIMEOUT_MS` (default 10 min) by a sweep that runs every `HERMES_IDLE_SWEEP_MS` (default 1 min). Activity is bumped by both `ensureRunning()` (called per message) and `markActive()` (called on every Hermes callback) so a long agent reply doesn't get killed mid-stream.

**Required setup**:

- `hermes` binary on `PATH` (or `HERMES_BIN=/abs/path/to/hermes` in `apps/api/.env`)
- `OPENROUTER_API_KEY` in `apps/api/.env` — the Hermes gateway needs it to call OpenRouter
- `HERMES_HOME_BASE` should point at `~/.hermes/profiles/` (Hermes' canonical location). When `HERMES_BIN` is invoked with `-p <name>`, the CLI ignores `HERMES_HOME` and reads from `~/.hermes/profiles/<name>/` regardless. We render `config.yaml`/`.env`/`SOUL.md` into the same dir so all paths converge.

## Composio MCP per-workspace wiring (live)

Each workspace gets its own Composio MCP "instance" so the agent's tool catalog is scoped to that workspace's connections. Two-tier model:

- **Global custom MCP server** (`desh-pandora`) — one per Composio project. Bundles every toolkit in `COMPOSIO_MCP_TOOLKITS` (default: gmail, googlecalendar, googledrive, googletasks, googlecontacts). Created on first workspace via `POST /api/v3/mcp/servers/custom`; cached in `COMPOSIO_MCP_SERVER_ID`. If the env var is unset and Composio rejects re-create with `MCP_DuplicateServerName`, we self-heal by listing servers and matching by name.
- **Per-entity instance** — minted via `POST /api/v3/mcp/servers/{serverId}/instances` with `{ user_id: entityId }` where `entityId = ${workspaceId}_${userDbId}`. The mint API doesn't return a URL, so we synthesize the documented pattern: `https://backend.composio.dev/v3/mcp/<serverId>?user_id=<entityId>`. Dedupe is server-side; calling twice for the same `user_id` is idempotent.

**Auth on the MCP transport.** Composio's MCP gateway requires `x-api-key` (or a JWT Bearer) on the JSON-RPC POST. Without it: 401, error code 10401. We write `COMPOSIO_API_KEY=<value>` to the per-profile `.env` (mode 0o600) and reference it from `config.yaml` (mode 0o644) as `headers.x-api-key: "${COMPOSIO_API_KEY}"`. Hermes' `_expand_env_vars` resolves it at gateway boot via `os.environ.get`.

**Hermes CLI is interactive — bypassed.** The `hermes mcp add` subcommand is a TUI ("discovery-first install" — probes the server, lists tools, asks the user to pick). It can't be driven from Node with stdin closed. Instead we persist the URL on `agent_profiles.config.composio_mcp_url` (existing jsonb column, no migration) and have `apps/api/src/services/hermes/profile-config.ts` emit the `mcp_servers.composio` block directly into `config.yaml` on every gateway start. Hermes loads MCP servers from that file at boot.

**Failure mode handled in route.** The MCP mint runs as a fire-and-forget block after `POST /workspaces` commits. Failures are logged but don't fail the response — the gateway still spawns, just without Composio tools. Operator runs `pnpm --filter @desh/api mcp:repair` to retry; the script re-mints the URL, writes it to DB, and SIGTERMs the running gateway so the next message picks up the fresh `config.yaml`.

**Webhook ingestion.** `POST /composio/webhook` verifies `X-Composio-Signature` (HMAC-SHA256 over `${ts}.${rawBody}`) against `COMPOSIO_WEBHOOK_SECRET` and rejects timestamps older than 5 min. Handlers flip `composio_connections.status` on `connected_account.expired/created/updated/deleted`; `trigger.message` is logged as a stub for the future Hermes inbound bridge. Without the secret, the route returns 503 (fail closed).

**Pandora SOUL.md** (`apps/api/src/services/pandora-prompt.ts`) carries the persona + operational rules. Two MCP-relevant rules: (1) for any external integration (Gmail, Calendar, Drive, Tasks, Slack, Notion, etc.) the agent MUST prefer Composio MCP tools — other routes likely have no credentials; (2) never tell the user to type `/help` (that's CLI affordance, not DESH UI). `composeSoulMd()` runs on every gateway start, so SOUL.md changes propagate via the next cold-spawn — no migration needed.

## Dev tooling

Two scripts under `apps/api/scripts/`:

- `pnpm --filter @desh/api dev:reset` — wipes app data so the SPA looks like a fresh install. Deletes `agent_events → conversations → composio_connections → workspaces → users` in FK order (workspace cascade handles 5 child tables) and clears the contents of `~/.hermes/profiles/` (preserves the dir itself). Does **not** touch Cognito or pg-boss queue tables. Prints row counts before prompting `wipe`; supports `--yes` and `--keep-hermes`.
- `pnpm --filter @desh/api mcp:repair [<workspace-id>]` — diagnostics + recovery for the Composio MCP layer. For each workspace: looks up or creates the global custom MCP server, mints (or recovers) the per-entity URL, writes it to `agent_profiles.config`, and SIGTERMs the running gateway so the next chat message rebuilds the profile. Useful when the fire-and-forget block in `POST /workspaces` failed silently.

## Feature migration waves

Supabase removal is module-by-module. A feature is considered migrated only when its schema, server-side validation, provider secrets/webhooks/jobs, SPA callers, and Hermes tool access all use `apps/api`/Postgres instead of Supabase edge functions or RLS.

1. **Core foundation** — Cognito-only auth, workspace membership enforcement, Composio OAuth/action proxy, file/object-storage decision, background job runner, and shared API client patterns in `apps/web`.
2. **Hermes tool surface** — convert existing AI tool handlers into backend tools callable by Hermes: tasks, contacts (REST routes shipped — Hermes-tool exposure pending), calendar, email, finance, files, WhatsApp, search, and social actions. For Composio-backed surfaces (Gmail/Calendar/Drive/etc.) the agent already has access via the per-workspace MCP URL; first-party Hermes tools are only needed for non-Composio surfaces.
3. **Finance** — manual finance CRUD first (`finance_transactions`, budgets, goals, recurring), then Pluggy/Open Finance/Zernio provider sync, webhooks, enrichment, and dashboard widgets.
4. **Email + Composio Google** — Gmail connection status, cache unification, message search/read/send/batch actions, unsubscribe flows, notification email templates, and automation runner.
5. **WhatsApp** — Meta WhatsApp Business, WhatsApp Web sessions/gateway, conversations/messages/presence/logs, transfer flows, and Pandora/Hermes messaging actions.
6. **Social + Blog + Search/Misc** — social account/profile/post queue, analytics and subscriptions, blog CRUD/draft/sitemap, search history/projects/monitors, Serp/Mapbox/Late/Facebook proxy endpoints.
7. **Admin, billing, automations, observability** — Stripe/credit ledger, automation scheduler, activity logs, admin dashboards, Composio/action logs, webhook replay, and maintenance jobs.

During each wave, the legacy Supabase function stays live until the replacement route is shipped and the SPA path is rewired. Do not remove a page, hook, or edge function just because it is legacy; remove it only after a tracked replacement exists.

## Legacy AI hooks (deferred rewrite)

SPA modules below typecheck (build is green) but fail at runtime in the new stack whenever they depend on `useEdgeFn` / Supabase RLS / legacy chat functions. They should be rewritten behind backend routes or Hermes tools as their feature wave lands:

- `apps/web/src/hooks/ai/useAIConversations.ts`, `useAIToolExecution.ts`, `useToolJobQueue.ts`, `dataQueries.ts`, `toolHandlers{Task,Finance,Integration,System}.ts`
- `apps/web/src/hooks/common/useEdgeFn.ts` (~50 dashboard files: finance, WhatsApp, calendar, email, files, contacts, automations import this)
- `apps/web/src/lib/ai-router.ts`
- `apps/web/src/components/dashboard/AIChatWidget.tsx` (mount removed from App.tsx; file retained pending Hermes-wire decision)
- `apps/web/src/components/ai/{ConversationSidebar,AIStatsPanel,ContextPanel,AgentForm,ProjectForm,AgentTemplateLibrary}.tsx`

Cleanup rule: preserve user-facing features. Replace `useEdgeFn` and direct Supabase calls with typed backend clients one feature at a time, then delete only the obsolete hook/function implementation after the new path is verified.

## Risks & open questions

1. **Hermes deployment topology.** PRD assumes `127.0.0.1:<port>` co-location. Multi-instance API + sticky-routing to the right Hermes host is unsolved.
2. **Hermes profile re-creation collisions.** If a workspace UUID is ever reissued (restore-from-backup), `hermes_profile_name` collides. Decide: hard-delete with cascading Hermes-side cleanup, or never reuse UUIDs.
3. **OpenRouter API key ownership.** PRD recommends platform-managed for MVP. Schema supports per-workspace via `workspace_credentials`, but the API will start by reading a platform key from env. Document the switchover path before launch.
4. **`workspace_credentials` envelope encryption.** ✅ Closed — AWS KMS picked, `apps/api/src/services/credentials.ts` ships with `encryptCredential`/`decryptCredential`/`getProviderCredential` covered by tests, and `/workspaces/:id/credentials` (PUT/GET/DELETE, owner-only) provides the API surface. Provisioning instructions in `docs/AWS_PROVISIONING.md`. No active consumer yet — the first BYOK feature (OpenRouter / Stripe Connect / Pluggy) wires through `getProviderCredential`.
5. **Auth bridge longevity.** ✅ Closed — Supabase HS256 fallback removed from `apps/api/src/auth/plugin.ts`, `apps/api/src/auth/supabase-jwt.ts` deleted, `SUPABASE_JWT_SECRET` dropped from env. SPA is on Amplify; only Cognito tokens are accepted.
6. **54 legacy edge functions.** These are migration inputs, not dead code. None can be removed from `legacy/supabase/functions/` until the matching backend route/job/webhook exists and the SPA no longer calls the legacy function.
7. **Lovable cleanup status.** `@lovable.dev/cloud-auth-js` and `lovable-tagger` REMOVED. `apps/web/src/integrations/lovable/` directory deleted. Service-worker preview-host gate in `apps/web/src/main.tsx` removed. Cosmetic string references remain (admin docs, landing page, email template defaults that mention `lovable.app` / `lovable.dev`); these are user-facing copy to update when the production domain is finalized.
8. **PWA after the move.** `vite-plugin-pwa`'s virtual module + 9 validation scripts under `apps/web/scripts/` are sensitive to layout. Smoke-test `pnpm build` carefully.
9. **Feature parity tracking.** The previous plan treated Finance, WhatsApp, Email, Blog, Social, Search, and Misc as out of scope. They are now explicit feature migrations. Each wave needs a checklist mapping legacy tables/functions/hooks to new API routes and verification before Supabase can be retired.

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

