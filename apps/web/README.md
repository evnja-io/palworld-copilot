# web (Palworld Companion)

The Palworld Companion web app: SvelteKit 2 / Svelte 5 (runes), Drizzle ORM + Postgres (Neon), Discord OAuth (arctic), Paraglide i18n (FR/EN), Leaflet map. Deployed on Vercel (`@sveltejs/adapter-vercel`).

See the [root README](../../README.md) for the project overview and the full self-hosting guide.

## Setup

```sh
cp .env.example .env   # then fill in the values (see root README for details)
pnpm install           # from the repo root
pnpm --filter web db:migrate
pnpm --filter web dev
```

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server at `http://localhost:5173` |
| `pnpm build` / `pnpm preview` | Production build / local preview |
| `pnpm check` | `svelte-check` type checking (also catches missing i18n keys) |
| `pnpm test` | Vitest unit tests (integration tests require `TEST_DATABASE_URL`) |
| `pnpm db:generate` | Generate a Drizzle migration from `src/lib/server/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations (reads `.env`) |

## i18n

Messages live in [messages/fr.json](messages/fr.json) and [messages/en.json](messages/en.json) (base locale: `fr`). **Always edit both files together**: the key sets must stay identical. Paraglide compiles them into `src/lib/paraglide/` at build time.
