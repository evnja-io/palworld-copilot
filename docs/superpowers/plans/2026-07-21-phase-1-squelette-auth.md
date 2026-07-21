# Phase 1 — Squelette + Auth : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Certaines étapes sont marquées **USER ACTION** (création de l'app Discord,
> intégration Neon dans le dashboard Vercel). L'exécution inline est adaptée.

**Goal:** Une app SvelteKit déployée sur Vercel où les membres du groupe se connectent via Discord (allowlist), avec la base Postgres migrée (table `progress` générique) et l'i18n FR/EN en place — le socle de toutes les phases suivantes.

**Architecture:** `apps/web` = SvelteKit (Svelte 5, adapter-vercel). Auth = Arctic (OAuth Discord) + sessions en BDD (pattern Lucia, cookie httpOnly). BDD = Neon Postgres via Drizzle (driver neon-http). i18n = Paraglide (stratégie cookie, baseLocale fr). Routes protégées sous le groupe `(app)` ; `/login` seule route publique.

**Tech Stack:** SvelteKit + Svelte 5, @sveltejs/adapter-vercel, arctic v3, drizzle-orm + drizzle-kit + @neondatabase/serverless, @inlang/paraglide-js, vitest, tsx.

## Global Constraints

- Spec : `docs/superpowers/specs/2026-07-21-palworld-companion-design.md` ; décisions : `docs/decisions.md`
- Node ≥22, pnpm 11, workspace existant (`apps/*` déjà déclaré dans `pnpm-workspace.yaml`)
- Schéma BDD copié du spec : tables `users` (avec `palPlayerGuid`), `sessions`, `allowlist`, `progress (userId, kind, entityId)` — `kind ∈ {pal_caught, tech_unlocked, marker}` non contraint en BDD (validé applicativement)
- OAuth Discord scope `identify` uniquement ; cookie de session httpOnly, secure, sameSite lax, 30 jours glissants
- i18n : `baseLocale: "fr"`, locales `["fr", "en"]` ; AUCUNE chaîne d'UI en dur dans les composants — tout passe par les messages Paraglide
- Migrations Drizzle committées dans `apps/web/drizzle/`
- Secrets jamais committés (`.env` gitignoré ; `.env.example` committé)
- Travailler sur la branche `feature/phase-1-squelette-auth`

---

### Task 1: Scaffold SvelteKit dans le workspace

**Files:**
- Create: `apps/web/` (scaffold `sv create`)
- Modify: `apps/web/package.json` (nom `web`, deps adapter-vercel)
- Modify: `apps/web/svelte.config.js` (adapter-vercel)
- Create: `apps/web/.env.example`

**Interfaces:**
- Consumes: workspace pnpm existant
- Produces: app `web` lançable (`pnpm --filter web dev`) et buildable, cible de toutes les tâches suivantes

- [ ] **Step 1: Créer la branche**

```bash
git checkout -b feature/phase-1-squelette-auth
```

- [ ] **Step 2: Scaffolder l'app**

```bash
cd apps && pnpm dlx sv create web --template minimal --types ts --no-add-ons --no-install && cd ..
```

(Si les flags du CLI `sv` diffèrent dans la version installée : viser un projet
SvelteKit TypeScript minimal sans add-ons, nommé `web`.)

- [ ] **Step 3: Adapter au workspace et à Vercel**

Dans `apps/web/package.json` : `"name": "web"`. Puis :

```bash
pnpm --filter web add -D @sveltejs/adapter-vercel vitest
pnpm install
```

`apps/web/svelte.config.js` :
```js
import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() },
};

export default config;
```

`apps/web/.env.example` :
```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```

- [ ] **Step 4: Vérifier build et dev**

Run: `pnpm --filter web build`
Expected: build Vercel OK (`.svelte-kit/output` généré, adapter-vercel mentionné).

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold SvelteKit + adapter Vercel"
```

---

### Task 2: i18n Paraglide FR/EN + layout de base

**Files:**
- Create: `apps/web/project.inlang/settings.json`
- Create: `apps/web/messages/fr.json`, `apps/web/messages/en.json`
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/src/hooks.server.ts` (handle paraglide ; l'auth s'y ajoutera en Task 5)
- Modify: `apps/web/src/app.html` (attribut lang)
- Create: `apps/web/src/lib/components/LangSwitch.svelte`
- Modify: `apps/web/src/routes/+layout.svelte`

**Interfaces:**
- Consumes: app Task 1
- Produces: `import { m } from "$lib/paraglide/messages"` utilisable partout ;
  `paraglideHandle` exporté depuis `src/hooks.server.ts` ; messages `nav_*`,
  `auth_*`, `common_*` définis ici et consommés par les Tasks 5–7

- [ ] **Step 1: Installer et configurer Paraglide**

```bash
pnpm --filter web add -D @inlang/paraglide-js
```

`apps/web/project.inlang/settings.json` :
```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "baseLocale": "fr",
  "locales": ["fr", "en"],
  "modules": ["https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js"],
  "plugin.inlang.messageFormat": { "pathPattern": "./messages/{locale}.json" }
}
```

`apps/web/messages/fr.json` :
```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "app_title": "Palworld Companion",
  "nav_paldex": "Paldex",
  "nav_items": "Objets",
  "nav_craft": "Craft",
  "nav_tech": "Technologies",
  "nav_buildings": "Constructions",
  "nav_map": "Carte",
  "common_soon": "Bientôt disponible",
  "auth_login_discord": "Se connecter avec Discord",
  "auth_logout": "Se déconnecter",
  "auth_denied_title": "Accès privé",
  "auth_denied_body": "Cet outil est réservé au groupe. Demande à Sephi de t'ajouter à la liste."
}
```

`apps/web/messages/en.json` :
```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "app_title": "Palworld Companion",
  "nav_paldex": "Paldex",
  "nav_items": "Items",
  "nav_craft": "Crafting",
  "nav_tech": "Technology",
  "nav_buildings": "Buildings",
  "nav_map": "Map",
  "common_soon": "Coming soon",
  "auth_login_discord": "Sign in with Discord",
  "auth_logout": "Sign out",
  "auth_denied_title": "Private access",
  "auth_denied_body": "This tool is group-only. Ask Sephi to add you to the allowlist."
}
```

Dans `apps/web/vite.config.ts`, ajouter le plugin :
```ts
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    sveltekit(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      strategy: ["cookie", "preferredLanguage", "baseLocale"],
    }),
  ],
});
```

- [ ] **Step 2: Handle serveur + lang dans le HTML**

`apps/web/src/hooks.server.ts` :
```ts
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";
import { paraglideMiddleware } from "$lib/paraglide/server";

export const paraglideHandle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    event.request = request;
    return resolve(event, {
      transformPageChunk: ({ html }) => html.replace("%paraglide.lang%", locale),
    });
  });

export const handle = sequence(paraglideHandle);
```

Dans `apps/web/src/app.html`, remplacer `<html lang="en">` par
`<html lang="%paraglide.lang%">`.

- [ ] **Step 3: Sélecteur de langue et layout**

`apps/web/src/lib/components/LangSwitch.svelte` :
```svelte
<script lang="ts">
  import { getLocale, setLocale } from "$lib/paraglide/runtime";
</script>

<button
  onclick={() => setLocale(getLocale() === "fr" ? "en" : "fr")}
  aria-label="Switch language"
>
  {getLocale() === "fr" ? "EN" : "FR"}
</button>
```

`apps/web/src/routes/+layout.svelte` :
```svelte
<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  import LangSwitch from "$lib/components/LangSwitch.svelte";
  let { children } = $props();
</script>

<header>
  <strong>{m.app_title()}</strong>
  <LangSwitch />
</header>
<main>{@render children()}</main>
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter web build && pnpm --filter web dev &` puis ouvrir
`http://localhost:5173`.
Expected: titre affiché, bouton EN/FR bascule la langue (cookie posé).
Arrêter le serveur dev ensuite.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): i18n Paraglide FR/EN + layout et sélecteur de langue"
```

---

### Task 3: Vercel + Neon + app Discord (USER ACTION) 

**Files:**
- Create: `apps/web/.env` (local, NON committé — depuis `vercel env pull`)

**Interfaces:**
- Consumes: rien
- Produces: `DATABASE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
  disponibles en local (`apps/web/.env`) et sur Vercel — requis par les Tasks 4+

- [ ] **Step 1: USER ACTION — projet Vercel**

```bash
npm i -g vercel
vercel login
vercel link   # à la racine du repo ; créer le projet "palworld-companion"
```

Puis dans le dashboard Vercel → Settings du projet → **Root Directory =
`apps/web`** (monorepo).

- [ ] **Step 2: USER ACTION — Neon via le Marketplace Vercel**

Dashboard Vercel → onglet Storage (ou Marketplace) → **Neon Postgres** →
Create/Connect → lier au projet. Vérifier que la variable `DATABASE_URL`
apparaît dans Settings → Environment Variables (tous environnements).

- [ ] **Step 3: USER ACTION — app Discord**

https://discord.com/developers/applications → **New Application**
(« Palworld Companion ») → OAuth2 :
- Copier **Client ID** et **Client Secret** ;
- Redirects : ajouter `http://localhost:5173/login/discord/callback`
  (les URLs de preview/prod Vercel seront ajoutées en Task 8).

Ajouter les deux variables sur Vercel (tous environnements) :
```bash
vercel env add DISCORD_CLIENT_ID
vercel env add DISCORD_CLIENT_SECRET
```

- [ ] **Step 4: Rapatrier l'environnement local**

```bash
vercel env pull apps/web/.env
grep -c "DATABASE_URL\|DISCORD_CLIENT_ID\|DISCORD_CLIENT_SECRET" apps/web/.env
```

Expected: `3` (les trois variables présentes). Rien à committer.

---

### Task 4: Drizzle — schéma, migration, client

**Files:**
- Create: `apps/web/src/lib/server/db/schema.ts`
- Create: `apps/web/src/lib/server/db/index.ts`
- Create: `apps/web/drizzle.config.ts`
- Create: `apps/web/drizzle/` (SQL généré)
- Modify: `apps/web/package.json` (scripts db:generate / db:migrate)

**Interfaces:**
- Consumes: `DATABASE_URL` (Task 3)
- Produces: `getDb(): NeonHttpDatabase` (import `$lib/server/db`) et les tables
  `users`, `sessions`, `allowlist`, `progress` — consommés par Tasks 5, 6, 7

- [ ] **Step 1: Installer**

```bash
pnpm --filter web add drizzle-orm @neondatabase/serverless
pnpm --filter web add -D drizzle-kit
```

- [ ] **Step 2: Écrire le schéma (copie du spec)**

`apps/web/src/lib/server/db/schema.ts` :
```ts
import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  palPlayerGuid: text("pal_player_guid").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const allowlist = pgTable("allowlist", {
  discordId: text("discord_id").primaryKey(),
  addedBy: uuid("added_by").references(() => users.id),
  note: text("note"),
});

export const progress = pgTable(
  "progress",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.entityId] }), index("progress_kind_entity_idx").on(t.kind, t.entityId)],
);
```

`apps/web/src/lib/server/db/index.ts` :
```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "$env/dynamic/private";
import * as schema from "./schema";

export function getDb() {
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  return drizzle(neon(env.DATABASE_URL), { schema });
}

export * as tables from "./schema";
```

`apps/web/drizzle.config.ts` :
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Scripts dans `apps/web/package.json` :
```json
    "db:generate": "drizzle-kit generate",
    "db:migrate": "node --env-file=.env node_modules/drizzle-kit/bin.cjs migrate"
```

- [ ] **Step 3: Générer et appliquer la migration**

```bash
pnpm --filter web db:generate
pnpm --filter web db:migrate
```

Expected: un fichier SQL dans `apps/web/drizzle/` créant les 4 tables ;
migration appliquée sans erreur sur Neon.

- [ ] **Step 4: Vérifier sur la base**

```bash
node --env-file=apps/web/.env -e "
const { neon } = require('@neondatabase/serverless');
neon(process.env.DATABASE_URL)\`select table_name from information_schema.tables where table_schema='public' order by 1\`.then(r => console.log(r.map(x => x.table_name)));
"
```

Expected: liste contenant `allowlist`, `progress`, `sessions`, `users`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/server/db apps/web/drizzle.config.ts apps/web/drizzle apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): schéma Drizzle (users, sessions, allowlist, progress) + migration"
```

---

### Task 5: Sessions — helpers purs (TDD) puis couche BDD

**Files:**
- Create: `apps/web/src/lib/server/auth/session-utils.ts`
- Test: `apps/web/src/lib/server/auth/session-utils.test.ts`
- Create: `apps/web/src/lib/server/auth/session.ts`

**Interfaces:**
- Consumes: `getDb`, `tables` (Task 4)
- Produces: `generateSessionToken(): string`, `hashSessionToken(t): string`,
  `sessionExpiresAt(now): Date`, `shouldExtendSession(expiresAt, now): boolean`
  (SESSION_DAYS = 30, extension à mi-vie) ; côté BDD :
  `createSession(token, userId)`, `validateSessionToken(token): Promise<{ user, session } | null>`,
  `invalidateSession(sessionId)` — consommés par Tasks 6 et 7

- [ ] **Step 1: Écrire les tests des helpers purs**

`apps/web/src/lib/server/auth/session-utils.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  sessionExpiresAt,
  shouldExtendSession,
  SESSION_DAYS,
} from "./session-utils";

describe("session-utils", () => {
  it("génère des tokens uniques, opaques et assez longs", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hash stable et distinct du token (le token ne va jamais en BDD)", () => {
    const t = generateSessionToken();
    expect(hashSessionToken(t)).toBe(hashSessionToken(t));
    expect(hashSessionToken(t)).not.toBe(t);
    expect(hashSessionToken(t)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("expire dans SESSION_DAYS jours", () => {
    const now = new Date("2026-07-21T12:00:00Z");
    const exp = sessionExpiresAt(now);
    expect(exp.getTime() - now.getTime()).toBe(SESSION_DAYS * 86_400_000);
  });

  it("étend seulement après la mi-vie", () => {
    const now = new Date("2026-07-21T12:00:00Z");
    const freshExpiry = sessionExpiresAt(now);
    expect(shouldExtendSession(freshExpiry, now)).toBe(false);
    const past = new Date(now.getTime() - (SESSION_DAYS / 2 + 1) * 86_400_000);
    expect(shouldExtendSession(sessionExpiresAt(past), now)).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `pnpm --filter web exec vitest run src/lib/server/auth`
Expected: FAIL (module `session-utils` inexistant).

- [ ] **Step 3: Implémenter les helpers**

`apps/web/src/lib/server/auth/session-utils.ts` :
```ts
import { createHash, randomBytes } from "node:crypto";

export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

export function generateSessionToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_DAYS * DAY_MS);
}

export function shouldExtendSession(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() - now.getTime() < (SESSION_DAYS / 2) * DAY_MS;
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `pnpm --filter web exec vitest run src/lib/server/auth`
Expected: 4 passed.

- [ ] **Step 5: Couche BDD des sessions**

`apps/web/src/lib/server/auth/session.ts` :
```ts
import { eq } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";
import {
  hashSessionToken,
  sessionExpiresAt,
  shouldExtendSession,
} from "./session-utils";

export async function createSession(token: string, userId: string) {
  const db = getDb();
  const session = { id: hashSessionToken(token), userId, expiresAt: sessionExpiresAt() };
  await db.insert(tables.sessions).values(session);
  return session;
}

export async function validateSessionToken(token: string) {
  const db = getDb();
  const id = hashSessionToken(token);
  const rows = await db
    .select({ session: tables.sessions, user: tables.users })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.sessions.userId, tables.users.id))
    .where(eq(tables.sessions.id, id));
  const hit = rows[0];
  if (!hit) return null;
  if (hit.session.expiresAt.getTime() <= Date.now()) {
    await db.delete(tables.sessions).where(eq(tables.sessions.id, id));
    return null;
  }
  if (shouldExtendSession(hit.session.expiresAt)) {
    hit.session.expiresAt = sessionExpiresAt();
    await db
      .update(tables.sessions)
      .set({ expiresAt: hit.session.expiresAt })
      .where(eq(tables.sessions.id, id));
  }
  return hit;
}

export async function invalidateSession(sessionId: string) {
  await getDb().delete(tables.sessions).where(eq(tables.sessions.id, sessionId));
}
```

- [ ] **Step 6: Build + tests puis commit**

Run: `pnpm --filter web exec vitest run && pnpm --filter web build`
Expected: tests PASS, build OK.

```bash
git add apps/web/src/lib/server/auth
git commit -m "feat(web): sessions BDD pattern Lucia (helpers testés + couche Drizzle)"
```

---

### Task 6: OAuth Discord + allowlist + hooks

**Files:**
- Create: `apps/web/src/lib/server/auth/discord.ts`
- Create: `apps/web/src/routes/login/+page.svelte`
- Create: `apps/web/src/routes/login/denied/+page.svelte`
- Create: `apps/web/src/routes/login/discord/+server.ts`
- Create: `apps/web/src/routes/login/discord/callback/+server.ts`
- Create: `apps/web/src/routes/logout/+server.ts`
- Modify: `apps/web/src/hooks.server.ts` (ajout authHandle)
- Modify: `apps/web/src/app.d.ts` (Locals)

**Interfaces:**
- Consumes: sessions (Task 5), `allowlist`/`users` (Task 4), messages `auth_*` (Task 2)
- Produces: `event.locals.user: { id, discordId, username, avatarUrl } | null`
  sur toutes les requêtes — consommé par Task 7 ; cookie `session`

- [ ] **Step 1: Installer Arctic et déclarer Locals**

```bash
pnpm --filter web add arctic
```

`apps/web/src/app.d.ts` :
```ts
import type { users } from "$lib/server/db/schema";

declare global {
  namespace App {
    interface Locals {
      user: typeof users.$inferSelect | null;
    }
  }
}

export {};
```

- [ ] **Step 2: Client Discord**

`apps/web/src/lib/server/auth/discord.ts` :
```ts
import { Discord } from "arctic";
import { env } from "$env/dynamic/private";

export function discordClient(origin: string) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    throw new Error("Variables DISCORD_CLIENT_ID/SECRET manquantes");
  }
  return new Discord(
    env.DISCORD_CLIENT_ID,
    env.DISCORD_CLIENT_SECRET,
    `${origin}/login/discord/callback`,
  );
}
```

- [ ] **Step 3: Routes de login**

`apps/web/src/routes/login/discord/+server.ts` :
```ts
import { redirect } from "@sveltejs/kit";
import { generateState } from "arctic";
import { discordClient } from "$lib/server/auth/discord";

export function GET(event) {
  const state = generateState();
  const url = discordClient(event.url.origin).createAuthorizationURL(state, null, ["identify"]);
  event.cookies.set("discord_oauth_state", state, {
    path: "/",
    httpOnly: true,
    secure: event.url.protocol === "https:",
    maxAge: 600,
    sameSite: "lax",
  });
  redirect(302, url.toString());
}
```

`apps/web/src/routes/login/discord/callback/+server.ts` :
```ts
import { error, redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { discordClient } from "$lib/server/auth/discord";
import { createSession } from "$lib/server/auth/session";
import { generateSessionToken, sessionExpiresAt } from "$lib/server/auth/session-utils";
import { getDb, tables } from "$lib/server/db";

export async function GET(event) {
  const code = event.url.searchParams.get("code");
  const state = event.url.searchParams.get("state");
  const stored = event.cookies.get("discord_oauth_state");
  if (!code || !state || !stored || state !== stored) error(400, "État OAuth invalide");
  event.cookies.delete("discord_oauth_state", { path: "/" });

  const tokens = await discordClient(event.url.origin).validateAuthorizationCode(code, null);
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokens.accessToken()}` },
  });
  if (!res.ok) error(502, "Discord /users/@me a échoué");
  const du: { id: string; username: string; global_name: string | null; avatar: string | null } =
    await res.json();

  const db = getDb();
  const allowed = await db
    .select()
    .from(tables.allowlist)
    .where(eq(tables.allowlist.discordId, du.id));
  if (allowed.length === 0) redirect(302, "/login/denied");

  const username = du.global_name ?? du.username;
  const avatarUrl = du.avatar
    ? `https://cdn.discordapp.com/avatars/${du.id}/${du.avatar}.png`
    : null;
  const [user] = await db
    .insert(tables.users)
    .values({ discordId: du.id, username, avatarUrl })
    .onConflictDoUpdate({ target: tables.users.discordId, set: { username, avatarUrl } })
    .returning();

  const token = generateSessionToken();
  await createSession(token, user.id);
  event.cookies.set("session", token, {
    path: "/",
    httpOnly: true,
    secure: event.url.protocol === "https:",
    sameSite: "lax",
    expires: sessionExpiresAt(),
  });
  redirect(302, "/");
}
```

`apps/web/src/routes/logout/+server.ts` :
```ts
import { redirect } from "@sveltejs/kit";
import { hashSessionToken } from "$lib/server/auth/session-utils";
import { invalidateSession } from "$lib/server/auth/session";

export async function POST(event) {
  const token = event.cookies.get("session");
  if (token) {
    await invalidateSession(hashSessionToken(token));
    event.cookies.delete("session", { path: "/" });
  }
  redirect(302, "/login");
}
```

- [ ] **Step 4: Pages login / denied**

`apps/web/src/routes/login/+page.svelte` :
```svelte
<script lang="ts">
  import { m } from "$lib/paraglide/messages";
</script>

<h1>{m.app_title()}</h1>
<a href="/login/discord">{m.auth_login_discord()}</a>
```

`apps/web/src/routes/login/denied/+page.svelte` :
```svelte
<script lang="ts">
  import { m } from "$lib/paraglide/messages";
</script>

<h1>{m.auth_denied_title()}</h1>
<p>{m.auth_denied_body()}</p>
```

- [ ] **Step 5: authHandle dans les hooks**

Remplacer la fin de `apps/web/src/hooks.server.ts` :
```ts
import { validateSessionToken } from "$lib/server/auth/session";

const authHandle: Handle = async ({ event, resolve }) => {
  event.locals.user = null;
  const token = event.cookies.get("session");
  if (token) {
    const hit = await validateSessionToken(token);
    if (hit) {
      event.locals.user = hit.user;
      event.cookies.set("session", token, {
        path: "/",
        httpOnly: true,
        secure: event.url.protocol === "https:",
        sameSite: "lax",
        expires: hit.session.expiresAt,
      });
    } else {
      event.cookies.delete("session", { path: "/" });
    }
  }
  return resolve(event);
};

export const handle = sequence(paraglideHandle, authHandle);
```

- [ ] **Step 6: Vérifier build + tests, commit**

Run: `pnpm --filter web exec vitest run && pnpm --filter web build`
Expected: PASS + build OK.

```bash
git add apps/web/src
git commit -m "feat(web): OAuth Discord (Arctic) + gate allowlist + sessions en cookie"
```

---

### Task 7: Guard (app), accueil avec nav, header utilisateur

**Files:**
- Create: `apps/web/src/routes/(app)/+layout.server.ts`
- Create: `apps/web/src/routes/(app)/+layout.svelte`
- Move: `apps/web/src/routes/+page.svelte` → `apps/web/src/routes/(app)/+page.svelte` (réécrite)
- Modify: `apps/web/src/routes/+layout.svelte` (header allégé — le header riche vit dans `(app)`)

**Interfaces:**
- Consumes: `locals.user` (Task 6), messages `nav_*` (Task 2)
- Produces: gabarit protégé `(app)` avec `data.user` — toutes les pages des
  phases 3+ s'y rangeront ; routes réservées /paldex /items /craft /tech
  /buildings /map (liens `common_soon` pour l'instant)

- [ ] **Step 1: Guard + layout applicatif**

`apps/web/src/routes/(app)/+layout.server.ts` :
```ts
import { redirect } from "@sveltejs/kit";

export function load({ locals }) {
  if (!locals.user) redirect(302, "/login");
  return { user: locals.user };
}
```

`apps/web/src/routes/(app)/+layout.svelte` :
```svelte
<script lang="ts">
  import { m } from "$lib/paraglide/messages";
  let { data, children } = $props();
  const nav = [
    { href: "/paldex", label: m.nav_paldex },
    { href: "/items", label: m.nav_items },
    { href: "/craft", label: m.nav_craft },
    { href: "/tech", label: m.nav_tech },
    { href: "/buildings", label: m.nav_buildings },
    { href: "/map", label: m.nav_map },
  ];
</script>

<nav>
  {#each nav as item (item.href)}
    <a href={item.href}>{item.label()}</a>
  {/each}
</nav>
<div class="user">
  {#if data.user.avatarUrl}<img src={data.user.avatarUrl} alt="" width="24" height="24" />{/if}
  <span>{data.user.username}</span>
  <form method="POST" action="/logout"><button>{m.auth_logout()}</button></form>
</div>
{@render children()}
```

`apps/web/src/routes/(app)/+page.svelte` :
```svelte
<script lang="ts">
  import { m } from "$lib/paraglide/messages";
</script>

<p>{m.common_soon()}</p>
```

Supprimer l'ancienne `apps/web/src/routes/+page.svelte` si le scaffold en a
créé une hors du groupe `(app)`.

- [ ] **Step 2: Vérifier le flux complet en local**

Run: `pnpm --filter web dev` puis dans un navigateur :
1. `http://localhost:5173/` → redirigé vers `/login` ;
2. « Se connecter avec Discord » → OAuth → **refus attendu** (`/login/denied`,
   allowlist vide — c'est le comportement voulu, la Task 8 seed l'allowlist).

Expected: redirection guard OK, refus allowlist OK.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): groupe (app) protégé, nav des sections, header utilisateur"
```

---

### Task 8: Seed allowlist + déploiement + vérification de sortie de phase

**Files:**
- Create: `apps/web/scripts/allowlist-add.ts`
- Modify: `apps/web/package.json` (script `allowlist:add`)

**Interfaces:**
- Consumes: tables (Task 4), `.env` (Task 3)
- Produces: commande `pnpm --filter web allowlist:add <discordId> <note>` ;
  app déployée sur Vercel — critère de sortie de la Phase 1

- [ ] **Step 1: Script d'allowlist**

`apps/web/scripts/allowlist-add.ts` :
```ts
import { neon } from "@neondatabase/serverless";

const [discordId, ...noteParts] = process.argv.slice(2);
if (!discordId || !/^\d{15,21}$/.test(discordId)) {
  console.error("Usage: allowlist:add <discordId numérique> [note]");
  process.exit(1);
}
const note = noteParts.join(" ") || null;
const sql = neon(process.env.DATABASE_URL!);
await sql`insert into allowlist (discord_id, note) values (${discordId}, ${note})
          on conflict (discord_id) do update set note = excluded.note`;
console.log(`OK : ${discordId}${note ? ` (${note})` : ""} est dans l'allowlist`);
```

Script dans `apps/web/package.json` :
```json
    "allowlist:add": "node --env-file=.env --experimental-strip-types scripts/allowlist-add.ts"
```

- [ ] **Step 2: USER ACTION — seed avec ton Discord ID**

(Discord → Paramètres → Avancés → Mode développeur, puis clic droit sur ton
profil → Copier l'identifiant.)

```bash
pnpm --filter web allowlist:add <TON_DISCORD_ID> Sephi
```

Expected: `OK : <id> (Sephi) est dans l'allowlist`.

- [ ] **Step 3: Login local complet**

Run: `pnpm --filter web dev` → `/login` → Discord → retour connecté,
header avec pseudo + avatar, logout fonctionne.

- [ ] **Step 4: Déployer en preview**

```bash
vercel deploy
```

Puis USER ACTION : ajouter l'URL de callback de la preview dans l'app Discord
(OAuth2 → Redirects) : `https://<preview>.vercel.app/login/discord/callback`.

- [ ] **Step 5: Vérification de sortie de phase**

Sur l'URL de preview :
1. Accès anonyme à `/` → redirigé `/login` ✔
2. Login Discord (compte allowlisté) → connecté, header OK ✔
3. Login d'un compte NON allowlisté (un ami pas encore ajouté, ou un compte
   secondaire) → `/login/denied` ✔
4. Toggle FR/EN persiste après rechargement ✔

- [ ] **Step 6: Commit final**

```bash
git add apps/web
git commit -m "feat(web): script allowlist + déploiement preview Vercel"
```
