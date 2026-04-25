# Desh

Personal life dashboard with a workspace-scoped agent runtime (Hermes Agent).

## Layout

```
apps/
  web/        React + Vite SPA (the existing dashboard, moved untouched)
  api/        Fastify backend (Postgres, owns auth/workspaces/conversations/Hermes lifecycle)
packages/
  shared/     zod schemas + Hermes adapter contract types
  database/   Drizzle schema + migrations + seed
legacy/
  supabase/   Original Supabase project (migrations + edge functions). Reference only — not run by the new stack.
```

## Getting started

```sh
pnpm install
pnpm dev:web    # SPA on http://localhost:8080
pnpm dev:api    # API  on http://localhost:3001
```

See `MIGRATION_PLAN.md` for the multi-stage migration from Supabase to the new backend.
