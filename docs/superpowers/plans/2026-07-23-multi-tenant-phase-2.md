# Multi-tenant Phase 2 — « Ouverture » — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ouvrir l'app en libre-service — n'importe quel compte Discord se connecte, crée son serveur, invite ses amis via lien révocable, et bascule entre ses serveurs — spec : `docs/superpowers/specs/2026-07-22-multi-tenant-design.md`, phase 2.

**Architecture:** Nouvelle table `invites` (code 128 bits, garde de concurrence par `UPDATE … RETURNING`). Extension de `apps/web/src/lib/server/servers.ts` avec `requireOwner`, `createServer` (limite 3/user, slug base62 unique), et le cycle de vie des invitations. Nouvelles routes `/servers`, `/servers/new`, `/join/[code]`, `/s/[slug]/settings`. Suppression de l'allowlist et de son shim d'adhésion legacy : l'inscription devient ouverte. Sélecteur de serveur dans le layout `/s/[slug]`. La partie SFTP (phase 3) et kick/leave/delete + filtrage IP SSRF (phase 4) restent hors scope.

**Tech Stack:** SvelteKit 2 + Svelte 5 (runes), Drizzle ORM + driver neon-http (pas de transactions), drizzle-kit (driver `pg`, transactionnel), Neon Postgres, vitest, `node:crypto`.

**Découpage des plans :** ce plan couvre la spec phase 2. La phase 3 (ingestion SFTP self-service : `crypto.ts`, UI SFTP, `import-all.ts`) et la phase 4 (durcissement : kick/leave/delete + nettoyage, filtrage IP SSRF, rotation de clé, audit) auront chacune leur plan.

## Global Constraints

- Monorepo pnpm ; commandes web : `pnpm --filter web <script>` depuis la racine.
- Driver runtime neon-http : **pas de transactions** → toute écriture multi-étapes doit être idempotente/rejouable. La consommation d'invitation se fait par un unique `UPDATE invites SET use_count = use_count + 1 WHERE … AND use_count < max_uses RETURNING server_id` — c'est la garde de concurrence.
- Piège drizzle+neon-http : un tableau JS dans un `sql\`\`` explose en `($1,$2,…)` (pas un `text[]`) → passer une chaîne + `string_to_array`, et caster `::uuid` dans les UNION. (Non requis dans ce plan, mais à respecter si un `sql\`\`` brut est ajouté.)
- Migrations : `pnpm --filter web db:generate` (hors-ligne) puis `db:migrate` (driver pg). **Ne jamais appliquer sur la prod pendant ce plan** — application sur une branche Neon (Tâche 11) puis rollout manuel.
- Repo public GPL : aucun secret, aucun identifiant Discord/monde en dur dans le code. Le seul Discord ID toléré est dans le runbook de rollout (docs), pas dans `apps/web/src`.
- Autorisation systématique : chaque `load`/action/endpoint sous `/s/[slug]` re-vérifie via `requireMembership()` / `requireOwner()` — les layouts ne protègent pas les actions. **404** (pas 403) pour les non-membres afin de ne pas révéler l'existence d'un serveur.
- Entropie invitations : 128 bits (`randomBytes(16).toString("base64url")`). Slugs : 10 caractères base62.
- Limite produit : **max 3 serveurs créés par utilisateur** (COUNT à la création, `error(403)` au-delà).
- Svelte 5 runes (`$state`/`$props`/`$derived`) ; formulaires via SvelteKit actions. Fichiers `.svelte`/`.svelte.ts` : utiliser le skill `svelte:svelte-code-writer` / l'agent `svelte-file-editor` pour les éditions, puis l'autofixer Svelte MCP.
- i18n paraglide : les clés doivent être **identiques** dans `en.json` et `fr.json` (ajouts et suppressions toujours dans les deux fichiers), sinon `check` casse.
- Tests DB-touchants : suivre le gating existant (`apps/web/src/lib/server/scoping.integration.test.ts`) — `describe.skipIf(!process.env.TEST_DATABASE_URL)`, exécution différée sur branche Neon (Tâche 11). **Invocation : les DEUX variables sur la même branche** — `TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web test`. `TEST_DATABASE_URL` déclenche la suite ; `DATABASE_URL` est lue par `getDb()` via `$env/dynamic/private`, que le plugin SvelteKit **fige à l'init de Vite** — muter `process.env.DATABASE_URL` dans un `beforeAll` serait trop tard (aucun effet). Ne pas reproduire ce `beforeAll` mort (leçon de la Tâche 8 phase 1).
- Après chaque tâche : `pnpm --filter web test` et `pnpm --filter web check` doivent passer (sauf mention explicite du contraire ; les suites d'intégration s'affichent `skipped` en local).
- Commentaires et messages de commit en français, style existant (`feat(web): …`).

---

### Task 1: Table `invites` + migration 0005

**Files:**
- Modify: `apps/web/src/lib/server/db/schema.ts`
- Create: `apps/web/drizzle/0005_*.sql` (généré)

**Interfaces:**
- Produces: table Drizzle `tables.invites` avec colonnes `code` (text PK), `serverId` (uuid, FK → servers, onDelete cascade), `createdBy` (uuid, FK → users), `createdAt` (timestamptz default now), `expiresAt` (timestamptz nullable), `revokedAt` (timestamptz nullable), `maxUses` (integer nullable = illimité), `useCount` (integer NOT NULL default 0). Consommée par la Tâche 3.

- [ ] **Step 1: Étendre l'import pg-core**

Dans `apps/web/src/lib/server/db/schema.ts`, remplacer la première ligne d'import par (ajout de `integer`) :

```ts
import { index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Déclarer la table `invites`**

Ajouter à la fin de `apps/web/src/lib/server/db/schema.ts`, après `saveSnapshots` :

```ts
export const invites = pgTable("invites", {
  // 128 bits d'entropie : randomBytes(16).toString("base64url") côté servers.ts.
  code: text("code").primaryKey(),
  serverId: uuid("server_id")
    .notNull()
    .references(() => servers.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // null = pas d'expiration ; null maxUses = usages illimités.
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
});
```

- [ ] **Step 3: Générer la migration**

Run: `pnpm --filter web db:generate`
Expected: un nouveau fichier `apps/web/drizzle/0005_*.sql` contenant uniquement `CREATE TABLE "invites"` + les deux `ADD CONSTRAINT … FOREIGN KEY` (vers `servers` et `users`). **Aucun** `DROP` — sinon corriger le schéma et régénérer.

- [ ] **Step 4: Vérifier types et tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS (table isolée, aucun code existant ne la référence encore).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/server/db/schema.ts apps/web/drizzle
git commit -m "feat(web): table invites (code 128 bits, garde use_count/max_uses)"
```

---

### Task 2: `servers.ts` — helpers purs, `requireOwner`, `createServer`

**Files:**
- Modify: `apps/web/src/lib/server/servers.ts`
- Test: `apps/web/src/lib/server/servers.unit.test.ts` (nouveau, unitaire pur, tourne en local)
- Test: `apps/web/src/lib/server/servers.integration.test.ts` (nouveau, gated `TEST_DATABASE_URL` — exécuté en Tâche 11)

**Interfaces:**
- Consumes: `tables.servers`, `tables.serverMembers` ; `ServerSummary`/`Membership` (existants) ; `requireMembership` (existant).
- Produces (utilisés par les Tâches 3–8) :
  - `generateSlug(): string` — 10 caractères base62.
  - `generateInviteCode(): string` — `randomBytes(16).toString("base64url")` (22 caractères).
  - `requireOwner(user: { id: string } | null, slug: string): Promise<{ server: ServerSummary; membership: Membership }>` — comme `requireMembership` mais `error(404)` si `role !== "owner"`.
  - `createServer(userId: string, name: string): Promise<ServerSummary>` — limite 3/user (`error(403)`), slug unique avec retry, insère serveur + adhésion owner.

- [ ] **Step 1: Écrire le test unitaire des helpers purs**

`apps/web/src/lib/server/servers.unit.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { generateInviteCode, generateSlug } from "./servers";

describe("generateSlug", () => {
  it("produit 10 caractères base62", () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(10);
    expect(slug).toMatch(/^[0-9A-Za-z]{10}$/);
  });
  it("produit des valeurs distinctes", () => {
    expect(generateSlug()).not.toBe(generateSlug());
  });
});

describe("generateInviteCode", () => {
  it("produit un code base64url de 22 caractères (128 bits)", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(22);
    expect(code).toMatch(/^[0-9A-Za-z_-]{22}$/);
  });
  it("produit des valeurs distinctes", () => {
    expect(generateInviteCode()).not.toBe(generateInviteCode());
  });
});
```

- [ ] **Step 2: Lancer le test — il échoue**

Run: `pnpm --filter web test -- servers.unit`
Expected: FAIL — `generateSlug`/`generateInviteCode` ne sont pas exportés (`No "generateSlug" export`).

- [ ] **Step 3: Implémenter les helpers purs + les imports étendus**

Dans `apps/web/src/lib/server/servers.ts`, remplacer l'en-tête d'import :

```ts
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lt, sql, or } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { getDb, tables } from "$lib/server/db";
```

Ajouter après les types `ServerSummary`/`Membership` existants :

```ts
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Slug de serveur : 10 caractères base62 (URLs). Léger biais modulo accepté
 *  — l'unicité est garantie par la contrainte UNIQUE + retry (createServer). */
export function generateSlug(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += BASE62[b % 62];
  return out;
}

/** Code d'invitation : 128 bits d'entropie, base64url (22 caractères). */
export function generateInviteCode(): string {
  return randomBytes(16).toString("base64url");
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}
```

- [ ] **Step 4: Lancer le test — il passe**

Run: `pnpm --filter web test -- servers.unit`
Expected: PASS.

- [ ] **Step 5: Implémenter `requireOwner` et `createServer`**

Ajouter à la fin de `apps/web/src/lib/server/servers.ts` :

```ts
/** Garde owner : comme requireMembership mais 404 (et pas 403) si le membre
 *  n'est pas owner — ne révèle ni l'existence du serveur ni le rôle. */
export async function requireOwner(
  user: { id: string } | null,
  slug: string,
): Promise<{ server: ServerSummary; membership: Membership }> {
  const result = await requireMembership(user, slug);
  if (result.membership.role !== "owner") error(404);
  return result;
}

/** Crée un serveur au nom de userId (owner). Limite : 3 serveurs créés par
 *  utilisateur. Slug unique tiré au sort avec retry sur collision.
 *  Sans transactions : insère le serveur puis l'adhésion (onConflictDoNothing,
 *  rejouable). */
export async function createServer(userId: string, name: string): Promise<ServerSummary> {
  const db = getDb();
  const trimmed = name.trim();
  if (trimmed.length === 0) error(400, "Nom de serveur requis");

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tables.servers)
    .where(eq(tables.servers.ownerId, userId));
  if (n >= 3) error(403, "Limite de 3 serveurs créés atteinte");

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    try {
      const [srv] = await db
        .insert(tables.servers)
        .values({ name: trimmed, slug, ownerId: userId })
        .returning({
          id: tables.servers.id,
          slug: tables.servers.slug,
          name: tables.servers.name,
        });
      await db
        .insert(tables.serverMembers)
        .values({ serverId: srv.id, userId, role: "owner" })
        .onConflictDoNothing();
      return srv;
    } catch (err) {
      if (isUniqueViolation(err)) continue; // collision de slug → nouveau tirage
      throw err;
    }
  }
  error(500, "Impossible de générer un slug unique");
}
```

- [ ] **Step 6: Écrire les cas d'intégration `createServer`/`requireOwner`**

`apps/web/src/lib/server/servers.integration.test.ts` :

```ts
// Test d'intégration multi-tenant (invitations, création de serveur).
// Gated : ne tourne que si TEST_DATABASE_URL est posée (branche Neon migrée
// avec 0005). Exécution différée en Tâche 11. Les DEUX variables sont requises
// sur la même branche — getDb() lit $env/dynamic/private, figée par le plugin
// SvelteKit à l'init de Vite (pas de beforeAll : ce serait trop tard) :
//   TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web test
import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("servers & invitations", () => {
  const tag = () => randomUUID().slice(0, 8);
  const createdUserIds: string[] = [];
  const createdServerIds: string[] = [];

  async function mkUser(): Promise<string> {
    const { getDb, tables } = await import("$lib/server/db");
    const t = tag();
    const [u] = await getDb()
      .insert(tables.users)
      .values({ discordId: `test-${t}`, username: `u-${t}` })
      .returning();
    createdUserIds.push(u.id);
    return u.id;
  }

  afterEach(async () => {
    const { getDb, tables } = await import("$lib/server/db");
    const { inArray } = await import("drizzle-orm");
    const db = getDb();
    if (createdServerIds.length)
      await db.delete(tables.servers).where(inArray(tables.servers.id, createdServerIds));
    if (createdUserIds.length)
      await db.delete(tables.users).where(inArray(tables.users.id, createdUserIds));
    createdServerIds.length = 0;
    createdUserIds.length = 0;
  });

  it("createServer crée serveur + adhésion owner", async () => {
    const { createServer, requireOwner } = await import("$lib/server/servers");
    const uid = await mkUser();
    const srv = await createServer(uid, "Mon monde");
    createdServerIds.push(srv.id);
    expect(srv.slug).toMatch(/^[0-9A-Za-z]{10}$/);
    const { membership } = await requireOwner({ id: uid }, srv.slug);
    expect(membership.role).toBe("owner");
  });

  it("createServer refuse au-delà de 3 serveurs créés", async () => {
    const { createServer } = await import("$lib/server/servers");
    const uid = await mkUser();
    for (let i = 0; i < 3; i++) createdServerIds.push((await createServer(uid, `S${i}`)).id);
    await expect(createServer(uid, "S4")).rejects.toMatchObject({ status: 403 });
  });

  it("requireOwner : 404 pour un membre non-owner", async () => {
    const { createServer, createInvite, consumeInvite, requireOwner } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const member = await mkUser();
    const srv = await createServer(owner, "Partagé");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    await consumeInvite(inv.code, member);
    await expect(requireOwner({ id: member }, srv.slug)).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 7: Vérifier local (intégration skipped) + typecheck**

Run: `pnpm --filter web test`
Expected: PASS — `servers.unit.test.ts` passe ; la suite `servers & invitations` s'affiche `skipped` (pas de `TEST_DATABASE_URL`). Elle référence `createInvite`/`consumeInvite` (Tâche 3) mais le fichier n'est pas exécuté en local, donc pas d'erreur runtime. Le typecheck, lui, doit voir ces exports :

Run: `pnpm --filter web check`
Expected: FAIL — `createInvite`/`consumeInvite` non encore exportés. **C'est attendu** : la Tâche 3 les ajoute. La gate `check` de cette tâche est reportée à la fin de la Tâche 3 (commits séparés, `check` vert exigé après T3).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/server/servers.ts apps/web/src/lib/server/servers.unit.test.ts apps/web/src/lib/server/servers.integration.test.ts
git commit -m "feat(web): createServer (limite 3, slug base62 unique) + requireOwner"
```

---

### Task 3: `servers.ts` — cycle de vie des invitations

**Files:**
- Modify: `apps/web/src/lib/server/servers.ts`
- Modify: `apps/web/src/lib/server/servers.integration.test.ts` (ajout de cas)

**Interfaces:**
- Consumes: `tables.invites` (Tâche 1), `tables.serverMembers`, `tables.servers`, `tables.users`.
- Produces (utilisés par les Tâches 5–7) :
  - `InviteError` (`class`, `code: InviteErrorCode`), `InviteErrorCode = "invite_not_found" | "invite_revoked" | "invite_expired" | "invite_maxed"`.
  - `Invite = { code: string; serverId: string; createdBy: string; createdAt: Date; expiresAt: Date | null; revokedAt: Date | null; maxUses: number | null; useCount: number }`.
  - `MemberSummary = { userId: string; username: string; avatarUrl: string | null; role: "owner" | "member"; joinedAt: Date }`.
  - `ConsumeResult = { slug: string; alreadyMember: boolean }`.
  - `InvitePeek = { serverName: string; slug: string; valid: boolean; reason: InviteErrorCode | null }`.
  - `createInvite(serverId, userId, { expiresAt?, maxUses? }): Promise<Invite>`.
  - `consumeInvite(code, userId): Promise<ConsumeResult>`.
  - `revokeInvite(code, userId): Promise<void>` (owner-only).
  - `listInvites(serverId): Promise<Invite[]>` ; `listMembers(serverId): Promise<MemberSummary[]>` ; `peekInvite(code): Promise<InvitePeek | null>`.

- [ ] **Step 1: Types et erreurs**

Ajouter dans `apps/web/src/lib/server/servers.ts`, après les types existants :

```ts
export type InviteErrorCode =
  | "invite_not_found"
  | "invite_revoked"
  | "invite_expired"
  | "invite_maxed";

/** Erreur d'invitation avec code traduisible (mappé côté route/i18n). */
export class InviteError extends Error {
  constructor(
    public code: InviteErrorCode,
    message?: string,
  ) {
    super(message);
  }
}

export type Invite = {
  code: string;
  serverId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  maxUses: number | null;
  useCount: number;
};

export type MemberSummary = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: Date;
};

export type ConsumeResult = { slug: string; alreadyMember: boolean };
export type InvitePeek = {
  serverName: string;
  slug: string;
  valid: boolean;
  reason: InviteErrorCode | null;
};
```

- [ ] **Step 2: `createInvite`, `listInvites`, `listMembers`, `revokeInvite`**

Ajouter à la fin de `apps/web/src/lib/server/servers.ts` :

```ts
export type NewInviteOptions = { expiresAt?: Date | null; maxUses?: number | null };

/** Crée une invitation pour serverId (createdBy = userId). */
export async function createInvite(
  serverId: string,
  userId: string,
  opts: NewInviteOptions = {},
): Promise<Invite> {
  const db = getDb();
  const [inv] = await db
    .insert(tables.invites)
    .values({
      code: generateInviteCode(),
      serverId,
      createdBy: userId,
      expiresAt: opts.expiresAt ?? null,
      maxUses: opts.maxUses ?? null,
    })
    .returning();
  return inv;
}

export async function listInvites(serverId: string): Promise<Invite[]> {
  const db = getDb();
  return db
    .select()
    .from(tables.invites)
    .where(eq(tables.invites.serverId, serverId))
    .orderBy(desc(tables.invites.createdAt));
}

export async function listMembers(serverId: string): Promise<MemberSummary[]> {
  const db = getDb();
  return db
    .select({
      userId: tables.serverMembers.userId,
      username: tables.users.username,
      avatarUrl: tables.users.avatarUrl,
      role: tables.serverMembers.role,
      joinedAt: tables.serverMembers.joinedAt,
    })
    .from(tables.serverMembers)
    .innerJoin(tables.users, eq(tables.users.id, tables.serverMembers.userId))
    .where(eq(tables.serverMembers.serverId, serverId))
    .orderBy(tables.serverMembers.joinedAt);
}

/** Révoque une invitation. Owner-only : la clause WHERE limite aux serveurs
 *  dont userId est owner (défense en profondeur). Idempotent (no-op si déjà
 *  révoquée ou non-owner). */
export async function revokeInvite(code: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(tables.invites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(tables.invites.code, code),
        isNull(tables.invites.revokedAt),
        inArray(
          tables.invites.serverId,
          db
            .select({ id: tables.serverMembers.serverId })
            .from(tables.serverMembers)
            .where(
              and(
                eq(tables.serverMembers.userId, userId),
                eq(tables.serverMembers.role, "owner"),
              ),
            ),
        ),
      ),
    );
}
```

- [ ] **Step 3: `peekInvite` et `consumeInvite`**

Ajouter à la fin de `apps/web/src/lib/server/servers.ts` :

```ts
/** Lecture non-consommante : nom du serveur + validité de l'invitation, pour
 *  l'écran /join/[code]. */
export async function peekInvite(code: string): Promise<InvitePeek | null> {
  const db = getDb();
  const rows = await db
    .select({
      serverName: tables.servers.name,
      slug: tables.servers.slug,
      revokedAt: tables.invites.revokedAt,
      expiresAt: tables.invites.expiresAt,
      maxUses: tables.invites.maxUses,
      useCount: tables.invites.useCount,
    })
    .from(tables.invites)
    .innerJoin(tables.servers, eq(tables.servers.id, tables.invites.serverId))
    .where(eq(tables.invites.code, code));
  const inv = rows[0];
  if (!inv) return null;
  let reason: InviteErrorCode | null = null;
  if (inv.revokedAt) reason = "invite_revoked";
  else if (inv.expiresAt && new Date(inv.expiresAt) <= new Date()) reason = "invite_expired";
  else if (inv.maxUses !== null && inv.useCount >= inv.maxUses) reason = "invite_maxed";
  return { serverName: inv.serverName, slug: inv.slug, valid: reason === null, reason };
}

/** Consomme une invitation : ajoute userId comme membre et incrémente useCount.
 *  Garde de concurrence sans transaction : l'UPDATE atomique n'incrémente que
 *  si l'invitation est valide (non révoquée, non expirée, quota non atteint).
 *  Déjà membre → aucun usage consommé (retour alreadyMember). */
export async function consumeInvite(code: string, userId: string): Promise<ConsumeResult> {
  const db = getDb();

  // 1. Résoudre l'invitation (serveur cible + diagnostic d'erreur).
  const found = await db
    .select({
      serverId: tables.invites.serverId,
      slug: tables.servers.slug,
      revokedAt: tables.invites.revokedAt,
      expiresAt: tables.invites.expiresAt,
    })
    .from(tables.invites)
    .innerJoin(tables.servers, eq(tables.servers.id, tables.invites.serverId))
    .where(eq(tables.invites.code, code));
  const inv = found[0];
  if (!inv) throw new InviteError("invite_not_found");

  // 2. Déjà membre ? Ne pas consommer d'usage.
  const existing = await db
    .select({ userId: tables.serverMembers.userId })
    .from(tables.serverMembers)
    .where(
      and(
        eq(tables.serverMembers.serverId, inv.serverId),
        eq(tables.serverMembers.userId, userId),
      ),
    );
  if (existing.length > 0) return { slug: inv.slug, alreadyMember: true };

  // 3. Consommation atomique — équivaut à :
  //    UPDATE invites SET use_count = use_count + 1
  //    WHERE code = $1 AND revoked_at IS NULL
  //      AND (expires_at IS NULL OR expires_at > now())
  //      AND (max_uses IS NULL OR use_count < max_uses)
  //    RETURNING server_id
  const consumed = await db
    .update(tables.invites)
    .set({ useCount: sql`${tables.invites.useCount} + 1` })
    .where(
      and(
        eq(tables.invites.code, code),
        isNull(tables.invites.revokedAt),
        or(isNull(tables.invites.expiresAt), gt(tables.invites.expiresAt, new Date())),
        or(isNull(tables.invites.maxUses), lt(tables.invites.useCount, tables.invites.maxUses)),
      ),
    )
    .returning({ serverId: tables.invites.serverId });

  if (consumed.length === 0) {
    // Diagnostiquer la raison exacte du refus.
    if (inv.revokedAt) throw new InviteError("invite_revoked");
    if (inv.expiresAt && new Date(inv.expiresAt) <= new Date())
      throw new InviteError("invite_expired");
    throw new InviteError("invite_maxed");
  }

  // 4. Adhésion (rejouable).
  await db
    .insert(tables.serverMembers)
    .values({ serverId: inv.serverId, userId, role: "member" })
    .onConflictDoNothing();

  return { slug: inv.slug, alreadyMember: false };
}
```

- [ ] **Step 4: Ajouter les cas d'intégration invitations**

Dans `apps/web/src/lib/server/servers.integration.test.ts`, ajouter à l'intérieur du `describe.skipIf(...)`, après le dernier `it(...)` :

```ts
  it("consumeInvite ajoute un membre et incrémente useCount", async () => {
    const { createServer, createInvite, consumeInvite, listInvites, listMembers } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const friend = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    const res = await consumeInvite(inv.code, friend);
    expect(res).toEqual({ slug: srv.slug, alreadyMember: false });
    expect((await listInvites(srv.id))[0].useCount).toBe(1);
    expect((await listMembers(srv.id)).map((m) => m.userId)).toContain(friend);
  });

  it("consumeInvite est idempotent pour un membre existant (pas de double usage)", async () => {
    const { createServer, createInvite, consumeInvite, listInvites } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const friend = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    await consumeInvite(inv.code, friend);
    const again = await consumeInvite(inv.code, friend);
    expect(again.alreadyMember).toBe(true);
    expect((await listInvites(srv.id))[0].useCount).toBe(1);
  });

  it("consumeInvite refuse une invitation révoquée", async () => {
    const { createServer, createInvite, revokeInvite, consumeInvite, InviteError } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const friend = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    await revokeInvite(inv.code, owner);
    await expect(consumeInvite(inv.code, friend)).rejects.toSatisfy(
      (e: unknown) => e instanceof InviteError && e.code === "invite_revoked",
    );
  });

  it("consumeInvite refuse au-delà de maxUses", async () => {
    const { createServer, createInvite, consumeInvite, InviteError } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const a = await mkUser();
    const b = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, { maxUses: 1 });
    await consumeInvite(inv.code, a);
    await expect(consumeInvite(inv.code, b)).rejects.toSatisfy(
      (e: unknown) => e instanceof InviteError && e.code === "invite_maxed",
    );
  });

  it("consumeInvite refuse une invitation expirée", async () => {
    const { createServer, createInvite, consumeInvite, InviteError } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const friend = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, { expiresAt: new Date(Date.now() - 1000) });
    await expect(consumeInvite(inv.code, friend)).rejects.toSatisfy(
      (e: unknown) => e instanceof InviteError && e.code === "invite_expired",
    );
  });

  it("consumeInvite jette invite_not_found pour un code inconnu", async () => {
    const { consumeInvite, InviteError } = await import("$lib/server/servers");
    const uid = await mkUser();
    await expect(consumeInvite("code-bidon", uid)).rejects.toSatisfy(
      (e: unknown) => e instanceof InviteError && e.code === "invite_not_found",
    );
  });

  it("peekInvite retourne le nom du serveur et la validité", async () => {
    const { createServer, createInvite, peekInvite } = await import("$lib/server/servers");
    const owner = await mkUser();
    const srv = await createServer(owner, "Belle Île");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    const peek = await peekInvite(inv.code);
    expect(peek).toMatchObject({ serverName: "Belle Île", slug: srv.slug, valid: true });
    expect(await peekInvite("nope")).toBeNull();
  });

  it("revokeInvite est refusé à un non-owner", async () => {
    const { createServer, createInvite, consumeInvite, revokeInvite, listInvites } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const member = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    await consumeInvite(inv.code, member);
    await revokeInvite(inv.code, member); // no-op : member n'est pas owner
    expect((await listInvites(srv.id))[0].revokedAt).toBeNull();
  });
```

- [ ] **Step 5: Vérifier typecheck + tests (intégration skipped)**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS — `check` est de nouveau vert (tous les exports référencés par la Tâche 2 existent), la suite `servers & invitations` reste `skipped` en local.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/server/servers.ts apps/web/src/lib/server/servers.integration.test.ts
git commit -m "feat(web): cycle de vie des invitations (create/consume/revoke/list, garde use_count)"
```

---

### Task 4: i18n — copie self-service (ajouts)

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/fr.json`

**Interfaces:**
- Produces: les clés de messages consommées par les Tâches 5–8. `landing_private` reçoit une nouvelle copie « accès libre ». (Les clés `auth_denied_*` deviennent mortes et sont retirées en Tâche 9, quand la route `/login/denied` disparaît.)

- [ ] **Step 1: Remplacer la copie « demande à Sephi » de `landing_private`**

Dans `apps/web/messages/en.json`, remplacer la ligne `landing_private` (17) :

```json
  "landing_private": "Open access — sign in with Discord, create your server and invite your friends.",
```

Dans `apps/web/messages/fr.json`, remplacer la ligne `landing_private` (17) :

```json
  "landing_private": "Accès libre — connecte-toi avec Discord, crée ton serveur et invite tes amis.",
```

- [ ] **Step 2: Ajouter les clés self-service (EN)**

Dans `apps/web/messages/en.json`, ajouter ces clés (par ex. après `"auth_logout"`, ligne 12) :

```json
  "servers_title": "My servers",
  "servers_empty": "You're not in any server yet.",
  "servers_create": "Create a server",
  "servers_open": "Open",
  "servers_new_title": "Create a server",
  "servers_new_name": "Server name",
  "servers_new_submit": "Create",
  "servers_err_name_required": "A server name is required.",
  "servers_err_server_limit": "You've reached the limit of 3 created servers.",
  "join_title": "Join a server",
  "join_prompt": "You've been invited to join {name}.",
  "join_accept": "Join {name}",
  "join_login": "Sign in to join",
  "join_not_found": "This invitation link is invalid.",
  "join_err_invite_not_found": "This invitation is invalid.",
  "join_err_invite_revoked": "This invitation has been revoked.",
  "join_err_invite_expired": "This invitation has expired.",
  "join_err_invite_maxed": "This invitation has reached its maximum number of uses.",
  "settings_title": "Settings",
  "settings_nav": "Settings",
  "settings_rename": "Server name",
  "settings_rename_save": "Save",
  "settings_saved": "Saved.",
  "settings_invites_title": "Invitations",
  "settings_no_invites": "No invitations yet.",
  "settings_invite_create": "Create an invitation",
  "settings_invite_expiry": "Expiry (optional)",
  "settings_invite_maxuses": "Max uses (optional)",
  "settings_invite_copy": "Copy link",
  "settings_invite_copied": "Copied!",
  "settings_invite_revoke": "Revoke",
  "settings_invite_revoked": "Revoked",
  "settings_invite_expired": "Expired",
  "settings_invite_active": "Active",
  "settings_invite_uses": "{count} uses",
  "settings_invite_uses_max": "{count}/{max} uses",
  "settings_members_title": "Members",
  "settings_member_owner": "Owner",
  "settings_member_since": "Joined {date}",
  "switcher_all": "All my servers",
```

- [ ] **Step 3: Ajouter les mêmes clés (FR)**

Dans `apps/web/messages/fr.json`, ajouter (même emplacement, après `"auth_logout"`) :

```json
  "servers_title": "Mes serveurs",
  "servers_empty": "Tu n'es dans aucun serveur pour l'instant.",
  "servers_create": "Créer un serveur",
  "servers_open": "Ouvrir",
  "servers_new_title": "Créer un serveur",
  "servers_new_name": "Nom du serveur",
  "servers_new_submit": "Créer",
  "servers_err_name_required": "Un nom de serveur est requis.",
  "servers_err_server_limit": "Tu as atteint la limite de 3 serveurs créés.",
  "join_title": "Rejoindre un serveur",
  "join_prompt": "Tu es invité à rejoindre {name}.",
  "join_accept": "Rejoindre {name}",
  "join_login": "Se connecter pour rejoindre",
  "join_not_found": "Ce lien d'invitation est invalide.",
  "join_err_invite_not_found": "Cette invitation est invalide.",
  "join_err_invite_revoked": "Cette invitation a été révoquée.",
  "join_err_invite_expired": "Cette invitation a expiré.",
  "join_err_invite_maxed": "Cette invitation a atteint son nombre maximum d'utilisations.",
  "settings_title": "Paramètres",
  "settings_nav": "Paramètres",
  "settings_rename": "Nom du serveur",
  "settings_rename_save": "Enregistrer",
  "settings_saved": "Enregistré.",
  "settings_invites_title": "Invitations",
  "settings_no_invites": "Aucune invitation pour l'instant.",
  "settings_invite_create": "Créer une invitation",
  "settings_invite_expiry": "Expiration (optionnel)",
  "settings_invite_maxuses": "Usages max (optionnel)",
  "settings_invite_copy": "Copier le lien",
  "settings_invite_copied": "Copié !",
  "settings_invite_revoke": "Révoquer",
  "settings_invite_revoked": "Révoquée",
  "settings_invite_expired": "Expirée",
  "settings_invite_active": "Active",
  "settings_invite_uses": "{count} usages",
  "settings_invite_uses_max": "{count}/{max} usages",
  "settings_members_title": "Membres",
  "settings_member_owner": "Owner",
  "settings_member_since": "Rejoint le {date}",
  "switcher_all": "Tous mes serveurs",
```

- [ ] **Step 4: Vérifier types + tests (paraglide régénère les accesseurs)**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS — mêmes clés dans les deux locales ; les nouveaux accesseurs `m.*` sont générés par le plugin paraglide.

- [ ] **Step 5: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/fr.json
git commit -m "feat(web): i18n self-service (serveurs, invitations, settings) + copie accès libre"
```

---

### Task 5: Routes `/servers` et `/servers/new`

**Files:**
- Create: `apps/web/src/routes/servers/+page.server.ts`
- Create: `apps/web/src/routes/servers/+page.svelte`
- Create: `apps/web/src/routes/servers/new/+page.server.ts`
- Create: `apps/web/src/routes/servers/new/+page.svelte`

**Interfaces:**
- Consumes: `listMyServers` (existant), `createServer` (Tâche 2).
- Produces: `/servers` liste `ServerSummary[]` avec liens vers `/s/[slug]` et CTA vers `/servers/new` ; `/servers/new` action `default` → `createServer` → redirect `/s/[slug]`, expose `server_limit`.

- [ ] **Step 1: `load` de `/servers`**

`apps/web/src/routes/servers/+page.server.ts` :

```ts
import { redirect } from "@sveltejs/kit";
import { listMyServers } from "$lib/server/servers";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals }: PageServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  return { servers: await listMyServers(locals.user.id) };
}
```

- [ ] **Step 2: Page `/servers`**

`apps/web/src/routes/servers/+page.svelte` :

```svelte
<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();
</script>

<svelte:head><title>{m.servers_title()}</title></svelte:head>

<div class="wrap">
	<header>
		<h1>{m.servers_title()}</h1>
		<a class="cta" href="/servers/new">{m.servers_create()}</a>
	</header>

	{#if data.servers.length === 0}
		<p class="empty">{m.servers_empty()}</p>
	{:else}
		<ul class="list">
			{#each data.servers as s (s.id)}
				<li>
					<a href="/s/{s.slug}">
						<span class="name">{s.name}</span>
						<span class="open">{m.servers_open()} →</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.wrap {
		max-width: 640px;
		margin: 0 auto;
		padding: 32px 16px;
	}
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 20px;
	}
	.cta {
		font-size: 13px;
		font-weight: 600;
		color: var(--accent);
		padding: 6px 12px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
	}
	.empty {
		color: var(--text-3);
	}
	.list {
		list-style: none;
		display: grid;
		gap: 8px;
	}
	.list a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-1);
	}
	.list a:hover {
		border-color: var(--focus-ring);
	}
	.name {
		font-weight: 600;
		color: var(--text-1);
	}
	.open {
		font-size: 13px;
		color: var(--text-3);
	}
</style>
```

- [ ] **Step 3: `load` + action de `/servers/new`**

`apps/web/src/routes/servers/new/+page.server.ts` :

```ts
import { fail, isHttpError, redirect } from "@sveltejs/kit";
import { createServer } from "$lib/server/servers";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ locals }: PageServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  return {};
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) redirect(302, "/login");
    const data = await request.formData();
    const name = data.get("name");
    if (typeof name !== "string" || name.trim().length === 0) {
      return fail(400, { error: "name_required" });
    }
    let slug: string;
    try {
      slug = (await createServer(locals.user.id, name)).slug;
    } catch (err) {
      if (isHttpError(err, 403)) return fail(403, { error: "server_limit" });
      throw err;
    }
    redirect(303, `/s/${slug}`);
  },
};
```

- [ ] **Step 4: Page `/servers/new`**

`apps/web/src/routes/servers/new/+page.svelte` :

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages';

	let { form } = $props();

	function errorMessage(code: string): string {
		const map: Record<string, string> = {
			name_required: m.servers_err_name_required(),
			server_limit: m.servers_err_server_limit()
		};
		return map[code] ?? code;
	}
</script>

<svelte:head><title>{m.servers_new_title()}</title></svelte:head>

<div class="wrap">
	<h1>{m.servers_new_title()}</h1>

	{#if form?.error}
		<p class="error">{errorMessage(form.error)}</p>
	{/if}

	<form method="POST" use:enhance>
		<label for="name">{m.servers_new_name()}</label>
		<input id="name" name="name" type="text" maxlength="60" required />
		<button type="submit">{m.servers_new_submit()}</button>
	</form>
</div>

<style>
	.wrap {
		max-width: 420px;
		margin: 0 auto;
		padding: 40px 16px;
	}
	h1 {
		margin-bottom: 20px;
	}
	.error {
		color: var(--el-fire);
		background: color-mix(in srgb, var(--el-fire) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--el-fire) 30%, transparent);
		border-radius: var(--r-sm);
		padding: 8px 12px;
		font-size: 13px;
		margin-bottom: 16px;
	}
	form {
		display: grid;
		gap: 10px;
	}
	label {
		font-size: 13px;
		color: var(--text-2);
	}
	input {
		padding: 9px 12px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		background: var(--input-bg);
		color: var(--text-1);
		font-size: 14px;
	}
	button {
		margin-top: 6px;
		padding: 10px 16px;
		border-radius: var(--r-md);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
		font-size: 14px;
	}
</style>
```

- [ ] **Step 5: Vérifier types + tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS. Puis lancer l'autofixer Svelte MCP sur les deux `.svelte` créés et re-vérifier `check` si des corrections sont appliquées.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/servers
git commit -m "feat(web): pages /servers (liste + sélecteur) et /servers/new (création)"
```

---

### Task 6: Route `/join/[code]`

**Files:**
- Create: `apps/web/src/routes/join/[code]/+page.server.ts`
- Create: `apps/web/src/routes/join/[code]/+page.svelte`

**Interfaces:**
- Consumes: `peekInvite`, `consumeInvite`, `InviteError` (Tâche 3).
- Produces: `/join/[code]` — `load` retourne `{ invite: InvitePeek | null, loggedIn: boolean }` ; action `default` (login requis) → `consumeInvite` → redirect `/s/[slug]` ; échecs mappés en `fail(409, { error })` avec le code `InviteErrorCode`.

- [ ] **Step 1: `load` + action**

`apps/web/src/routes/join/[code]/+page.server.ts` :

```ts
import { fail, redirect } from "@sveltejs/kit";
import { consumeInvite, InviteError, peekInvite } from "$lib/server/servers";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ locals, params }: PageServerLoadEvent) {
  const invite = await peekInvite(params.code);
  return { invite, loggedIn: !!locals.user };
}

export const actions: Actions = {
  default: async ({ locals, params }) => {
    if (!locals.user) redirect(302, "/login");
    let slug: string;
    try {
      slug = (await consumeInvite(params.code, locals.user.id)).slug;
    } catch (err) {
      if (err instanceof InviteError) return fail(409, { error: err.code });
      throw err;
    }
    redirect(303, `/s/${slug}`);
  },
};
```

- [ ] **Step 2: Page `/join/[code]`**

`apps/web/src/routes/join/[code]/+page.svelte` :

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages';

	let { data, form } = $props();

	function errorMessage(code: string): string {
		const map: Record<string, string> = {
			invite_not_found: m.join_err_invite_not_found(),
			invite_revoked: m.join_err_invite_revoked(),
			invite_expired: m.join_err_invite_expired(),
			invite_maxed: m.join_err_invite_maxed()
		};
		return map[code] ?? code;
	}

	const invalidReason = $derived(
		!data.invite ? 'invite_not_found' : !data.invite.valid ? (data.invite.reason ?? '') : ''
	);
</script>

<svelte:head><title>{m.join_title()}</title></svelte:head>

<div class="wrap">
	<h1>{m.join_title()}</h1>

	{#if !data.invite}
		<p class="error">{m.join_not_found()}</p>
	{:else if invalidReason}
		<p class="error">{errorMessage(invalidReason)}</p>
	{:else}
		<p class="prompt">{m.join_prompt({ name: data.invite.serverName })}</p>
		{#if form?.error}
			<p class="error">{errorMessage(form.error)}</p>
		{/if}
		{#if data.loggedIn}
			<form method="POST" use:enhance>
				<button type="submit">{m.join_accept({ name: data.invite.serverName })}</button>
			</form>
		{:else}
			<a class="login" href="/login/discord">{m.join_login()}</a>
		{/if}
	{/if}
</div>

<style>
	.wrap {
		max-width: 460px;
		margin: 0 auto;
		padding: 48px 16px;
		text-align: center;
	}
	h1 {
		margin-bottom: 16px;
	}
	.prompt {
		color: var(--text-2);
		margin-bottom: 20px;
	}
	.error {
		color: var(--el-fire);
		background: color-mix(in srgb, var(--el-fire) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--el-fire) 30%, transparent);
		border-radius: var(--r-sm);
		padding: 8px 12px;
		font-size: 13px;
	}
	button,
	.login {
		display: inline-block;
		padding: 11px 22px;
		border-radius: var(--r-md);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
		font-size: 14px;
	}
</style>
```

- [ ] **Step 3: Vérifier types + tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS. Passer l'autofixer Svelte MCP sur le `.svelte` créé, re-vérifier `check` si besoin.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/join
git commit -m "feat(web): route /join/[code] (acceptation d'invitation, login requis)"
```

---

### Task 7: Route `/s/[slug]/settings` (owner-only)

**Files:**
- Create: `apps/web/src/routes/s/[slug]/settings/+page.server.ts`
- Create: `apps/web/src/routes/s/[slug]/settings/+page.svelte`

**Interfaces:**
- Consumes: `requireOwner`, `createInvite`, `revokeInvite`, `listInvites`, `listMembers` (Tâches 2–3), `getDb`/`tables` (rename). Layout data `{ server }` via `parent()`.
- Produces: `load` (owner-only, sinon 404) → `{ invites: Invite[], members: MemberSummary[] }` ; actions `rename`, `createInvite`, `revokeInvite`, chacune re-vérifiant `requireOwner`.

- [ ] **Step 1: `load` + actions (chaque action re-vérifie requireOwner)**

`apps/web/src/routes/s/[slug]/settings/+page.server.ts` :

```ts
import { fail } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";
import {
  createInvite,
  listInvites,
  listMembers,
  requireOwner,
  revokeInvite,
} from "$lib/server/servers";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ locals, params }: PageServerLoadEvent) {
  const { server } = await requireOwner(locals.user, params.slug);
  return {
    invites: await listInvites(server.id),
    members: await listMembers(server.id),
  };
}

export const actions: Actions = {
  rename: async ({ request, locals, params }) => {
    const { server } = await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const name = data.get("name");
    if (typeof name !== "string" || name.trim().length === 0) {
      return fail(400, { action: "rename", error: "name_required" });
    }
    const db = getDb();
    await db
      .update(tables.servers)
      .set({ name: name.trim() })
      .where(eq(tables.servers.id, server.id));
    return { renamed: true };
  },

  createInvite: async ({ request, locals, params }) => {
    const { server } = await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const expiresRaw = data.get("expiresAt");
    const maxUsesRaw = data.get("maxUses");

    let expiresAt: Date | null = null;
    if (typeof expiresRaw === "string" && expiresRaw.length > 0) {
      const d = new Date(expiresRaw);
      if (Number.isNaN(d.getTime())) return fail(400, { action: "invite", error: "bad_expiry" });
      expiresAt = d;
    }
    let maxUses: number | null = null;
    if (typeof maxUsesRaw === "string" && maxUsesRaw.length > 0) {
      const parsed = Number.parseInt(maxUsesRaw, 10);
      if (!Number.isInteger(parsed) || parsed < 1)
        return fail(400, { action: "invite", error: "bad_maxuses" });
      maxUses = parsed;
    }

    await createInvite(server.id, locals.user!.id, { expiresAt, maxUses });
    return { invited: true };
  },

  revokeInvite: async ({ request, locals, params }) => {
    await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const code = data.get("code");
    if (typeof code !== "string" || code.length === 0)
      return fail(400, { action: "revoke", error: "bad_code" });
    await revokeInvite(code, locals.user!.id);
    return { revoked: true };
  },
};
```

- [ ] **Step 2: Page `/s/[slug]/settings`**

`apps/web/src/routes/s/[slug]/settings/+page.svelte` :

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data } = $props();

	let copiedCode = $state<string | null>(null);

	function inviteLink(code: string): string {
		return `${page.url.origin}/join/${code}`;
	}

	async function copy(code: string) {
		await navigator.clipboard.writeText(inviteLink(code));
		copiedCode = code;
		setTimeout(() => (copiedCode = null), 1500);
	}

	function fmtDate(d: Date | string): string {
		return new Date(d).toLocaleDateString(getLocale());
	}

	function inviteStatus(inv: (typeof data.invites)[number]): string {
		if (inv.revokedAt) return m.settings_invite_revoked();
		if (inv.expiresAt && new Date(inv.expiresAt) <= new Date()) return m.settings_invite_expired();
		return m.settings_invite_active();
	}

	function usesLabel(inv: (typeof data.invites)[number]): string {
		return inv.maxUses === null
			? m.settings_invite_uses({ count: inv.useCount })
			: m.settings_invite_uses_max({ count: inv.useCount, max: inv.maxUses });
	}
</script>

<svelte:head><title>{m.settings_title()}</title></svelte:head>

<div class="wrap">
	<h1>{m.settings_title()}</h1>

	<section>
		<h2>{m.settings_rename()}</h2>
		<form method="POST" action="?/rename" use:enhance>
			<input name="name" type="text" maxlength="60" value={data.server.name} required />
			<button type="submit">{m.settings_rename_save()}</button>
		</form>
	</section>

	<section>
		<h2>{m.settings_invites_title()}</h2>
		<form class="invite-form" method="POST" action="?/createInvite" use:enhance>
			<label>
				{m.settings_invite_expiry()}
				<input name="expiresAt" type="datetime-local" />
			</label>
			<label>
				{m.settings_invite_maxuses()}
				<input name="maxUses" type="number" min="1" step="1" />
			</label>
			<button type="submit">{m.settings_invite_create()}</button>
		</form>

		{#if data.invites.length === 0}
			<p class="empty">{m.settings_no_invites()}</p>
		{:else}
			<ul class="invites">
				{#each data.invites as inv (inv.code)}
					<li>
						<code class="link">{inviteLink(inv.code)}</code>
						<span class="meta">{inviteStatus(inv)} · {usesLabel(inv)}</span>
						<div class="actions">
							<button type="button" class="ghost" onclick={() => copy(inv.code)}>
								{copiedCode === inv.code ? m.settings_invite_copied() : m.settings_invite_copy()}
							</button>
							{#if !inv.revokedAt}
								<form method="POST" action="?/revokeInvite" use:enhance>
									<input type="hidden" name="code" value={inv.code} />
									<button type="submit" class="danger">{m.settings_invite_revoke()}</button>
								</form>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section>
		<h2>{m.settings_members_title()}</h2>
		<ul class="members">
			{#each data.members as mem (mem.userId)}
				<li>
					{#if mem.avatarUrl}
						<img src={mem.avatarUrl} alt="" width="24" height="24" />
					{/if}
					<span class="name">{mem.username}</span>
					{#if mem.role === 'owner'}
						<span class="role">{m.settings_member_owner()}</span>
					{/if}
					<span class="since">{m.settings_member_since({ date: fmtDate(mem.joinedAt) })}</span>
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.wrap {
		max-width: 680px;
		margin: 0 auto;
		padding: 24px 16px;
		display: grid;
		gap: 32px;
	}
	section {
		display: grid;
		gap: 12px;
	}
	h2 {
		font-size: 15px;
		font-weight: 600;
		color: var(--text-1);
	}
	form {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: end;
	}
	.invite-form label {
		display: grid;
		gap: 4px;
		font-size: 12px;
		color: var(--text-2);
	}
	input {
		padding: 8px 10px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		background: var(--input-bg);
		color: var(--text-1);
		font-size: 13px;
	}
	button {
		padding: 8px 14px;
		border-radius: var(--r-md);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 600;
		font-size: 13px;
	}
	button.ghost {
		background: var(--surface-2);
		color: var(--text-2);
	}
	button.danger {
		background: color-mix(in srgb, var(--el-fire) 20%, transparent);
		color: var(--el-fire);
	}
	.empty {
		color: var(--text-3);
	}
	.invites,
	.members {
		list-style: none;
		display: grid;
		gap: 8px;
	}
	.invites li {
		display: grid;
		gap: 6px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-1);
	}
	.link {
		font-size: 12px;
		color: var(--text-1);
		word-break: break-all;
	}
	.meta {
		font-size: 12px;
		color: var(--text-3);
	}
	.actions {
		display: flex;
		gap: 8px;
	}
	.members li {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-1);
	}
	.members img {
		border-radius: 50%;
	}
	.members .name {
		font-weight: 600;
		color: var(--text-1);
	}
	.members .role {
		font-size: 11px;
		color: var(--accent);
		background: var(--accent-soft);
		padding: 1px 8px;
		border-radius: 999px;
	}
	.members .since {
		margin-left: auto;
		font-size: 12px;
		color: var(--text-3);
	}
</style>
```

- [ ] **Step 3: Vérifier types + tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS. Passer l'autofixer Svelte MCP sur le `.svelte`, re-vérifier `check`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/s/\[slug\]/settings
git commit -m "feat(web): /s/[slug]/settings owner (renommage, invitations, membres)"
```

---

### Task 8: Sélecteur de serveur + `myServers` dans le layout + cookie `last_server`

**Files:**
- Modify: `apps/web/src/routes/s/[slug]/+layout.server.ts`
- Modify: `apps/web/src/routes/s/[slug]/+layout.svelte`

**Interfaces:**
- Consumes: `listMyServers` (existant), `requireMembership` (existant), layout data `{ server, membership }`.
- Produces: layout data enrichi de `myServers: ServerSummary[]` ; cookie `last_server` posé au slug courant (lu par la redirection racine, Tâche 9) ; sélecteur de serveur dans la topbar + lien owner vers `/settings`.

- [ ] **Step 1: Ajouter `myServers` + cookie `last_server` au layout server**

Remplacer le contenu de `apps/web/src/routes/s/[slug]/+layout.server.ts` :

```ts
import { redirect } from "@sveltejs/kit";
import { listMyServers, requireMembership } from "$lib/server/servers";
import type { LayoutServerLoadEvent } from "./$types";

export async function load({ locals, params, cookies }: LayoutServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  const { server, membership } = await requireMembership(locals.user, params.slug);
  const myServers = await listMyServers(locals.user.id);
  // Mémorise le dernier serveur visité (redirection racine, Tâche 9).
  cookies.set("last_server", server.slug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { user: locals.user, server, membership, myServers };
}
```

- [ ] **Step 2: Sélecteur de serveur dans la topbar**

Dans `apps/web/src/routes/s/[slug]/+layout.svelte`, remplacer le lien de marque (ligne 25, `<a href="/" class="brand">{m.app_title()}</a>`) par un sélecteur `<details>` (dropdown sans JS) listant `data.myServers`, un lien vers `/servers`, et un lien owner vers `/settings` :

```svelte
	<details class="switcher">
		<summary>
			<span class="brand">{data.server.name}</span>
			<span class="chevron" aria-hidden="true">▾</span>
		</summary>
		<div class="menu">
			{#each data.myServers as s (s.id)}
				<a href="/s/{s.slug}" class:current={s.slug === data.server.slug}>{s.name}</a>
			{/each}
			<hr />
			{#if data.membership.role === 'owner'}
				<a href={appHref('/settings')}>{m.settings_nav()}</a>
			{/if}
			<a href="/servers">{m.switcher_all()}</a>
		</div>
	</details>
```

- [ ] **Step 3: Styles du sélecteur**

Dans le `<style>` de `apps/web/src/routes/s/[slug]/+layout.svelte`, remplacer le bloc `.brand { … }` existant par :

```css
	.switcher {
		position: relative;
		white-space: nowrap;
	}
	.switcher summary {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		list-style: none;
	}
	.switcher summary::-webkit-details-marker {
		display: none;
	}
	.brand {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 15px;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}
	.chevron {
		font-size: 11px;
		color: var(--text-3);
	}
	.switcher .menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		min-width: 200px;
		display: grid;
		gap: 2px;
		padding: 6px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		background: var(--surface-1);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
		z-index: 20;
	}
	.switcher .menu a {
		padding: 7px 10px;
		border-radius: var(--r-sm);
		color: var(--text-2);
		font-size: 13px;
	}
	.switcher .menu a:hover {
		background: var(--surface-2);
		color: var(--text-1);
	}
	.switcher .menu a.current {
		color: var(--accent);
	}
	.switcher .menu hr {
		border: none;
		border-top: 1px solid var(--border);
		margin: 4px 0;
	}
```

- [ ] **Step 4: Vérifier types + tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS. Passer l'autofixer Svelte MCP sur `+layout.svelte`, re-vérifier `check`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/s/\[slug\]/+layout.server.ts apps/web/src/routes/s/\[slug\]/+layout.svelte
git commit -m "feat(web): sélecteur de serveur + lien settings owner + cookie last_server"
```

---

### Task 9: Inscription ouverte — retrait de l'allowlist et du shim legacy

**Files:**
- Modify: `apps/web/src/routes/login/discord/callback/+server.ts`
- Modify: `apps/web/src/routes/+page.server.ts`
- Delete: `apps/web/src/routes/login/denied/+page.svelte`
- Modify: `apps/web/messages/en.json` (retrait `auth_denied_*`)
- Modify: `apps/web/messages/fr.json` (retrait `auth_denied_*`)

**Interfaces:**
- Consumes: `listMyServers` (existant).
- Produces: callback OAuth sans check allowlist ni shim legacy ; redirection racine `/` → `/servers` si 0 serveur, sinon cookie `last_server` (ou premier) → `/s/[slug]` ; route `/login/denied` supprimée ; clés `auth_denied_title`/`auth_denied_body` supprimées des deux locales.

- [ ] **Step 1: Nettoyer le callback OAuth**

Remplacer intégralement `apps/web/src/routes/login/discord/callback/+server.ts` :

```ts
import { error, redirect } from "@sveltejs/kit";
import { discordClient } from "$lib/server/auth/discord";
import { createSession } from "$lib/server/auth/session";
import { generateSessionToken, sessionExpiresAt } from "$lib/server/auth/session-utils";
import { getDb, tables } from "$lib/server/db";
import type { RequestEvent } from "./$types";

export async function GET(event: RequestEvent) {
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

  // Phase 2 : inscription ouverte — plus d'allowlist, plus de shim d'adhésion
  // legacy. Tout compte Discord se connecte ; l'adhésion se fait via
  // création (/servers/new) ou invitation (/join/[code]).
  const db = getDb();
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

- [ ] **Step 2: Redirection racine ouverte**

Remplacer intégralement `apps/web/src/routes/+page.server.ts` :

```ts
import { redirect } from "@sveltejs/kit";
import { listMyServers } from "$lib/server/servers";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals, cookies }: PageServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  const mine = await listMyServers(locals.user.id);
  // Aucun serveur → page de choix/création. Sinon dernier serveur visité
  // (cookie posé par le layout /s/[slug]), à défaut le premier.
  if (mine.length === 0) redirect(302, "/servers");
  const last = cookies.get("last_server");
  const target = mine.find((s) => s.slug === last) ?? mine[0];
  redirect(302, `/s/${target.slug}`);
}
```

- [ ] **Step 3: Supprimer la route `/login/denied`**

Run: `git rm apps/web/src/routes/login/denied/+page.svelte`
Expected: le fichier disparaît. (Aucun autre fichier dans `login/denied/`.)

- [ ] **Step 4: Retirer les clés i18n mortes**

Dans `apps/web/messages/en.json`, supprimer les lignes `auth_denied_title` et `auth_denied_body`.
Dans `apps/web/messages/fr.json`, supprimer les mêmes deux clés.

- [ ] **Step 5: Vérifier qu'aucune référence ne subsiste**

Run: `grep -rn "auth_denied\|login/denied" apps/web/src apps/web/messages`
Expected: aucune occurrence.

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS (les accesseurs `m.auth_denied_*` ne sont plus générés ni référencés).

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/routes/login apps/web/src/routes/+page.server.ts apps/web/messages
git commit -m "feat(web): inscription ouverte — retrait allowlist/shim legacy, racine → /servers"
```

---

### Task 10: Suppression de la table `allowlist` + migration 0006

**Files:**
- Modify: `apps/web/src/lib/server/db/schema.ts`
- Delete: `apps/web/scripts/allowlist-add.ts`
- Modify: `apps/web/package.json` (retrait du script `allowlist:add`)
- Create: `apps/web/drizzle/0006_*.sql` (généré, **relu à la main**)

**Interfaces:**
- Produces: schéma sans table `allowlist` ; migration ne contenant qu'un `DROP TABLE "allowlist"`. La table `invites` (Tâche 1) reste.

- [ ] **Step 1: Retirer `allowlist` du schéma**

Dans `apps/web/src/lib/server/db/schema.ts`, supprimer le bloc `export const allowlist = pgTable("allowlist", { … });` (lignes 20-24).

- [ ] **Step 2: Supprimer le script et sa déclaration pnpm**

Run: `git rm apps/web/scripts/allowlist-add.ts`

Dans `apps/web/package.json`, supprimer la ligne du script `allowlist:add` (ligne 15) :

```json
		"allowlist:add": "node --env-file=.env --experimental-strip-types scripts/allowlist-add.ts",
```

- [ ] **Step 3: Générer et relire la migration**

Run: `pnpm --filter web db:generate`
Expected: `apps/web/drizzle/0006_*.sql`. Relecture obligatoire — la migration doit contenir uniquement `DROP TABLE "allowlist" CASCADE;` (drizzle-kit émet parfois le drop de la contrainte FK `allowlist_added_by_users_id_fk` d'abord ; les deux sont acceptables). **Refuser** tout `DROP TABLE` sur une autre table.

- [ ] **Step 4: Vérifier qu'aucune référence ne subsiste**

Run: `grep -rn "allowlist" apps/web/src apps/web/scripts apps/web/package.json`
Expected: aucune occurrence.

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/server/db/schema.ts apps/web/scripts apps/web/package.json apps/web/drizzle
git commit -m "feat(web): suppression de la table allowlist (migration 0006)"
```

---

### Task 11: Vérification bout-en-bout sur branche Neon

**Files:** aucun nouveau — exécution et vérification.

**Prérequis humain :** Sephi crée une branche Neon depuis la console (la base, créée via le Marketplace Vercel, est invisible du compte Neon MCP) à partir de l'état **post-phase-1** (migrations 0000→0004 appliquées), et fournit son URL de connexion — ci-dessous `BRANCH_URL`.

- [ ] **Step 1: Appliquer les migrations 0005 + 0006**

Contrairement à la phase 1, ces deux migrations sont non destructives des données existantes (création de `invites`, drop d'`allowlist`) — pas de backfill intermédiaire, `migrate` en une passe suffit.

Run: `cd apps/web && DATABASE_URL="$BRANCH_URL" node node_modules/drizzle-kit/bin.cjs migrate`
Expected: `0005_*` et `0006_*` appliquées sans erreur.

- [ ] **Step 2: Contrôles SQL de schéma**

Via `psql "$BRANCH_URL"` (ou la console Neon) :

```sql
select to_regclass('public.invites');    -- attendu : invites (non NULL)
select to_regclass('public.allowlist');  -- attendu : NULL (table supprimée)
```

- [ ] **Step 3: Suite d'intégration `servers & invitations`**

Run: `TEST_DATABASE_URL="$BRANCH_URL" DATABASE_URL="$BRANCH_URL" pnpm --filter web test`
(les deux variables sur la même branche : `TEST_DATABASE_URL` déclenche la suite, `DATABASE_URL` est lue par `getDb()` via `$env/dynamic/private`.)
Expected: les suites `servers & invitations` (Tâches 2–3) et `scoping multi-tenant` (phase 1) passent, plus aucun `skipped` sur `servers & invitations` ; `servers.unit.test.ts` et `progress.test.ts` inchangés.

- [ ] **Step 4: Parcours manuel — 2ᵉ compte Discord**

Run: dans `apps/web/.env`, pointer temporairement `DATABASE_URL` sur `BRANCH_URL`, puis `pnpm --filter web dev`. Vérifier :

- **Compte A (Sephi)** : `/` → `/s/legacy` (membre existant via backfill phase 1) ; le sélecteur liste ses serveurs.
- **Créer un serveur** : `/servers` → « créer un serveur » → nom → redirige vers `/s/<nouveau slug>` ; A en est owner.
- **Limite** : créer jusqu'à échouer — le 4ᵉ (au-delà de 3 créés) affiche `servers_err_server_limit`.
- **Settings** (owner) : `/s/<slug>/settings` → renommer (le nom change dans la topbar) ; créer une invitation (avec/sans expiration, avec/sans maxUses) ; copier le lien ; la liste des membres s'affiche en lecture seule.
- **Compte B (2ᵉ Discord)** : se connecter → `/` → `/servers` (0 serveur) ; ouvrir le lien `/join/<code>` → « Rejoindre » → `/s/<slug>` ; B apparaît dans la liste des membres côté A.
- **Invitation révoquée** : A révoque l'invitation ; B (déconnecté du serveur via un 3ᵉ code neuf non encore utilisé) sur un lien révoqué → message `join_err_invite_revoked`.
- **maxUses** : invitation `maxUses=1` consommée une fois → 2ᵉ tentative (autre compte) → `join_err_invite_maxed`.
- **404 serveur étranger** : compte B sur `/s/<slug de A dont B n'est pas membre>` → 404 ; `/s/<slug de A>/settings` en tant que membre non-owner → 404.
- **Sélecteur** : bascule A entre `legacy` et son nouveau serveur ; le cookie `last_server` fait que `/` rouvre le dernier visité.

Restaurer `apps/web/.env` ensuite.

- [ ] **Step 5: Nettoyage et push**

Supprimer la branche Neon (console). Pousser la branche git :

```bash
git push origin feature/multi-tenant
```

Le rollout prod (application de 0005/0006 sur la prod, retrait des éventuels résidus allowlist) suit la même prudence que `docs/deploy-multi-tenant.md` (action humaine ; les agents ne touchent pas la prod).

---

## Self-review (spec phase 2)

Revue du plan contre la spec (`docs/superpowers/specs/2026-07-22-multi-tenant-design.md`, ligne phase 2 + sections Sécurité et Architecture applicative) :

**Couverture spec :**
- « Suppression du check allowlist » → Tâche 9 (callback) + Tâche 10 (table/script/migration). ✅
- « création/join/invitations/sélecteur » → Tâche 5 (création + sélecteur `/servers`), Tâche 6 (join), Tâche 3 (invitations), Tâche 8 (sélecteur topbar). ✅
- « settings owner (hors SFTP) » → Tâche 7 (renommage, invitations create/list/revoke, membres lecture seule). SFTP explicitement hors scope (phase 3). ✅
- « limites » → max 3 serveurs (Tâche 2, `createServer`) ; invitations 128 bits + garde `use_count < max_uses RETURNING` (Tâches 1, 3). ✅
- « i18n » → Tâche 4 (copie self-service) + Tâche 9 (retrait `auth_denied_*`). ✅
- Sécurité : 404 non-membre (`requireMembership` existant, réutilisé) ; 404 non-owner (`requireOwner`, Tâche 2) sur load ET chaque action (Tâche 7) ; consommation atomique sans transaction (Tâche 3). ✅
- Architecture routes : `/` → `/servers` ou `/s/[dernier slug]` (Tâche 9, cookie `last_server` Tâche 8) ; `/servers`, `/servers/new`, `/join/[code]`, `/s/[slug]/settings` (Tâches 5–7). ✅
- Onboarding « créer → inviter → rejoindre » couvert par le parcours manuel (Tâche 11 Step 4). ✅
- Hors scope confirmé absent du plan : crypto/SFTP/`import-all` (phase 3) ; kick/leave/delete + filtrage IP SSRF + rotation de clé (phase 4). ✅

**Scan placeholders :** aucun `TODO`/`TBD`/« similar to Task N » ; chaque étape de code montre le code réel complet ; commandes et sorties attendues explicites.

**Cohérence des types :** `ServerSummary`/`Membership` réutilisés des existants ; `requireOwner` retourne le même tuple que `requireMembership` ; `createServer → ServerSummary` consommé par `/servers/new` ; `createInvite → Invite`, `consumeInvite → ConsumeResult`, `peekInvite → InvitePeek | null`, `listInvites → Invite[]`, `listMembers → MemberSummary[]` cohérents entre servers.ts (Tâche 3), settings (Tâche 7) et join (Tâche 6) ; `InviteError.code: InviteErrorCode` mappé identiquement dans les routes et l'i18n (`invite_not_found|revoked|expired|maxed`). Clés i18n ajoutées en Tâche 4 avant toute consommation par les `.svelte` (Tâches 5–8). ✅

**Point d'attention d'exécution :** la gate `check` de la Tâche 2 est **volontairement rouge** (attend les exports de la Tâche 3) ; elle repasse verte en fin de Tâche 3. Les suites d'intégration DB s'exécutent uniquement en Tâche 11 (branche Neon), en local elles s'affichent `skipped` — même convention que la phase 1.

---

## Execution Handoff

Plan complet, sauvegardé dans `docs/superpowers/plans/2026-07-23-multi-tenant-phase-2.md`. Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — un subagent frais par tâche, revue entre chaque, itération rapide (REQUIRED SUB-SKILL : superpowers:subagent-driven-development).
2. **Inline Execution** — exécution des tâches dans cette session avec checkpoints (REQUIRED SUB-SKILL : superpowers:executing-plans).
</content>
</invoke>
