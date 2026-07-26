# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A multi-tenant companion web app for groups playing Palworld: shared Paldex, breeding calculator, team builder, interactive map, tech tree, items, crafting and buildings. Each Discord-authenticated user owns up to 3 "servers" (one server = one shared Palworld world), each fully isolated behind its own slug URL. Progression is imported from a dedicated server's save over SFTP (every 6h via GitHub Actions) or uploaded by hand for local/co-op worlds. Hosted at <https://palwork.evnja.gg>.

**UI and code comments are French** (the product UI is bilingual FR/EN via Paraglide). Match the surrounding French comment style when editing.

## Commands

pnpm monorepo, Node ≥ 22, pnpm 11. Most commands target a workspace with `--filter`.

```sh
pnpm --filter web dev            # dev server → http://localhost:5173
pnpm --filter web build
pnpm --filter web check          # svelte-check (typecheck)
pnpm --filter web test           # vitest (unit only unless TEST_DATABASE_URL set — see below)
pnpm --filter web db:generate    # drizzle-kit generate (after schema.ts changes)
pnpm --filter web db:migrate     # apply migrations (reads .env)

pnpm --filter @palworld-companion/pipeline all      # regenerate all game-data JSON (after a game update)
pnpm --filter @palworld-companion/pipeline verify   # validate generated game-data
pnpm --filter @palworld-companion/pipeline markers:normalize   # reclasse markers.json + ids uniques (sans réextraction)
```

Run a single test file: `pnpm --filter web test src/lib/game/breeding.test.ts`

### Integration tests are gated

Files named `*.integration.test.ts` (in `apps/web/src/lib/server/`) hit a real Postgres and are skipped unless `TEST_DATABASE_URL` is set. Both `TEST_DATABASE_URL` **and** `DATABASE_URL` must point at the **same** migrated Neon branch, because `getDb()` reads `$env/dynamic/private`, which SvelteKit's Vite plugin freezes from `process.env`/`.env` at init (mutating `process.env` in `beforeAll` is too late):

```sh
TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web test
```

## Architecture

Three workspaces:

- **`apps/web`** — the entire product. SvelteKit 2 / Svelte 5 (runes forced on, see `vite.config.ts`), Drizzle ORM over Neon serverless Postgres, Discord OAuth via `arctic`, Paraglide i18n, Leaflet map. Deployed on Vercel (`@sveltejs/adapter-vercel`, project root = `apps/web`).
- **`packages/pipeline`** — offline data tooling: game-data extraction/transform (`src/all.ts`), icon/tile generation, and the save importers. Uses `tsx` for generation scripts, and `node --experimental-strip-types` for the DB-touching importers. Depends on Python 3.12 + PalworldSaveTools (`palsav`/`palooz`) to decode `PlM`/Oodle server saves — see `docs/extraction-runbook.md`.
- **`packages/game-data`** — generated JSON artifacts (`pals.json`, `items.json`, `breeding.json`, `tech.json`, `markers.json`, `l10n/`, …) **committed to the repo**. The web app imports these directly, so it builds without ever running the pipeline. Regenerate only after a game update.

### Multi-tenancy and request flow

- **Auth**: `hooks.server.ts` chains Paraglide + a session handle that validates the `session` cookie via `validateSessionToken` and sets `event.locals.user`.
- **Scoping**: everything under `routes/s/[slug]/` is a tenant. `routes/s/[slug]/+layout.server.ts` calls `requireMembership(user, slug)` (in `lib/server/servers.ts`) — this is the tenant authorization boundary. All server-side data access must be scoped through the membership/server, never global. `lib/server/servers.ts` is the core of tenancy (servers, invites, memberships).
- **DB access**: always `getDb()` from `$lib/server/db` (returns a Drizzle instance over Neon HTTP); tables come from `tables` (re-export of `schema.ts`). Tables: `users`, `sessions`, `servers`, `invites`, `server_import_configs`.
- **Secrets at rest**: per-server SFTP credentials are AES-256-GCM encrypted with `SAVE_CREDS_KEY` (`lib/server/crypto.ts` in web, `src/creds.ts` in pipeline — they must use the **same** key).

### Save-import pipeline

Two importers, both idempotent and run from GitHub Actions:

- **SFTP** (`.github/workflows/import-saves.yml`, every 6h): `pipeline/src/import-all.ts` fans out over all `enabled` rows in `server_import_configs`, downloads each tenant's save over SFTP, decodes it, and writes per-server progression. Fault-isolated — one broken tenant → `status=error` without blocking others; non-zero exit only if **all** tenants fail.
- **Browser upload** (`.github/workflows/import-upload.yml`): `pipeline/src/import-upload.ts` handles local/co-op saves uploaded via `@vercel/blob`. Also runs in "sweep" mode (no `UPLOAD_ID`) as a safety net for uploads whose `repository_dispatch` was lost.

Import correlation details (what lives in `RecordData` vs `SaveData`, effigy/boss GUID sourcing, stable IDs) are documented in `docs/decisions.md` — read it before touching extraction/transform logic.

## Conventions worth knowing

- Client-only game logic (breeding, passives, team data, progress) lives in `apps/web/src/lib/game/`; `.svelte.ts` files there use Svelte 5 runes for reactive stores. Server-only logic is in `apps/web/src/lib/server/` (never import it into client code).
- After editing `schema.ts`, run `db:generate` then `db:migrate`. Migrations live in `apps/web/drizzle/`.
- Decisions and their rationale are logged chronologically in `docs/decisions.md`; deploy runbooks are the other `docs/*.md` files.
- Les catégories de la carte sont portées par `type` dans `markers.json`
  (`relic`, `alpha`, `boss`, `tower`, `watchtower`, `ft`) et classées dans
  `packages/pipeline/src/transform/markers.lib.ts` — jamais côté web. Les ids
  doivent rester uniques : `MarkerController` indexe par id et toute liste
  Svelte keyée dessus casse sur un doublon.
