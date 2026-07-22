# Multi-tenant Phase 0–1 — Plan d'implémentation (socle de données)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le modèle de données et les routes multi-tenant (scopés par serveur) sans changement visible pour le groupe actuel — spec : `docs/superpowers/specs/2026-07-22-multi-tenant-design.md`, phases 0–1.

**Architecture:** Nouvelles tables `servers`/`server_members`, colonne `server_id` sur `progress`/`save_snapshots`/`save_players` (migration additive → backfill idempotent → migration de contraintes), routes `(app)` déplacées sous `/s/[slug]` avec garde d'adhésion, pipeline d'import scopé par un env `SERVER_ID` provisoire. L'allowlist et le fetch SFTP mono-serveur restent en place (phases 2–3).

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), Drizzle ORM + driver neon-http (pas de transactions), drizzle-kit (driver `pg`, transactionnel), Neon Postgres, vitest, pipeline Node `--experimental-strip-types` + venv Python palsav.

**Découpage des plans :** ce plan couvre le socle (spec phases 0–1). Les phases 2 (ouverture/invitations), 3 (ingestion SFTP self-service) et 4 (durcissement) auront chacune leur plan, écrits après livraison de celui-ci. Le spike ssh2-sur-Vercel (spec phase 0) est déplacé dans le plan de la phase 3 : il n'informe que l'UX des settings SFTP et le schéma supporte les deux issues.

## Global Constraints

- Monorepo pnpm ; commandes web : `pnpm --filter web <script>` depuis la racine.
- Driver runtime neon-http : **pas de transactions** → toute écriture multi-étapes doit être idempotente/rejouable. Pièges connus : un tableau JS dans `sql\`\`` drizzle explose en `($1,$2,…)` → passer une chaîne + `string_to_array` ; dans un UNION, caster `::uuid` explicitement. (Le client `neon()` brut, lui, accepte les tableaux `${arr}::text[]` — c'est ce qu'utilise le pipeline.)
- Migrations : `pnpm --filter web db:generate` (hors-ligne) puis `db:migrate` (driver pg). **Ne jamais appliquer sur la prod pendant ce plan** — application sur une branche Neon (Tâche 8) puis rollout manuel documenté.
- Repo public GPL : aucun secret, aucun identifiant de monde dans le code.
- Commentaires et messages de commit en français, style existant (`feat(web): …`).
- Copie i18n intouchée dans ce plan (phase 2).
- Après chaque tâche : `pnpm --filter web test` et, sauf mention contraire, `pnpm --filter web check` doivent passer.
- Fichiers `.svelte`/`.svelte.ts` : utiliser le skill svelte:svelte-code-writer / l'agent svelte-file-editor pour les éditions.

---

### Task 1: Schéma additif (`servers`, `server_members`, colonnes `server_id` nullables) + migration A

**Files:**
- Modify: `apps/web/src/lib/server/db/schema.ts`
- Create: `apps/web/drizzle/0003_*.sql` (généré)

**Interfaces:**
- Produces: tables Drizzle `tables.servers` (id, name, slug, ownerId, createdAt) et `tables.serverMembers` (serverId, userId, role `'owner'|'member'`, palPlayerGuid nullable, joinedAt) ; colonnes `serverId` (uuid, **nullable à ce stade**) sur `tables.progress`, `tables.saveSnapshots`, `tables.savePlayers`. Les PK existantes ne changent pas encore (migration B, Tâche 6).

- [ ] **Step 1: Étendre le schéma**

Dans `apps/web/src/lib/server/db/schema.ts`, remplacer la ligne d'imports par :

```ts
import { index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
```

Ajouter après `allowlist` :

```ts
export const servers = pgTable("servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const serverMembers = pgTable(
  "server_members",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull(),
    // GUID de joueur PAR monde : un même utilisateur a un GUID différent
    // sur chaque serveur (remplace users.palPlayerGuid, supprimé en migration B).
    palPlayerGuid: text("pal_player_guid"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.serverId, t.userId] }),
    uniqueIndex("server_members_guid_unique")
      .on(t.serverId, t.palPlayerGuid)
      .where(sql`${t.palPlayerGuid} is not null`),
  ],
);
```

Puis ajouter à chacune des trois tables existantes la colonne (nullable pour l'instant — la migration B posera NOT NULL + PK composites après backfill) :

```ts
    serverId: uuid("server_id").references(() => servers.id, { onDelete: "cascade" }),
```

- dans `progress` (avant `userId`),
- dans `savePlayers` (avant `playerGuid`),
- dans `saveSnapshots` (avant `playerGuid`).

- [ ] **Step 2: Générer la migration**

Run: `pnpm --filter web db:generate`
Expected: un nouveau fichier `apps/web/drizzle/0003_*.sql` contenant uniquement `CREATE TABLE "servers"`, `CREATE TABLE "server_members"`, trois `ALTER TABLE … ADD COLUMN "server_id" uuid`, les FK et l'index unique partiel. **Aucun** `DROP` — sinon corriger le schéma avant de continuer.

- [ ] **Step 3: Vérifier types et tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS (colonnes nullables ⇒ aucun code existant cassé).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/server/db/schema.ts apps/web/drizzle
git commit -m "feat(web): tables servers/server_members + colonnes server_id (migration A additive)"
```

---

### Task 2: Script de backfill du serveur `legacy`

**Files:**
- Create: `apps/web/scripts/backfill-legacy-server.ts`
- Modify: `apps/web/package.json` (script `backfill:legacy`)

**Interfaces:**
- Consumes: tables de la Tâche 1.
- Produces: un serveur `slug='legacy'` ; chaque ligne de `users` devient membre (`owner` pour le Discord ID passé en argument), `users.pal_player_guid` copié vers `server_members.pal_player_guid` ; `server_id` rempli partout où il est NULL. **Idempotent et rejouable** (sera relancé juste avant la migration B au rollout).

- [ ] **Step 1: Écrire le script**

`apps/web/scripts/backfill-legacy-server.ts` (même pattern d'exécution que `allowlist-add.ts`) :

```ts
// Backfill multi-tenant : crée le serveur "legacy" et y rattache l'existant.
// Usage : pnpm --filter web backfill:legacy <discordId de l'owner> [nom du serveur]
// Idempotent : rejouable autant de fois que nécessaire (rattrape les lignes
// créées entre deux exécutions — pas de transactions avec neon-http).
import { neon } from "@neondatabase/serverless";

const [ownerDiscordId, ...nameParts] = process.argv.slice(2);
if (!ownerDiscordId || !/^\d{15,21}$/.test(ownerDiscordId)) {
  console.error("Usage: backfill:legacy <discordId numérique de l'owner> [nom]");
  process.exit(1);
}
const name = nameParts.join(" ") || "Notre serveur";
const sql = neon(process.env.DATABASE_URL!);

const owners = await sql`select id from users where discord_id = ${ownerDiscordId}`;
if (owners.length === 0) {
  console.error("Owner introuvable dans users — il doit s'être connecté au moins une fois.");
  process.exit(1);
}
const ownerId: string = owners[0].id;

await sql`insert into servers (name, slug, owner_id)
          values (${name}, 'legacy', ${ownerId}) on conflict (slug) do nothing`;
const [srv] = await sql`select id from servers where slug = 'legacy'`;

const members = await sql`
  insert into server_members (server_id, user_id, role, pal_player_guid)
  select ${srv.id}::uuid, u.id,
         case when u.id = ${ownerId}::uuid then 'owner' else 'member' end,
         u.pal_player_guid
  from users u
  on conflict (server_id, user_id) do nothing
  returning user_id`;

const p = await sql`update progress set server_id = ${srv.id}::uuid
                    where server_id is null returning 1 as one`;
const s = await sql`update save_snapshots set server_id = ${srv.id}::uuid
                    where server_id is null returning 1 as one`;
const n = await sql`update save_players set server_id = ${srv.id}::uuid
                    where server_id is null returning 1 as one`;

console.log(`serveur legacy ${srv.id} : +${members.length} membres, ` +
  `${p.length} progress / ${s.length} snapshots / ${n.length} pseudos rattachés`);
```

- [ ] **Step 2: Déclarer le script pnpm**

Dans `apps/web/package.json`, ajouter sous `"allowlist:add"` :

```json
		"backfill:legacy": "node --env-file=.env --experimental-strip-types scripts/backfill-legacy-server.ts",
```

- [ ] **Step 3: Vérifier types**

Run: `pnpm --filter web check`
Expected: PASS. **Ne pas exécuter le script** (il tournera sur la branche Neon en Tâche 8, puis en prod au rollout).

- [ ] **Step 4: Commit**

```bash
git add apps/web/scripts/backfill-legacy-server.ts apps/web/package.json
git commit -m "feat(web): script de backfill du serveur legacy (idempotent)"
```

---

### Task 3: Scoping des modules serveur (`servers.ts`, `progress.ts`, `import.ts`) + tests

**Files:**
- Create: `apps/web/src/lib/server/servers.ts`
- Modify: `apps/web/src/lib/server/progress.ts`
- Modify: `apps/web/src/lib/server/import.ts`
- Test: `apps/web/src/lib/server/scoping.integration.test.ts` (nouveau, gated par `TEST_DATABASE_URL` — écrit ici, exécuté en Tâche 8)

**Interfaces:**
- Consumes: `tables.servers`, `tables.serverMembers` (Tâche 1).
- Produces (utilisé par les routes en Tâche 4) :
  - `listMyServers(userId: string): Promise<ServerSummary[]>` avec `ServerSummary = { id: string; slug: string; name: string }`
  - `requireMembership(user: { id: string } | null, slug: string): Promise<{ server: ServerSummary; membership: Membership }>` avec `Membership = { role: "owner" | "member"; palPlayerGuid: string | null }` — jette `error(401)` sans user, `error(404)` si non-membre (ne pas révéler l'existence).
  - `setProgress(serverId: string, userId: string, kind: string, entityId: string, checked: boolean)`
  - `getProgress(serverId: string, kind: string, myUserId: string)`
  - `listSnapshots(serverId: string): Promise<SnapshotSummary[]>`
  - `claimGuid(serverId: string, userId: string, guid: string): Promise<void>`

**Note :** à la fin de cette tâche, `pnpm --filter web test` passe mais `pnpm --filter web check` est **rouge** (les routes appellent encore les anciennes signatures) — c'est attendu, la Tâche 4 le remet au vert. Commit unique 3+4 interdit : commits séparés, mais la gate `check` de cette tâche est explicitement reportée.

- [ ] **Step 1: Créer `apps/web/src/lib/server/servers.ts`**

```ts
import { and, eq } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { getDb, tables } from "$lib/server/db";

export type ServerSummary = { id: string; slug: string; name: string };
export type Membership = { role: "owner" | "member"; palPlayerGuid: string | null };

export async function listMyServers(userId: string): Promise<ServerSummary[]> {
  const db = getDb();
  return db
    .select({ id: tables.servers.id, slug: tables.servers.slug, name: tables.servers.name })
    .from(tables.serverMembers)
    .innerJoin(tables.servers, eq(tables.serverMembers.serverId, tables.servers.id))
    .where(eq(tables.serverMembers.userId, userId))
    .orderBy(tables.servers.createdAt);
}

/** Garde d'autorisation : à appeler dans CHAQUE load/action/endpoint sous
 *  /s/[slug] et /api/servers/[slug] — les layouts ne protègent pas les actions.
 *  404 (et pas 403) pour ne pas révéler l'existence d'un serveur. */
export async function requireMembership(
  user: { id: string } | null,
  slug: string,
): Promise<{ server: ServerSummary; membership: Membership }> {
  if (!user) error(401);
  const db = getDb();
  const rows = await db
    .select({
      id: tables.servers.id,
      slug: tables.servers.slug,
      name: tables.servers.name,
      role: tables.serverMembers.role,
      palPlayerGuid: tables.serverMembers.palPlayerGuid,
    })
    .from(tables.servers)
    .innerJoin(
      tables.serverMembers,
      and(
        eq(tables.serverMembers.serverId, tables.servers.id),
        eq(tables.serverMembers.userId, user.id),
      ),
    )
    .where(eq(tables.servers.slug, slug));
  const hit = rows[0];
  if (!hit) error(404);
  return {
    server: { id: hit.id, slug: hit.slug, name: hit.name },
    membership: { role: hit.role, palPlayerGuid: hit.palPlayerGuid },
  };
}
```

- [ ] **Step 2: Scoper `progress.ts`**

Dans `apps/web/src/lib/server/progress.ts`, remplacer `setProgress` et `getProgress` (le registre `REGISTRY`/`isValidEntity`/`isValidKind` ne change pas) :

```ts
export async function setProgress(
  serverId: string,
  userId: string,
  kind: string,
  entityId: string,
  checked: boolean,
) {
  const db = getDb();
  if (checked) {
    await db
      .insert(tables.progress)
      .values({ serverId, userId, kind, entityId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(tables.progress)
      .where(
        and(
          eq(tables.progress.serverId, serverId),
          eq(tables.progress.userId, userId),
          eq(tables.progress.kind, kind),
          eq(tables.progress.entityId, entityId),
        ),
      );
  }
}

export async function getProgress(serverId: string, kind: string, myUserId: string) {
  const db = getDb();
  const rows = await db
    .select({
      entityId: tables.progress.entityId,
      userId: tables.users.id,
      username: tables.users.username,
      avatarUrl: tables.users.avatarUrl,
    })
    .from(tables.progress)
    .innerJoin(tables.users, eq(tables.progress.userId, tables.users.id))
    .where(and(eq(tables.progress.serverId, serverId), eq(tables.progress.kind, kind)));
  const mine: string[] = [];
  const group: Record<string, GroupUser[]> = {};
  for (const r of rows) {
    (group[r.entityId] ??= []).push({ id: r.userId, username: r.username, avatarUrl: r.avatarUrl });
    if (r.userId === myUserId) mine.push(r.entityId);
  }
  return { mine, group };
}
```

Note : l'insert `values({ serverId, … })` compile car `serverId` est nullable à ce stade ; il devient requis par le type après la migration B (Tâche 6) — aucun changement de code à prévoir alors.

- [ ] **Step 3: Scoper `import.ts`**

Dans `apps/web/src/lib/server/import.ts` :

`listSnapshots` — scoper par serveur et résoudre `claimedBy` via `server_members` (plus via `users.palPlayerGuid`) :

```ts
export async function listSnapshots(serverId: string): Promise<SnapshotSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      playerGuid: tables.saveSnapshots.playerGuid,
      kind: tables.saveSnapshots.kind,
      count: sql<number>`count(*)::int`,
      lastImport: sql<string>`max(${tables.saveSnapshots.importedAt})`,
      claimedBy: tables.users.username,
      nickname: tables.savePlayers.nickname,
    })
    .from(tables.saveSnapshots)
    .leftJoin(
      tables.serverMembers,
      and(
        eq(tables.serverMembers.serverId, tables.saveSnapshots.serverId),
        eq(tables.serverMembers.palPlayerGuid, tables.saveSnapshots.playerGuid),
      ),
    )
    .leftJoin(tables.users, eq(tables.users.id, tables.serverMembers.userId))
    .leftJoin(
      tables.savePlayers,
      and(
        eq(tables.savePlayers.serverId, tables.saveSnapshots.serverId),
        eq(tables.savePlayers.playerGuid, tables.saveSnapshots.playerGuid),
      ),
    )
    .where(eq(tables.saveSnapshots.serverId, serverId))
    .groupBy(
      tables.saveSnapshots.playerGuid,
      tables.saveSnapshots.kind,
      tables.users.username,
      tables.savePlayers.nickname,
    );
  // (agrégation byGuid inchangée)
```

`claimGuid` — la revendication vit dans `server_members` :

```ts
/** Revendique guid pour (serverId, userId) puis fusionne additivement ses
 *  kinds officiels vers progress. Rejouable : re-revendiquer son propre GUID
 *  est permis (pas de transactions avec neon-http). */
export async function claimGuid(serverId: string, userId: string, guid: string): Promise<void> {
  const db = getDb();
  const known = await db
    .select({ playerGuid: tables.saveSnapshots.playerGuid })
    .from(tables.saveSnapshots)
    .where(
      and(eq(tables.saveSnapshots.serverId, serverId), eq(tables.saveSnapshots.playerGuid, guid)),
    )
    .limit(1);
  if (known.length === 0) throw new ClaimError("guid_unknown");
  try {
    // La ligne d'adhésion existe forcément : requireMembership est passé avant.
    const updated = await db
      .update(tables.serverMembers)
      .set({ palPlayerGuid: guid })
      .where(
        and(
          eq(tables.serverMembers.serverId, serverId),
          eq(tables.serverMembers.userId, userId),
          or(
            isNull(tables.serverMembers.palPlayerGuid),
            eq(tables.serverMembers.palPlayerGuid, guid),
          ),
        ),
      )
      .returning();
    if (updated.length === 0) throw new ClaimError("already_claimed_user");
  } catch (err) {
    if (err instanceof ClaimError) throw err;
    if (isUniqueViolation(err)) throw new ClaimError("guid_taken");
    throw err;
  }
  // string_to_array : cf. contrainte globale drizzle+neon-http.
  await db.execute(sql`
    insert into progress (server_id, user_id, kind, entity_id)
    select ${serverId}::uuid, ${userId}::uuid, kind, entity_id from save_snapshots
    where server_id = ${serverId}::uuid and player_guid = ${guid}
      and kind in ('pal_caught', 'tech_unlocked')
    union
    select ${serverId}::uuid, ${userId}::uuid, 'marker', 'relic_' || entity_id from save_snapshots
    where server_id = ${serverId}::uuid and player_guid = ${guid} and kind = 'raw:relic'
      and ('relic_' || entity_id) = any(string_to_array(${RELIC_IDS.join(",")}, ','))
    on conflict do nothing`);
}
```

- [ ] **Step 4: Écrire le test d'intégration de scoping (exécution différée en Tâche 8)**

`apps/web/src/lib/server/scoping.integration.test.ts` :

```ts
// Test d'intégration multi-tenant : nécessite une base migrée (A + backfill + B).
// Gated : ne tourne que si TEST_DATABASE_URL est posée (branche Neon, Tâche 8).
//   TEST_DATABASE_URL=<url branche> pnpm --filter web test
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("scoping multi-tenant", () => {
  // getDb() lit $env/dynamic/private → process.env au runtime sous vitest.
  beforeAll(() => {
    process.env.DATABASE_URL = url;
  });

  const tag = randomUUID().slice(0, 8);
  const GUID = "AAAA0000000000000000000000000000";
  let db: Awaited<ReturnType<typeof mkDb>>;
  let srvA: string, srvB: string, u1: string, u2: string;

  async function mkDb() {
    const { getDb } = await import("$lib/server/db");
    return getDb();
  }

  beforeAll(async () => {
    db = await mkDb();
    const { tables } = await import("$lib/server/db");
    const [ua] = await db
      .insert(tables.users)
      .values({ discordId: `test-${tag}-1`, username: `t1-${tag}` })
      .returning();
    const [ub] = await db
      .insert(tables.users)
      .values({ discordId: `test-${tag}-2`, username: `t2-${tag}` })
      .returning();
    u1 = ua.id;
    u2 = ub.id;
    const [sa] = await db
      .insert(tables.servers)
      .values({ name: `A-${tag}`, slug: `test-a-${tag}`, ownerId: u1 })
      .returning();
    const [sb] = await db
      .insert(tables.servers)
      .values({ name: `B-${tag}`, slug: `test-b-${tag}`, ownerId: u2 })
      .returning();
    srvA = sa.id;
    srvB = sb.id;
    await db.insert(tables.serverMembers).values([
      { serverId: srvA, userId: u1, role: "owner" },
      { serverId: srvB, userId: u2, role: "owner" },
    ]);
    await db.insert(tables.saveSnapshots).values([
      { serverId: srvA, playerGuid: GUID, kind: "pal_caught", entityId: "Anubis" },
      { serverId: srvA, playerGuid: GUID, kind: "tech_unlocked", entityId: "Workbench" },
    ]);
  });

  afterAll(async () => {
    const { tables } = await import("$lib/server/db");
    const { inArray } = await import("drizzle-orm");
    // Cascade : supprimer les serveurs emporte membres/progress/snapshots.
    await db.delete(tables.servers).where(inArray(tables.servers.id, [srvA, srvB]));
    await db.delete(tables.users).where(inArray(tables.users.id, [u1, u2]));
  });

  it("les coches ne fuient pas entre serveurs", async () => {
    const { setProgress, getProgress } = await import("$lib/server/progress");
    await setProgress(srvA, u1, "pal_caught", "Anubis", true);
    const a = await getProgress(srvA, "pal_caught", u1);
    const b = await getProgress(srvB, "pal_caught", u2);
    expect(a.mine).toContain("Anubis");
    expect(b.mine).toHaveLength(0);
    expect(Object.keys(b.group)).toHaveLength(0);
  });

  it("les snapshots sont scopés par serveur", async () => {
    const { listSnapshots } = await import("$lib/server/import");
    expect((await listSnapshots(srvA)).map((s) => s.guid)).toContain(GUID);
    expect(await listSnapshots(srvB)).toHaveLength(0);
  });

  it("claimGuid écrit dans server_members et fusionne sur le bon serveur", async () => {
    const { claimGuid } = await import("$lib/server/import");
    const { getProgress } = await import("$lib/server/progress");
    await claimGuid(srvA, u1, GUID);
    expect((await getProgress(srvA, "tech_unlocked", u1)).mine).toContain("Workbench");
    expect((await getProgress(srvB, "tech_unlocked", u2)).mine).toHaveLength(0);
  });

  it("claimGuid refuse un GUID inconnu du serveur (même s'il existe ailleurs)", async () => {
    const { claimGuid, ClaimError } = await import("$lib/server/import");
    await expect(claimGuid(srvB, u2, GUID)).rejects.toSatisfy(
      (e: unknown) => e instanceof ClaimError && e.code === "guid_unknown",
    );
  });

  it("requireMembership : 404 pour un non-membre", async () => {
    const { requireMembership } = await import("$lib/server/servers");
    const { tables } = await import("$lib/server/db");
    const { eq } = await import("drizzle-orm");
    const [srv] = await db.select().from(tables.servers).where(eq(tables.servers.id, srvB));
    await expect(requireMembership({ id: u1 }, srv.slug)).rejects.toMatchObject({ status: 404 });
    await expect(requireMembership({ id: u2 }, srv.slug)).resolves.toMatchObject({
      membership: { role: "owner" },
    });
  });
});
```

- [ ] **Step 5: Vérifier que la suite unitaire passe (check reste rouge, attendu)**

Run: `pnpm --filter web test`
Expected: PASS — les tests d'intégration s'affichent `skipped` (pas de `TEST_DATABASE_URL`), `progress.test.ts` inchangé passe.

Run: `pnpm --filter web check`
Expected: FAIL sur les appels `getProgress`/`setProgress`/`listSnapshots`/`claimGuid` dans `src/routes/` — uniquement ces erreurs-là. La Tâche 4 les corrige.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/server/servers.ts apps/web/src/lib/server/progress.ts apps/web/src/lib/server/import.ts apps/web/src/lib/server/scoping.integration.test.ts
git commit -m "feat(web): modules serveur scopés par serverId + garde requireMembership"
```

---

### Task 4: Routes sous `/s/[slug]` + garde d'adhésion + balayage des liens

**Files:**
- Move: `apps/web/src/routes/(app)/*` → `apps/web/src/routes/s/[slug]/*` (git mv, tout le groupe)
- Create: `apps/web/src/routes/s/[slug]/+layout.server.ts` (remplace l'ancien layout server du groupe)
- Create: `apps/web/src/routes/+page.server.ts`, `apps/web/src/routes/+page.svelte` (redirection racine)
- Create: `apps/web/src/lib/nav.ts`
- Move: `apps/web/src/routes/api/progress/+server.ts` → `apps/web/src/routes/api/servers/[slug]/progress/+server.ts`
- Modify: `apps/web/src/routes/login/discord/callback/+server.ts` (shim d'adhésion legacy)
- Modify: `apps/web/src/lib/game/progress.svelte.ts`, `apps/web/src/lib/components/CommandPalette.svelte`, `apps/web/src/lib/components/PalCard.svelte`, `apps/web/src/lib/components/RecipeCard.svelte`, `apps/web/src/lib/map/MarkerPopup.svelte`, layout + pages déplacées (balayage des hrefs et des loads)

**Interfaces:**
- Consumes: `requireMembership`, `listMyServers` (Tâche 3).
- Produces: layout data `{ user, server: ServerSummary, membership: Membership }` disponible via `await parent()` dans toutes les pages sous `/s/[slug]` ; API de progression à `POST|GET /api/servers/[slug]/progress` (mêmes corps/réponses qu'avant) ; helper `appHref(path: string): string` qui préfixe `/s/<slug courant>`.

- [ ] **Step 1: Déplacer le groupe de routes**

```bash
mkdir -p apps/web/src/routes/s
git mv "apps/web/src/routes/(app)" "apps/web/src/routes/s/[slug]"
mkdir -p "apps/web/src/routes/api/servers/[slug]"
git mv apps/web/src/routes/api/progress "apps/web/src/routes/api/servers/[slug]/progress"
```

- [ ] **Step 2: Garde d'adhésion dans le layout**

Remplacer le contenu de `apps/web/src/routes/s/[slug]/+layout.server.ts` :

```ts
import { redirect } from "@sveltejs/kit";
import { requireMembership } from "$lib/server/servers";
import type { LayoutServerLoadEvent } from "./$types";

export async function load({ locals, params }: LayoutServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  const { server, membership } = await requireMembership(locals.user, params.slug);
  return { user: locals.user, server, membership };
}
```

- [ ] **Step 3: Redirection racine**

`apps/web/src/routes/+page.server.ts` :

```ts
import { redirect } from "@sveltejs/kit";
import { listMyServers } from "$lib/server/servers";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals }: PageServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  const mine = await listMyServers(locals.user.id);
  // Phase 1 : tout utilisateur autorisé est membre du serveur legacy (backfill
  // + shim du callback). La page /servers (choix multiple) arrive en phase 2.
  if (mine.length === 0) redirect(302, "/login/denied");
  redirect(302, `/s/${mine[0].slug}`);
}
```

`apps/web/src/routes/+page.svelte` (jamais rendu, requis pour matérialiser la route) :

```svelte
<!-- Redirigé côté serveur — jamais rendu. -->
```

- [ ] **Step 4: Shim d'adhésion legacy dans le callback OAuth**

Dans `apps/web/src/routes/login/discord/callback/+server.ts`, juste après l'upsert de `users` (`.returning()`), ajouter :

```ts
  // Shim phase 1 : les allowlistés qui se connectent pour la première fois
  // rejoignent automatiquement le serveur legacy. Retiré en phase 2
  // (remplacé par les invitations).
  await db.execute(
    sql`insert into server_members (server_id, user_id, role)
        select id, ${user.id}::uuid, 'member' from servers where slug = 'legacy'
        on conflict (server_id, user_id) do nothing`,
  );
```

avec l'import complété : `import { eq, sql } from "drizzle-orm";`

- [ ] **Step 5: Helper `appHref`**

`apps/web/src/lib/nav.ts` :

```ts
import { page } from "$app/state";

/** Préfixe un chemin interne avec le serveur courant : appHref('/paldex')
 *  → '/s/<slug>/paldex'. À n'utiliser que sous les routes /s/[slug]. */
export function appHref(path: string): string {
  return `/s/${page.params.slug}${path}`;
}
```

- [ ] **Step 6: API de progression scopée**

Remplacer le contenu de `apps/web/src/routes/api/servers/[slug]/progress/+server.ts` :

```ts
import { error, json } from "@sveltejs/kit";
import { getProgress, isValidEntity, isValidKind, setProgress } from "$lib/server/progress";
import { requireMembership } from "$lib/server/servers";
import type { RequestEvent } from "./$types";

export async function POST(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const body = await event.request.json().catch(() => null);
  const { kind, entityId, checked } = body ?? {};
  if (typeof kind !== "string" || typeof entityId !== "string" || typeof checked !== "boolean")
    error(400, "kind, entityId, checked requis");
  if (!isValidEntity(kind, entityId)) error(400, "entité inconnue");
  await setProgress(server.id, event.locals.user!.id, kind, entityId, checked);
  return new Response(null, { status: 204 });
}

export async function GET(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const kind = event.url.searchParams.get("kind") ?? "";
  if (!isValidKind(kind)) error(400, "kind inconnu");
  return json(await getProgress(server.id, kind, event.locals.user!.id));
}
```

- [ ] **Step 7: `ProgressStore` paramétré par slug**

Dans `apps/web/src/lib/game/progress.svelte.ts` : ajouter un champ `#api = ""`, étendre `init` et remplacer les deux URLs de fetch :

```ts
  init(kind: string, slug: string, mine: string[], group: Record<string, GroupUser[]>) {
    this.kind = kind;
    this.#api = `/api/servers/${slug}/progress`;
    this.mine = new Set(mine);
    this.group = group;
  }
```

- `fetch("/api/progress", …)` → `fetch(this.#api, …)`
- `` fetch(`/api/progress?kind=${this.kind}`) `` → `` fetch(`${this.#api}?kind=${this.kind}`) ``

Puis mettre à jour tous les appels `.init(` (les trouver : `grep -rn "\.init(" apps/web/src/routes/s`) en insérant le slug, p. ex. dans `paldex/+page.svelte` :

```ts
store.init("pal_caught", page.params.slug!, data.progress.mine, data.progress.group);
```

- [ ] **Step 8: Loads de pages scopés via `parent()`**

Trouver les appels : `grep -rn "getProgress\|listSnapshots\|claimGuid" apps/web/src/routes`. Pattern (exemple `s/[slug]/paldex/+page.server.ts`, à décliner pour `map`, `tech`, et tout autre load qui matche) :

```ts
import { getProgress } from "$lib/server/progress";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals, parent }: PageServerLoadEvent) {
  const { server } = await parent();
  return { progress: await getProgress(server.id, "pal_caught", locals.user!.id) };
}
```

`s/[slug]/import/+page.server.ts` (le `mine` vient de l'adhésion, plus de `users.palPlayerGuid` ; l'action re-vérifie l'adhésion elle-même) :

```ts
import { fail } from "@sveltejs/kit";
import { ClaimError, claimGuid, listSnapshots } from "$lib/server/import";
import { requireMembership } from "$lib/server/servers";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ parent }: PageServerLoadEvent) {
  const { server, membership } = await parent();
  return { snapshots: await listSnapshots(server.id), mine: membership.palPlayerGuid };
}

export const actions: Actions = {
  claim: async ({ request, locals, params }) => {
    const { server } = await requireMembership(locals.user, params.slug);
    const data = await request.formData();
    const guid = data.get("guid");
    if (typeof guid !== "string" || guid.length === 0) {
      return fail(400, { error: "guid_missing" });
    }
    try {
      await claimGuid(server.id, locals.user!.id, guid);
    } catch (err) {
      if (err instanceof ClaimError) return fail(409, { error: err.code });
      throw err;
    }
    return { success: true };
  },
};
```

- [ ] **Step 9: Balayage des liens internes**

Trouver les sites : `grep -rn "href=\"/\|href={\`/\|goto(" apps/web/src/routes/s apps/web/src/lib --include='*.svelte'`. Règle : tout lien vers une page du groupe (`/paldex…`, `/items…`, `/craft`, `/tech…`, `/buildings…`, `/map…`, `/import`) passe par `appHref(…)` ; les liens `/login`, `/logout`, `/` (brand) et les URLs externes ne changent pas. Sites connus :

- `s/[slug]/+layout.svelte` : `import { appHref } from '$lib/nav';` ; le tableau `nav` garde des chemins relatifs (`{ href: '/paldex', … }`) et le template devient :

```svelte
<a href={appHref(item.href)} class:active={page.url.pathname.startsWith(appHref(item.href))}>
```

  idem `<a href={appHref('/import')} …>` ; le brand `href="/"` ne change pas ; le test plein écran devient `page.route.id === '/s/[slug]/map'`.
- `CommandPalette.svelte` ligne ~155 : `goto(href)` → `goto(appHref(href))` (avec l'import ; `resolve.ts` continue de produire des chemins app-relatifs).
- `PalCard.svelte`, `RecipeCard.svelte`, `MarkerPopup.svelte` et les pages déplacées : envelopper chaque href interne, p. ex. `` href={appHref(`/paldex/${pal.id}`)} ``.

- [ ] **Step 10: Vérifier types + tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS, plus aucune référence aux anciennes signatures. Puis contrôle résiduel :

Run: `grep -rn "api/progress" apps/web/src --include='*.svelte' --include='*.ts'`
Expected: aucune occurrence hors `api/servers/[slug]/progress`.

- [ ] **Step 11: Vérification manuelle en dev**

Run: `pnpm --filter web dev` puis parcourir `http://localhost:5173/` → doit rediriger vers `/login` (déconnecté). La vérification connectée complète (paldex/tech/map/import sous `/s/legacy`) se fait en Tâche 8 sur la branche Neon migrée — la base de dev n'a pas encore les tables.

- [ ] **Step 12: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): routes /s/[slug] avec garde d'adhésion, API progression par serveur"
```

---

### Task 5: Pipeline scopé par `SERVER_ID` (interim phase 1)

**Files:**
- Modify: `packages/pipeline/src/import-save.ts`
- Modify: `packages/pipeline/src/extract-players.ts`
- Modify: `.github/workflows/import-saves.yml`

**Interfaces:**
- Consumes: env `SERVER_ID` (uuid du serveur legacy — secret GH `LEGACY_SERVER_ID`, posé au rollout ; retiré en phase 3 quand `import-all.ts` lira les configs en base).
- Produces: snapshots/pseudos/fusion écrits avec `server_id` ; fusion via `server_members` (plus via `users.pal_player_guid`).

**Attention ordre de rollout :** ce code suppose la PK `(server_id, player_guid)` de la migration B — il ne doit tourner en prod qu'après elle (le runbook de la Tâche 8 désactive le cron pendant la fenêtre).

- [ ] **Step 1: `import-save.ts`**

Après le bloc « 1. Arguments et environnement », ajouter :

```ts
const serverId = process.env.SERVER_ID;
if (!serverId) throw new Error("SERVER_ID manquante (uuid du serveur cible)");
```

Remplacer le bloc « 4. Remplacement idempotent » (delete + insert) :

```ts
    await sql.transaction([
      sql.query("delete from save_snapshots where server_id = $2::uuid and player_guid = $1", [
        guid,
        serverId,
      ]),
      sql.query(
        `insert into save_snapshots (server_id, player_guid, kind, entity_id)
         select $4::uuid, $1, k, e from unnest($2::text[], $3::text[]) as t(k, e)
         on conflict do nothing`,
        [guid, kinds, ids, serverId],
      ),
    ]);
```

Remplacer la fusion (bloc 5) :

```ts
const merged = await sql`
  insert into progress (server_id, user_id, kind, entity_id)
  select s.server_id, m.user_id, s.kind, s.entity_id
  from save_snapshots s
  join server_members m on m.server_id = s.server_id and m.pal_player_guid = s.player_guid
  where s.server_id = ${serverId}::uuid and s.kind in ('pal_caught', 'tech_unlocked')
  union
  select s.server_id, m.user_id, 'marker', 'relic_' || s.entity_id
  from save_snapshots s
  join server_members m on m.server_id = s.server_id and m.pal_player_guid = s.player_guid
  where s.server_id = ${serverId}::uuid and s.kind = 'raw:relic'
    and ('relic_' || s.entity_id) = any(${relicIds}::text[])
  on conflict do nothing
  returning user_id`;
```

Remplacer le récapitulatif (bloc 6) :

```ts
const unclaimed = await sql`
  select s.player_guid, count(*) as n from save_snapshots s
  left join server_members m
    on m.server_id = s.server_id and m.pal_player_guid = s.player_guid
  where s.server_id = ${serverId}::uuid and m.user_id is null
  group by s.player_guid`;
```

- [ ] **Step 2: `extract-players.ts`**

Après le check `DATABASE_URL`, ajouter le même guard `SERVER_ID`. Remplacer l'upsert :

```ts
await sql`
  insert into save_players (server_id, player_guid, nickname, updated_at)
  select ${serverId}::uuid,
         unnest(${players.map((p) => p.guid)}::text[]),
         unnest(${players.map((p) => p.nickname)}::text[]),
         now()
  on conflict (server_id, player_guid)
  do update set nickname = excluded.nickname, updated_at = now()`;
```

- [ ] **Step 3: Workflow**

Dans `.github/workflows/import-saves.yml`, ajouter `SERVER_ID: ${{ secrets.LEGACY_SERVER_ID }}` au bloc `env:` des deux étapes « Import des saves joueurs » et « Pseudos in-game ».

- [ ] **Step 4: Vérifier la syntaxe (sans base)**

Run: `cd packages/pipeline && node --experimental-strip-types --check src/import-save.ts && node --experimental-strip-types --check src/extract-players.ts`
Expected: aucune erreur de syntaxe.

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/import-save.ts packages/pipeline/src/extract-players.ts .github/workflows/import-saves.yml
git commit -m "feat(pipeline): import scopé par SERVER_ID (serveur legacy provisoire)"
```

---

### Task 6: Schéma final + migration B (contraintes)

**Files:**
- Modify: `apps/web/src/lib/server/db/schema.ts`
- Create: `apps/web/drizzle/0004_*.sql` (généré, **relu à la main**)

**Interfaces:**
- Produces: `progress` PK `(serverId, userId, kind, entityId)` + index `progress_server_kind_idx (serverId, kind)` ; `save_snapshots` PK `(serverId, playerGuid, kind, entityId)` ; `save_players` PK `(serverId, playerGuid)` ; `server_id` NOT NULL partout ; `users.palPlayerGuid` supprimé (le type `locals.user` le perd via `$inferSelect` — plus aucun code ne le lit après la Tâche 4). `allowlist` **reste** (supprimée en phase 2).

- [ ] **Step 1: Passer le schéma à l'état final**

Dans `schema.ts` :

- `users` : supprimer la ligne `palPlayerGuid: text("pal_player_guid").unique(),`
- `progress` : `serverId` devient `.notNull()` ; remplacer le bloc contraintes par :

```ts
  (t) => [
    primaryKey({ columns: [t.serverId, t.userId, t.kind, t.entityId] }),
    index("progress_server_kind_idx").on(t.serverId, t.kind),
  ],
```

  (l'ancien `progress_kind_entity_idx` disparaît.)
- `savePlayers` : `serverId` `.notNull()` ; `playerGuid` perd `.primaryKey()` et devient `.notNull()` ; ajouter le bloc :

```ts
  (t) => [primaryKey({ columns: [t.serverId, t.playerGuid] })],
```

- `saveSnapshots` : `serverId` `.notNull()` ; PK → `primaryKey({ columns: [t.serverId, t.playerGuid, t.kind, t.entityId] })`.

- [ ] **Step 2: Générer et relire la migration**

Run: `pnpm --filter web db:generate`
Expected: `apps/web/drizzle/0004_*.sql`. Relecture obligatoire — la migration doit contenir uniquement : `ALTER TABLE … ALTER COLUMN "server_id" SET NOT NULL` (×3), des DROP/ADD CONSTRAINT de PK (×3), `DROP INDEX "progress_kind_entity_idx"`, `CREATE INDEX "progress_server_kind_idx"`, `ALTER TABLE "users" DROP COLUMN "pal_player_guid"`. **Refuser** tout `DROP TABLE`/recréation destructive (drizzle-kit en émet parfois) : dans ce cas, réécrire le SQL généré à la main pour n'avoir que les ALTER ci-dessus et ajuster le snapshot via `drizzle-kit` (`--custom`).

- [ ] **Step 3: Vérifier types + tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS (plus aucune référence à `users.palPlayerGuid` depuis la Tâche 4).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/server/db/schema.ts apps/web/drizzle
git commit -m "feat(web): migration B — server_id NOT NULL, PK composites, drop users.pal_player_guid"
```

---

### Task 7: Documentation — runbook de rollout prod

**Files:**
- Create: `docs/deploy-multi-tenant.md`
- Modify: `docs/decisions.md` (une ligne de renvoi)

**Interfaces:**
- Consumes: scripts/migrations des tâches 1–6.
- Produces: procédure ordonnée exécutée par Sephi au déploiement (les agents ne touchent PAS à la prod).

- [ ] **Step 1: Écrire le runbook**

`docs/deploy-multi-tenant.md` :

```markdown
# Rollout multi-tenant phase 1 (ordre impératif)

L'ordre compense l'absence de transactions runtime : l'ancien code écrit sans
server_id, le nouveau l'exige — la fenêtre entre les deux doit être maîtrisée.

1. **Geler l'import** : GitHub → Actions → workflow `import-saves` → « Disable
   workflow » (le cron 6 h ne doit pas tourner pendant la fenêtre).
2. **Migration A** (additive, sans risque pour le code en prod) :
   `DATABASE_URL=<prod> pnpm --filter web db:migrate`
3. **Backfill** : `pnpm --filter web backfill:legacy 106026755659145216`
   (Discord ID de Sephi ; renommable ensuite). Vérifier la sortie (membres > 0).
4. **Déployer le code** (merge de la branche → Vercel build).
5. **Re-backfill** (rattrape les lignes écrites par l'ancien code entre 3 et 4,
   idempotent) : `pnpm --filter web backfill:legacy 106026755659145216`
6. **Pré-check migration B** — les trois requêtes doivent renvoyer 0 :
   `select count(*) from progress where server_id is null;` (idem
   save_snapshots, save_players)
7. **Migration B** : `DATABASE_URL=<prod> pnpm --filter web db:migrate`
8. **Secret** : GitHub → Settings → Secrets → Actions → `LEGACY_SERVER_ID` =
   `select id from servers where slug = 'legacy';`
9. **Dégeler l'import** (« Enable workflow ») puis lancer un run manuel
   (workflow_dispatch) ; comparer les compteurs du log au run précédent.
10. **Contrôles finaux** : `/` redirige vers `/s/legacy` ; paldex/tech/map/
    import identiques à avant ; coche/décoche OK ; GUID « Rain » toujours lié.

Rollback avant l'étape 7 : l'ancien code reste compatible (colonnes nullables
ignorées). Après l'étape 7 : restaurer la branche Neon de sauvegarde (en créer
une juste avant l'étape 2 depuis la console Neon).
```

- [ ] **Step 2: Renvoi dans decisions.md**

Ajouter à `docs/decisions.md` (section backlog/évolutions) :

```markdown
- Multi-tenant phase 1 : rollout selon `docs/deploy-multi-tenant.md` ;
  spec `docs/superpowers/specs/2026-07-22-multi-tenant-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/deploy-multi-tenant.md docs/decisions.md
git commit -m "docs: runbook de rollout multi-tenant phase 1"
```

---

### Task 8: Vérification bout-en-bout sur branche Neon (spike migrations + tests d'intégration)

**Files:** aucun nouveau — exécution et vérification. (Spike « migrations PK sur Neon » de la spec phase 0 : c'est cette tâche.)

**Prérequis humain :** Sephi crée une branche Neon depuis la console (la base, créée via le Marketplace Vercel, est invisible du compte Neon MCP) et fournit son URL de connexion — ci-dessous `BRANCH_URL`.

- [ ] **Step 1: Appliquer les migrations A puis B sur la branche**

`drizzle-kit migrate` applique toutes les migrations en attente dans une seule
transaction Postgres — comme la branche contient des données legacy (copie de
prod), un `migrate` brut avec 0003 et 0004 toutes deux en attente échouerait
sur le `SET NOT NULL` de 0004 (server_id encore NULL partout) et annulerait
aussi 0003. Basculer le dossier de migrations comme dans le runbook
(`docs/deploy-multi-tenant.md`) : appliquer 0003 seule, backfill, restaurer
0004, puis appliquer 0004.

Run: `git checkout ae8ccda -- apps/web/drizzle` (dossier migrations à l'état A, 0003 seul)

Run: `cd apps/web && DATABASE_URL="$BRANCH_URL" node node_modules/drizzle-kit/bin.cjs migrate`
Expected: `0003_*` appliquée sans erreur.

Run: `cd apps/web && DATABASE_URL="$BRANCH_URL" node --experimental-strip-types scripts/backfill-legacy-server.ts 106026755659145216`
Expected: `serveur legacy <uuid> : +N membres, … rattachés` avec N ≥ 1.

Run: `git checkout HEAD -- apps/web/drizzle` (restaure 0004 et le journal complet)

Run (migration B): `cd apps/web && DATABASE_URL="$BRANCH_URL" node node_modules/drizzle-kit/bin.cjs migrate`
Expected: succès. C'est le **go/no-go** du spike : si drizzle-kit échoue sur les échanges de PK, corriger le SQL de 0004 à la main (Tâche 6 Step 2) et re-tester ici avant tout rollout prod.

- [ ] **Step 2: Contrôles SQL**

Via `psql "$BRANCH_URL"` (ou la console Neon), chaque requête doit rendre 0 :

```sql
select count(*) from progress where server_id is null;
select count(*) from save_snapshots where server_id is null;
select count(*) from save_players where server_id is null;
```

et cohérence : `select count(*) from server_members;` = nombre de lignes de `users`.

- [ ] **Step 3: Tests d'intégration de scoping**

Run: `TEST_DATABASE_URL="$BRANCH_URL" DATABASE_URL="$BRANCH_URL" pnpm --filter web test`
(les deux variables sur la même branche : `TEST_DATABASE_URL` déclenche la suite,
`DATABASE_URL` est lue par `getDb()` via `$env/dynamic/private`, figée par le
plugin SvelteKit à l'init de Vite — la poser dans un `beforeAll` serait trop tard.)
Expected: la suite `scoping multi-tenant` passe (plus aucun `skipped`), le reste inchangé.

- [ ] **Step 4: Passe manuelle UI sur la branche**

Run: dans `apps/web/.env`, pointer temporairement `DATABASE_URL` sur `BRANCH_URL`, puis `pnpm --filter web dev`. Vérifier connecté (compte Sephi) : `/` → `/s/legacy` ; paldex/tech/map affichent le tracking du groupe à l'identique ; coche/décoche persiste ; `/import` liste les GUIDs avec « Rain » revendiqué ; `/s/nimporte-quoi` → 404. Restaurer `.env` ensuite.

- [ ] **Step 5: Import pipeline sur la branche (optionnel mais recommandé)**

Si un dossier de saves local existe (cf. runbook FModel/saves) :

Run: `cd packages/pipeline && DATABASE_URL="$BRANCH_URL" SERVER_ID="<uuid legacy>" node --experimental-strip-types src/import-save.ts <dossier>`
Expected: mêmes compteurs que le dernier run Actions ; `select count(*) from save_snapshots where server_id is null` = 0.

- [ ] **Step 6: Nettoyage et fin**

Supprimer la branche Neon (console). Pousser la branche git :

```bash
git push -u origin feature/multi-tenant
```

Le rollout prod suit `docs/deploy-multi-tenant.md` (action humaine).
