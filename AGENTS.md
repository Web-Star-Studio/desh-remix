# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm monorepo. Application code lives in `apps/`: `apps/web` is the React + Vite SPA and `apps/api` is the Fastify backend. Shared workspace packages live in `packages/`: `packages/shared` contains Zod schemas and shared Hermes contract types, while `packages/database` contains Drizzle schema, migrations, migration runner, and seed scripts. Public web assets are in `apps/web/public`; built output in `dist/` is generated and should not be edited. `legacy/supabase` is reference-only during the migration, and `docs/` plus `MIGRATION_PLAN.md` hold design and migration notes.

## Build, Test, and Development Commands

Use pnpm 9 from the repo root.

- `pnpm install` installs all workspace dependencies.
- `pnpm dev:web` runs the SPA at `http://localhost:8080`.
- `pnpm dev:api` runs the API at `http://localhost:3001` using `apps/api/.env`.
- `pnpm dev` starts workspace dev scripts in parallel.
- `pnpm build` builds all `@desh/*` workspaces; web builds also run PWA validation.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` run those checks recursively.
- `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:seed` operate on `@desh/database`.

## Coding Style & Naming Conventions

Use TypeScript ESM throughout. Prettier is configured for 2-space indentation, semicolons, double quotes, trailing commas, and 100-character lines. ESLint uses flat config; shared backend/package rules live in `eslint.shared.config.js`, while `apps/web` has React-specific hooks and refresh rules. Prefer `camelCase` for variables/functions, `PascalCase` for React components and exported types/classes, and kebab-case for route-like or script filenames when no local pattern exists.

## Testing Guidelines

Vitest is the test runner. Place tests near the code they cover using `*.test.ts` or `*.test.tsx`; `apps/api/test/health.test.ts` is the current API pattern. Use `pnpm test` for the full suite or `pnpm --filter @desh/web test:watch` while iterating on web tests. Add focused tests for schema changes, API behavior, shared contracts, and UI logic.

## Commit & Pull Request Guidelines

Recent history uses concise, imperative commit subjects, for example `Convert repo into a pnpm monorepo and scaffold backend, schema, and Cognito auth`. Keep commits scoped to one logical change. Pull requests should describe the change, list verification commands run, link related issues or migration tasks, and include screenshots or recordings for visible web UI changes.

## Security & Configuration Tips

Do not commit real secrets. Start from `.env.example`, `apps/api/.env.example`, or `apps/web/.env.example` and keep local `.env` files private. Treat generated database migrations as source: review SQL before committing and avoid editing historical migrations unless coordinating a reset.
