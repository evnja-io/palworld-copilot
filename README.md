# Palworld Companion

A shared companion app for groups playing **Palworld** together: a collective Paldex, a breeding calculator and a team builder, an interactive world map, the full technology tree, crafting recipes and buildings, with everyone's progression in one place — imported automatically from a dedicated server's save over SFTP, or uploaded by hand for local & co-op worlds.

**Hosted instance:** <https://palwork.evnja.gg> (free, sign in with Discord and create your server).
Prefer full control? [Self-host it](#self-hosting).

**Community:** join us on [Discord](https://discord.gg/SJehy5fFJ).

Bilingual UI (French / English). Not affiliated with Pocketpair, Inc. Palworld assets belong to their rightful owners.

## Features

- **Multi-tenant servers**: anyone can sign in with Discord and create up to 3 servers (one server = one Palworld world shared with your group). Each server is fully isolated with its own private URL.
- **Invites**: revocable invite links with optional expiry and max-use count. Members claim their in-game character with one click.
- **Shared progression**: Paldex (who caught what), interactive map (effigies, alpha bosses, fast travel), tech tree, items, crafting chains and buildings, showing each member's and the group's real progression.
- **Breeding calculator**: which child two parents produce, which parents reach a target Pal, and the shortest breeding path, plus a full combos index.
- **Team builder**: compose and share Pal teams — passives, active skills and loadouts (pre-filled from each species' innate passives and best learnset) — to theorycraft with your group.
- **Self-service automatic import**: the server owner adds their dedicated server's SFTP access in the settings (connection test included, world folder auto-discovered). The save is then imported every 6 hours; catches, unlocked tech and effigies tick themselves off. Credentials are encrypted at rest (AES-256-GCM), never displayed back, and deletable at any time.
- **Local & co-op worlds**: no dedicated server or SFTP? Upload your local (co-op) save folder straight from the browser to import it manually.
- **Game encyclopedia**: 288 Pals, 1148 items, 152 alpha bosses, 138 effigies, generated from the game files.

## Architecture

pnpm monorepo (Node ≥ 22, pnpm 11):

| Package | Role |
|---|---|
| `apps/web` | The whole product: SvelteKit 2 / Svelte 5, Drizzle ORM + Postgres (Neon), Discord OAuth (arctic), Paraglide i18n (FR/EN), Leaflet map. Deployed on Vercel. |
| `packages/pipeline` | Game-data extraction/transform (DataTables → JSON), icon/tile generation, and the save import (`import-save.ts` single server, `import-all.ts` multi-tenant fan-out). |
| `packages/game-data` | Generated JSON artifacts (pals, items, recipes, tech, buildings, maps, l10n) committed to the repo, so the web app builds without running the pipeline. |
| `docs/` | Decision log, deployment notes, game-data extraction runbook. |

The automated import runs from GitHub Actions ([.github/workflows/import-saves.yml](.github/workflows/import-saves.yml)) every 6 hours: it downloads each enabled tenant's save over SFTP, decodes it with [PalworldSaveTools](https://github.com/deafdudecomputers/PalworldSaveTools), and writes per-server progression to the database.

## Self-hosting

Palworld Companion is GPL-3.0, so you can run your own instance.

### Prerequisites

- Node ≥ 22 and pnpm 11
- A Postgres database ([Neon](https://neon.tech) works out of the box; any Postgres does)
- A [Discord application](https://discord.com/developers/applications) (OAuth2) for sign-in
- Python 3.12 (only needed for the save-import pipeline)

### 1. Configure environment

```sh
cp apps/web/.env.example apps/web/.env
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord OAuth2 application credentials |
| `SAVE_CREDS_KEY` | 32-byte base64 key encrypting per-server SFTP credentials. Generate with `openssl rand -base64 32` |

In your Discord application, add the OAuth2 redirect URIs:

- `http://localhost:5173/login/discord/callback` (dev)
- `https://<your-domain>/login/discord/callback` (prod)

### 2. Install, migrate, run

```sh
pnpm install
pnpm --filter web db:migrate
pnpm --filter web dev
```

The app runs at `http://localhost:5173`. For production, the repo is set up for Vercel (`@sveltejs/adapter-vercel`, project root directory `apps/web`) but any SvelteKit-compatible host works.

### 3. Automated save import (optional)

The GitHub Actions workflow [import-saves.yml](.github/workflows/import-saves.yml) imports every enabled tenant's save every 6 hours (manual trigger available via *workflow_dispatch*). On your fork, define two repository secrets:

- `DATABASE_URL`: same database as the web app
- `SAVE_CREDS_KEY`: **the same key as the web app**, otherwise stored SFTP credentials can't be decrypted

Server owners then configure their SFTP access in the app (*Settings → SFTP import*); no per-server secret is needed in CI.

### 4. Regenerating game data (optional)

The generated JSON and icons in `packages/game-data` are committed, so you only need this after a game update. The extraction procedure (FModel, `.usmap` mappings, AES key) is documented in [docs/extraction-runbook.md](docs/extraction-runbook.md); then:

```sh
pnpm --filter @palworld-companion/pipeline all
pnpm --filter @palworld-companion/pipeline verify
```

## License

[GPL-3.0](LICENSE). Not affiliated with Pocketpair, Inc. Palworld and all related assets belong to their rightful owners.
