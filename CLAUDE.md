# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Source of truth

`MIGRATION_PLAN.md` is the authoritative narrative of what's done, what's in flight, and what's deferred. Read it before non-trivial work — the per-feature matrix tells you which surfaces are migrated to `apps/api` and which are still calling Supabase. `docs/DATABASE_MAP.md` and `docs/SECURITY_RULES.md` cover legacy schema/RLS context that informs the migration target.

## Commands

Root scripts run across the workspace via `pnpm -r --filter "@desh/*"`:

```sh
pnpm install
pnpm dev                       # parallel: web (8080) + api (3001)
pnpm dev:web                   # SPA only
pnpm dev:api                   # API only (requires apps/api/.env — see apps/api/.env.example)
pnpm build                     # builds web (PWA validators run pre/post) and api
pnpm typecheck                 # tsc across all packages
pnpm lint                      # eslint across all packages
pnpm test                      # vitest across all packages
pnpm db:generate               # drizzle-kit generate (after schema edits)
pnpm db:migrate                # run pending migrations against DATABASE_URL
pnpm db:seed                   # seed dev data
```

API-specific scripts (`pnpm --filter @desh/api ...`):

- `dev:reset` — wipes app data (agent_events → conversations → composio_connections → workspaces → users) and clears `~/.hermes/profiles/*` while preserving the dir. Supports `--yes` and `--keep-hermes`.
- `mcp:repair [<workspace-id>]` — re-mints the per-entity Composio MCP URL, writes it to `agent_profiles.config`, and SIGTERMs the running gateway so the next message rebuilds `config.yaml`.

Run a single test file: `pnpm --filter @desh/api test -- composio.test.ts` (vitest accepts a path/pattern after `--`). Watch mode in web: `pnpm --filter @desh/web test:watch`.

API tests boot one Postgres testcontainer for the whole vitest process (`apps/api/test/_helpers/global-setup.ts`) and seed `process.env.DATABASE_URL` and `process.env.COMPOSIO_WEBHOOK_SECRET` **before** `apps/api/src/config/env.ts` is imported. Cognito JWT verification is replaced by a vitest mock (`apps/api/test/_helpers/setup.ts`); test tokens are minted via `signTestToken` and decoded by the mock. Don't import `apps/api` modules from globalSetup itself — env is parsed once at module load.

## Architecture

### Monorepo

```
apps/web   React + Vite SPA (incrementally rewired off Supabase)
apps/api   Fastify 5 backend on Node — owns auth/workspaces/conversations/Composio/Hermes
packages/database   Drizzle schema + migrations + seed (consumed via @desh/database/schema)
packages/shared     zod schemas + Hermes contract types
legacy/supabase     Reference-only; not run by the new stack but still called by un-migrated SPA features
```

`pnpm` workspaces only — no Turbo/Nx. There is **no** `packages/config`; per-package tsconfig extends `tsconfig.base.json`.

### Auth — Cognito only

`apps/api/src/auth/plugin.ts` accepts only Cognito RS256 tokens (verified via JWKS by `aws-jwt-verify`). The Supabase HS256 fallback was removed; `apps/api/src/auth/supabase-jwt.ts` no longer exists. SPA uses `@aws-amplify/auth` (`apps/web/src/contexts/AuthContext.tsx`, `AuthPage.tsx`, `apps/web/src/lib/api-client.ts`). Anything that touches a Supabase session in the SPA is dead and waiting for its feature wave to migrate.

### Hermes per-workspace gateway (lazy)

`apps/api/src/services/hermes/process-supervisor.ts` lazy-spawns `hermes -p <name> gateway` on the first `POST /conversations/:id/messages`. It renders `${HERMES_HOME_BASE}/ws_<uuid>/{config.yaml,.env,SOUL.md}` using stored secrets and an allocated port (`agent_profiles.hermes_port`), polls `GET :port/health`, then forwards the message. Hermes calls back into `POST /internal/hermes/events` (guarded by `INTERNAL_CALLBACK_TOKEN`); each event is persisted as an `agent_events` row and broadcast through `services/event-bus.ts` to SSE subscribers on `GET /conversations/:id/events`. Idle gateways stop after `HERMES_IDLE_TIMEOUT_MS`.

When the supervisor invokes Hermes with `-p <name>`, the CLI ignores `HERMES_HOME` and reads from `~/.hermes/profiles/<name>/`. Render config there, not into `HERMES_HOME_BASE`. `hermes_profile_name` is a stored generated column (`'ws_' || replace(workspace_id::text, '-', '')`) — never derive it client-side.

### Composio is two layers

1. **`/composio/execute` (semantic action runner).** SPA hooks `useGmailActions`, `useCalendarActions`, `useDriveActions` (in `apps/web/src/hooks/integrations/`) wrap `apps/web/src/lib/composio-client.ts:executeComposioAction`, which POSTs `{ workspaceId, toolkit, action, arguments }`. Add new action slugs to the wrapper's catalog rather than calling `/composio/execute` directly.
2. **Per-entity MCP server** for the agent. One global custom server (`desh-pandora`) is created per Composio project; per-workspace instances are minted via `entityIdFor(workspaceId, userDbId) = ${workspaceId}_${userDbId}`. The MCP URL pattern is `https://backend.composio.dev/v3/mcp/<serverId>?user_id=<entityId>` and requires `x-api-key` on the JSON-RPC POST. We persist the URL on `agent_profiles.config.composio_mcp_url` and emit `mcp_servers.composio` directly into `config.yaml` (mode 0o644) with `${COMPOSIO_API_KEY}` interpolated from the per-profile `.env` (mode 0o600). The Hermes `mcp add` CLI is interactive — bypass it; write YAML directly via `apps/api/src/services/hermes/profile-config.ts`.

`POST /composio/webhook` verifies HMAC-SHA256 of `${ts}.${rawBody}` against `COMPOSIO_WEBHOOK_SECRET`, rejects timestamps older than 5 min, and flips `composio_connections.status` on `connected_account.{expired,created,updated,deleted}`. `trigger.message` is a stub. The route returns 503 if the secret is unset (fail closed). Server.ts replaces the default `application/json` parser to capture `req.rawBody` for HMAC.

### Legacy `composio-proxy` is being retired

The legacy edge function takes `{service, path, method, params, body}` (HTTP passthrough). The migration replaces every call site with `{toolkit, action, arguments}` against `/composio/execute`. Email, calendar, drive, and the dashboard widgets are migrated. **Out of scope for now** (will migrate with their feature wave): `hooks/ai/{toolHandlers*,useAIToolExecution}`, `hooks/automation/useAutomationEngine`, `hooks/contacts/useContactsPageState`, `hooks/files/{useDriveUpload,useGoogleData,useMultiDriveData}`, `hooks/search/useGoogleSearch`, `hooks/social/*`, `hooks/tasks/useTasksPageState`, `components/notes/DeshLinkPicker`, and the admin tabs in `components/admin/`. These still call `composio-proxy` and will fail at runtime against the new stack — that's expected; don't migrate them ad hoc.

`apps/web/src/hooks/ai/useEdgeFn.ts` stays alive only to service non-Composio edge fns belonging to deferred waves (ai-router, serp-proxy, finance-sync, whatsapp-web, automation-execute, late-proxy, mapbox-proxy, pluggy-proxy). Don't add new callers.

### Inference — OpenRouter only

Locked at the schema level (`agent_profiles.provider = 'openrouter'` CHECK constraint) and the API level (`AgentSettingsPatchSchema` accepts only a model id, default `moonshotai/kimi-k2.6`).

### Env-vars worth knowing

`apps/api/.env.example` has the full list. Notable: `OPENROUTER_API_KEY` (required for Hermes to actually answer), `COMPOSIO_API_KEY` + `COMPOSIO_MCP_SERVER_ID` (cached after first boot), `COMPOSIO_WEBHOOK_SECRET` (≥16 chars, fail-closed), `HERMES_BIN`/`HERMES_HOME_BASE`, `INTERNAL_CALLBACK_TOKEN`. KMS is wired but the encrypt/decrypt path for `workspace_credentials` is still TODO — block prod deploy on it.

## Conventions

- The agent (Pandora, persona in `apps/api/src/services/pandora-prompt.ts`) MUST prefer Composio MCP tools for any external integration; non-MCP routes likely have no credentials. Pandora must never tell the user to type `/help` (CLI affordance, not DESH UI).
- Greenfield data strategy. The new Postgres starts empty. There are no backfill scripts from the legacy Supabase project.
- 54 legacy edge functions in `legacy/supabase/functions/` are migration **inputs**, not dead code. Do not delete a legacy function until the matching backend route + SPA rewire ship.
- `composio_connections.composioEntityId` matches what Composio sends in webhooks as `data.user_id`; that's the lookup key for status updates.
- When migrating a Gmail/Calendar/Drive call site, smoke-test the response shape — Composio actions return *close to* native Google shapes but not always identical. If a shape adapter is needed, put it inside the wrapper hook so call sites stay thin.
- **Improve as you migrate.** A migration is not a 1:1 port. While moving a feature, hook, or call site off the legacy stack, actively look for code smells, dead branches, defensive code that no longer applies, copy-pasted blocks, leaky abstractions, swallowed errors, redundant state, and inconsistent naming — and fix them in the same change. The legacy code carries Supabase-shaped assumptions (RLS, edge-fn envelopes, manual workspace-id injection) that often become noise on the new stack; delete them rather than carrying them forward. Keep refactors scoped to what you're already touching — don't open unrelated files for cleanup — but don't pretend not to see a problem in the lines you're already editing.
