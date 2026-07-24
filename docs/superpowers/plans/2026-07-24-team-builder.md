# Team Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Constructeur d'équipes de Pals (5 slots : Pal + 4 passifs + 3 skills actifs, partner skill dérivé), sauvegardées par auteur et partagées en lecture au serveur, avec indicateurs de capture au niveau espèce.

**Architecture:** Table `teams` unique avec slots en jsonb (écriture atomique — neon-http n'a pas de transactions), validation serveur contre les jeux de données statiques `packages/game-data` via un module partagé client/serveur, endpoints JSON gardés par `requireMembership`, éditeur Svelte 5 à sauvegarde explicite, picker overlay à trois modes cloné de `CommandPalette`.

**Tech Stack:** SvelteKit + Svelte 5 (runes), Drizzle + Neon Postgres (neon-http), Vitest, paraglide (FR/EN).

**Spec:** `docs/superpowers/specs/2026-07-24-team-builder-design.md`

## Global Constraints

- Svelte 5 runes uniquement (`$state`, `$derived`, `$props`, callbacks props) ; `page` depuis `$app/state` ; liens internes via `appHref()` (`$lib/nav.ts`).
- Tout fichier `.svelte` / `.svelte.ts` DOIT être écrit via l'agent `svelte:svelte-file-editor` (MCP Svelte), puis validé par l'autofixer MCP.
- Les deux fichiers messages `apps/web/messages/en.json` et `fr.json` s'éditent TOUJOURS dans la même tâche (dérive de clés = échec `check`). Après édition : `pnpm --filter web exec paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide` si `check` sort des clés « does not exist ».
- Validation côté serveur sûre vis-à-vis du prototype : `Object.prototype.hasOwnProperty.call` / `Set`, jamais `obj[key]` sur une clé utilisateur.
- `server_id` dans CHAQUE clause WHERE des requêtes teams (défense en profondeur).
- Chaque load/endpoint ouvre par `requireMembership(event.locals.user, event.params.slug)` (`$lib/server/servers.ts`) — les layouts ne protègent rien.
- Design system : tokens `apps/web/src/app.css` uniquement, `color-mix` (jamais de hex en dur), `.tnum` sur tout nombre dynamique, réf. `.interface-design/system.md`.
- Erreurs API : non-membre → 404 (via requireMembership) ; non-auteur → 403 ; teamId inconnu → 404 ; payload invalide → 400.
- Limites : name 1–80 (trim), notes ≤ 2000, 5 slots max, 4 passifs max, 3 actifs max, 100 équipes/serveur.
- Branche de travail : `feature/team-builder` (jamais main). Commits fréquents, messages `feat(web): …`.
- Tests : `pnpm --filter web exec vitest run <fichier>` ; intégration gated `TEST_DATABASE_URL` **et** `DATABASE_URL` sur la MÊME branche Neon (l'env est figé à l'init Vite, un beforeAll est trop tard).

---

### Task 1: Schéma `teams` + type `TeamSlot` + migration 0008

**Files:**
- Modify: `apps/web/src/lib/server/db/schema.ts` (ajouter après `progress`, ~ligne 81)
- Modify: `apps/web/src/lib/types.ts`
- Create: `apps/web/drizzle/0008_*.sql` (généré par drizzle-kit, relu à la main)

**Interfaces:**
- Produces: `tables.teams` (Drizzle), `type TeamSlot = { palId: string; passives: string[]; actives: string[] } | null` exporté de `$lib/types`.

- [ ] **Step 1: Créer la branche**

```bash
git checkout -b feature/team-builder
```

- [ ] **Step 2: Ajouter `TeamSlot` à `apps/web/src/lib/types.ts`**

```ts
export type GroupUser = { id: string; username: string; avatarUrl: string | null };

// Un slot d'équipe : null = slot vide. Le partner skill n'est pas stocké
// (dérivé du pal : `partnerskill:<palId>`). Normalisé à 5 entrées côté serveur.
export type TeamSlot = { palId: string; passives: string[]; actives: string[] } | null;
```

- [ ] **Step 3: Ajouter la table dans `apps/web/src/lib/server/db/schema.ts`**

Après le bloc `progress` (garder les imports existants — `jsonb`, `index`, `uuid`, `text`, `timestamp` sont déjà importés) :

```ts
import type { TeamSlot } from "$lib/types";

// Équipes de Pals : slots en jsonb pour une écriture atomique (neon-http n'a
// pas de transactions). PK surrogate (URLs) — écart assumé à la convention
// PK composite ; server_id reste dans chaque WHERE (cf. lib/server/teams.ts).
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes").notNull().default(""),
    slots: jsonb("slots").$type<TeamSlot[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("teams_server_idx").on(t.serverId)],
);
```

- [ ] **Step 4: Générer et relire la migration**

```bash
pnpm --filter web db:generate
```

Relire `apps/web/drizzle/0008_*.sql` : attendu **exactement** un `CREATE TABLE "teams"`, deux FKs (cascade), un `CREATE INDEX "teams_server_idx"`. drizzle-kit a des antécédents dans ce repo (noms de PK erronés, drops parasites) — supprimer/corriger à la main tout ce qui dépasse ce périmètre.

- [ ] **Step 5: Appliquer sur la branche Neon de dev**

```bash
DATABASE_URL=<branche-neon-dev> pnpm --filter web db:migrate
```

Attendu : migration 0008 appliquée sans erreur. **Prod = action manuelle de Sephi au rollout** (additive, sans bascule dossier).

- [ ] **Step 6: Vérifier `check` et commit**

```bash
pnpm --filter web check
git add apps/web/src/lib/types.ts apps/web/src/lib/server/db/schema.ts apps/web/drizzle
git commit -m "feat(web): table teams (slots jsonb) + migration 0008"
```

---

### Task 2: Module partagé `team-data.ts` (ensembles éligibles + learnset)

**Files:**
- Create: `apps/web/src/lib/game/team-data.ts`
- Test: `apps/web/src/lib/game/team-data.test.ts`

**Interfaces:**
- Produces:
  - `PAL_IDS: Set<string>`, `PASSIVE_IDS: Set<string>`, `ACTIVE_SKILL_IDS: Set<string>`
  - `learnsetFor(palId: string): Array<{ level: number; skillId: string }>` (trié par level, filtré sur `ACTIVE_SKILL_IDS`, `[]` possible)
  - `partnerSkillNsId(palId: string): string` → `` `partnerskill:${palId}` ``
  - `passiveRank(passiveId: string): number`
- ATTENTION : ce module ne doit importer NI paraglide NI `$lib/game/names.ts` (il est consommé par le validateur serveur et par les tests vitest sans runtime paraglide). Les noms EN viennent du JSON l10n directement.

- [ ] **Step 1: Écrire les tests qui échouent — `apps/web/src/lib/game/team-data.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import pals from "@palworld-companion/game-data/pals.json";
import namesEn from "@palworld-companion/game-data/l10n/names.en.json";
import {
  ACTIVE_SKILL_IDS,
  PAL_IDS,
  PASSIVE_IDS,
  learnsetFor,
  partnerSkillNsId,
  passiveRank,
} from "./team-data";

describe("team-data", () => {
  it("PAL_IDS couvre pals.json", () => {
    expect(PAL_IDS.size).toBe((pals as Array<{ id: string }>).length);
    expect(PAL_IDS.has("Anubis")).toBe(true);
  });

  it("ACTIVE_SKILL_IDS exclut les partner skills et les skills sans nom EN", () => {
    expect(ACTIVE_SKILL_IDS.has("AirCanon")).toBe(true);
    expect(ACTIVE_SKILL_IDS.has("BlueThunderHorse_PartnerSkill")).toBe(false);
    expect(ACTIVE_SKILL_IDS.has("Human_Rolling")).toBe(false); // junk sans nom EN
    for (const id of ACTIVE_SKILL_IDS) {
      expect((namesEn as Record<string, string>)[`skill:${id}`]).toBeTruthy();
    }
  });

  it("PASSIVE_IDS non vide et cohérent", () => {
    expect(PASSIVE_IDS.size).toBeGreaterThan(400);
    expect(PASSIVE_IDS.has("AccuracyDecrease")).toBe(true);
    expect(passiveRank("AccuracyDecrease")).toBe(1);
  });

  it("learnsetFor est insensible à la casse (GhostAnglerFish dans pal-moves)", () => {
    expect(learnsetFor("GhostAnglerfish").length).toBeGreaterThan(0);
  });

  it("learnsetFor renvoie [] pour WorldTreeDragon (aucun learnset)", () => {
    expect(learnsetFor("WorldTreeDragon")).toEqual([]);
  });

  it("learnsetFor trie par niveau et ne contient que des skills éligibles", () => {
    const ls = learnsetFor("SheepBall");
    expect(ls.length).toBeGreaterThan(0);
    for (let i = 1; i < ls.length; i++) expect(ls[i].level).toBeGreaterThanOrEqual(ls[i - 1].level);
    for (const e of ls) expect(ACTIVE_SKILL_IDS.has(e.skillId)).toBe(true);
  });

  it("chaque Pal a un nom de partner skill FR et EN", async () => {
    const namesFr = (await import("@palworld-companion/game-data/l10n/names.fr.json")).default;
    for (const p of pals as Array<{ id: string }>) {
      const ns = partnerSkillNsId(p.id);
      expect((namesEn as Record<string, string>)[ns], ns).toBeTruthy();
      expect((namesFr as Record<string, string>)[ns], ns).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

```bash
pnpm --filter web exec vitest run src/lib/game/team-data.test.ts
```

Attendu : FAIL — `Cannot find module './team-data'`.

- [ ] **Step 3: Implémenter `apps/web/src/lib/game/team-data.ts`**

```ts
// Ensembles éligibles du team builder, partagés client (pickers) / serveur
// (validation) pour que l'UI propose exactement ce que le serveur accepte.
// N'importe PAS paraglide/names.ts : utilisé par le validateur et vitest.
import pals from "@palworld-companion/game-data/pals.json";
import skills from "@palworld-companion/game-data/skills.json";
import palMoves from "@palworld-companion/game-data/pal-moves.json";
import passiveEffects from "@palworld-companion/game-data/passive-effects.json";
import namesEn from "@palworld-companion/game-data/l10n/names.en.json";

const NAMES_EN = namesEn as Record<string, string>;
const PASSIVES = passiveEffects as Record<string, { rank: number }>;

export const PAL_IDS: Set<string> = new Set((pals as Array<{ id: string }>).map((p) => p.id));

// skills.json mélange actifs et partner skills ; 52 entrées (PNJ/junk) n'ont
// pas de nom EN — exclues des deux côtés (picker ET validation).
export const ACTIVE_SKILL_IDS: Set<string> = new Set(
  Object.keys(skills as Record<string, unknown>).filter(
    (id) => !/partnerskill/i.test(id) && Boolean(NAMES_EN[`skill:${id}`]),
  ),
);

export const PASSIVE_IDS: Set<string> = new Set(Object.keys(PASSIVES));

export function passiveRank(passiveId: string): number {
  return Object.prototype.hasOwnProperty.call(PASSIVES, passiveId)
    ? PASSIVES[passiveId].rank
    : 0;
}

// pal-moves.json diverge en casse de pals.json pour 4 ids (ex. GhostAnglerFish
// vs GhostAnglerfish, cf. packages/pipeline/src/transform/pals.ts:6).
const MOVES_LC = new Map<string, Array<{ level: number; skillId: string }>>(
  Object.entries(palMoves as Record<string, Array<{ level: number; skillId: string }>>).map(
    ([k, v]) => [k.toLowerCase(), v],
  ),
);

export function learnsetFor(palId: string): Array<{ level: number; skillId: string }> {
  const raw = MOVES_LC.get(palId.toLowerCase()) ?? [];
  return raw
    .filter((e) => ACTIVE_SKILL_IDS.has(e.skillId))
    .slice()
    .sort((a, b) => a.level - b.level);
}

export function partnerSkillNsId(palId: string): string {
  return `partnerskill:${palId}`;
}
```

- [ ] **Step 4: Vérifier le PASS**

```bash
pnpm --filter web exec vitest run src/lib/game/team-data.test.ts
```

Attendu : PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/game/team-data.ts apps/web/src/lib/game/team-data.test.ts
git commit -m "feat(web): team-data - ensembles éligibles et learnset du team builder"
```

---

### Task 3: Validation `validateTeamInput` (TDD)

**Files:**
- Create: `apps/web/src/lib/server/teams.ts` (validation seule dans cette tâche)
- Test: `apps/web/src/lib/server/teams.test.ts`

**Interfaces:**
- Consumes: `PAL_IDS`, `PASSIVE_IDS`, `ACTIVE_SKILL_IDS` de `$lib/game/team-data` ; `TeamSlot` de `$lib/types`.
- Produces: `type TeamInput = { name: string; notes: string; slots: TeamSlot[] }` et `validateTeamInput(raw: unknown): TeamInput` — lance `error(400, …)` de `@sveltejs/kit` sinon ; normalise (trim name, slots paddés à 5 `null`).

- [ ] **Step 1: Écrire les tests qui échouent — `apps/web/src/lib/server/teams.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { validateTeamInput } from "./teams";

const slot = (over: Record<string, unknown> = {}) => ({
  palId: "Anubis",
  passives: ["AccuracyDecrease"],
  actives: ["AirCanon"],
  ...over,
});
const valid = (over: Record<string, unknown> = {}) => ({
  name: "Boss rush",
  notes: "anti Jetragon",
  slots: [slot(), null],
  ...over,
});

// error(400) de @sveltejs/kit lance un HttpError { status, body }.
const rejects = (raw: unknown) => {
  try {
    validateTeamInput(raw);
  } catch (e) {
    expect((e as { status?: number }).status).toBe(400);
    return;
  }
  throw new Error("validateTeamInput aurait dû rejeter");
};

describe("validateTeamInput", () => {
  it("accepte une équipe valide et normalise à 5 slots", () => {
    const t = validateTeamInput(valid());
    expect(t.name).toBe("Boss rush");
    expect(t.slots).toHaveLength(5);
    expect(t.slots[0]).toEqual(slot());
    expect(t.slots.slice(1)).toEqual([null, null, null, null]);
  });

  it("trim le nom, rejette vide / trop long / mauvais types", () => {
    expect(validateTeamInput(valid({ name: "  ok  " })).name).toBe("ok");
    rejects(valid({ name: "   " }));
    rejects(valid({ name: "x".repeat(81) }));
    rejects(valid({ name: 42 }));
    rejects(valid({ notes: "x".repeat(2001) }));
    rejects(valid({ notes: 42 }));
    rejects(null);
    rejects("nope");
  });

  it("rejette les slots invalides", () => {
    rejects(valid({ slots: "nope" }));
    rejects(valid({ slots: [slot(), slot(), slot(), slot(), slot(), slot()] })); // > 5
    rejects(valid({ slots: [slot({ palId: "NotAPal" })] }));
    rejects(valid({ slots: [slot({ palId: 42 })] }));
    rejects(valid({ slots: [{ ...slot(), extra: true }] })); // clé en trop
    rejects(valid({ slots: [slot({ __proto__: { polluted: true } })] })); // sonde proto
  });

  it("rejette les passifs invalides", () => {
    rejects(valid({ slots: [slot({ passives: ["NotAPassive"] })] }));
    rejects(valid({ slots: [slot({ passives: ["AccuracyDecrease", "AccuracyDecrease"] })] })); // doublon
    rejects(
      valid({
        slots: [
          slot({
            passives: [
              "AccuracyDecrease",
              "AccuracyIncrease",
              "AttackUp1",
              "DefenseUp1",
              "CraftSpeed_up1",
            ],
          }),
        ],
      }),
    ); // > 4 (ids indicatifs : prendre 5 ids réels de passive-effects.json)
    rejects(valid({ slots: [slot({ passives: "AccuracyDecrease" })] }));
  });

  it("rejette les actifs invalides (partner skill, junk, doublon, > 3)", () => {
    rejects(valid({ slots: [slot({ actives: ["BlueThunderHorse_PartnerSkill"] })] }));
    rejects(valid({ slots: [slot({ actives: ["Human_Rolling"] })] }));
    rejects(valid({ slots: [slot({ actives: ["AirCanon", "AirCanon"] })] }));
    rejects(valid({ slots: [slot({ actives: ["AirCanon", "AirBlade", "AquaJet", "AcidRain"] })] }));
  });
});
```

NB implémenteur : si un id de passif du test « > 4 » n'existe pas dans `passive-effects.json`, remplacer par des ids réels (`python3 -c "import json;print(list(json.load(open('packages/game-data/passive-effects.json')))[:5])"` depuis la racine).

- [ ] **Step 2: Vérifier l'échec**

```bash
pnpm --filter web exec vitest run src/lib/server/teams.test.ts
```

Attendu : FAIL — `Cannot find module './teams'`.

- [ ] **Step 3: Implémenter la validation dans `apps/web/src/lib/server/teams.ts`**

```ts
import { error } from "@sveltejs/kit";
import { ACTIVE_SKILL_IDS, PAL_IDS, PASSIVE_IDS } from "$lib/game/team-data";
import type { TeamSlot } from "$lib/types";

export type TeamInput = { name: string; notes: string; slots: TeamSlot[] };

export const MAX_SLOTS = 5;
export const MAX_PASSIVES = 4;
export const MAX_ACTIVES = 3;
export const MAX_TEAMS_PER_SERVER = 100;

const SLOT_KEYS = new Set(["palId", "passives", "actives"]);

function validIdList(v: unknown, max: number, registry: Set<string>): v is string[] {
  if (!Array.isArray(v) || v.length > max) return false;
  if (v.some((x) => typeof x !== "string" || !registry.has(x))) return false;
  return new Set(v).size === v.length;
}

function validateSlot(raw: unknown): TeamSlot {
  if (raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) error(400, "slot invalide");
  const keys = Object.keys(raw as object);
  if (keys.length > SLOT_KEYS.size || keys.some((k) => !SLOT_KEYS.has(k)))
    error(400, "slot invalide");
  const { palId, passives, actives } = raw as Record<string, unknown>;
  if (typeof palId !== "string" || !PAL_IDS.has(palId)) error(400, "pal inconnu");
  if (!validIdList(passives, MAX_PASSIVES, PASSIVE_IDS)) error(400, "passifs invalides");
  if (!validIdList(actives, MAX_ACTIVES, ACTIVE_SKILL_IDS)) error(400, "skills invalides");
  return { palId, passives, actives };
}

/** Valide et normalise un payload d'équipe (400 sinon). Slots paddés à 5 null. */
export function validateTeamInput(raw: unknown): TeamInput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    error(400, "payload invalide");
  const { name, notes, slots } = raw as Record<string, unknown>;
  if (typeof name !== "string") error(400, "nom requis");
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) error(400, "nom : 1 à 80 caractères");
  if (typeof notes !== "string" || notes.length > 2000) error(400, "notes : 2000 caractères max");
  if (!Array.isArray(slots) || slots.length > MAX_SLOTS) error(400, "5 slots maximum");
  const parsed = slots.map(validateSlot);
  while (parsed.length < MAX_SLOTS) parsed.push(null);
  return { name: trimmed, notes, slots: parsed };
}
```

- [ ] **Step 4: Vérifier le PASS**

```bash
pnpm --filter web exec vitest run src/lib/server/teams.test.ts
```

Attendu : PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/server/teams.ts apps/web/src/lib/server/teams.test.ts
git commit -m "feat(web): validation des équipes (validateTeamInput)"
```

---

### Task 4: CRUD serveur + endpoints API

**Files:**
- Modify: `apps/web/src/lib/server/teams.ts` (ajouter le CRUD sous la validation)
- Create: `apps/web/src/routes/api/servers/[slug]/teams/+server.ts`
- Create: `apps/web/src/routes/api/servers/[slug]/teams/[teamId]/+server.ts`

**Interfaces:**
- Consumes: `getDb`, `tables` (`$lib/server/db`), `requireMembership` (`$lib/server/servers`), `validateTeamInput`/`TeamInput`/`MAX_TEAMS_PER_SERVER` (Task 3).
- Produces (pour les loads Task 8) :
  - `type TeamRow = { id: string; name: string; notes: string; slots: TeamSlot[]; authorId: string; authorName: string; authorAvatarUrl: string | null; updatedAt: Date }`
  - `listTeams(serverId: string): Promise<TeamRow[]>` (tri `updatedAt` desc)
  - `getTeam(serverId: string, teamId: string): Promise<TeamRow | null>`
  - `createTeam(serverId: string, userId: string, input: TeamInput): Promise<TeamRow>` (403 si ≥ 100 équipes)
  - `updateTeam(serverId: string, teamId: string, userId: string, input: TeamInput): Promise<TeamRow>` (403 non-auteur, 404 inconnu)
  - `deleteTeam(serverId: string, teamId: string, userId: string): Promise<void>` (403 non-auteur, 404 inconnu)
- API : `POST /api/servers/[slug]/teams` → 201 + TeamRow ; `PUT /api/servers/[slug]/teams/[id]` → 200 + TeamRow ; `DELETE …/[id]` → 204.

- [ ] **Step 1: Ajouter le CRUD à `apps/web/src/lib/server/teams.ts`**

Ajouter aux imports : `import { and, desc, eq, sql } from "drizzle-orm";`, `import { getDb, tables } from "$lib/server/db";`.

```ts
export type TeamRow = {
  id: string;
  name: string;
  notes: string;
  slots: TeamSlot[];
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  updatedAt: Date;
};

const teamSelect = {
  id: tables.teams.id,
  name: tables.teams.name,
  notes: tables.teams.notes,
  slots: tables.teams.slots,
  authorId: tables.teams.authorId,
  authorName: tables.users.username,
  authorAvatarUrl: tables.users.avatarUrl,
  updatedAt: tables.teams.updatedAt,
};

export async function listTeams(serverId: string): Promise<TeamRow[]> {
  const db = getDb();
  return db
    .select(teamSelect)
    .from(tables.teams)
    .innerJoin(tables.users, eq(tables.teams.authorId, tables.users.id))
    .where(eq(tables.teams.serverId, serverId))
    .orderBy(desc(tables.teams.updatedAt));
}

export async function getTeam(serverId: string, teamId: string): Promise<TeamRow | null> {
  const db = getDb();
  const rows = await db
    .select(teamSelect)
    .from(tables.teams)
    .innerJoin(tables.users, eq(tables.teams.authorId, tables.users.id))
    .where(and(eq(tables.teams.id, teamId), eq(tables.teams.serverId, serverId)));
  return rows[0] ?? null;
}

export async function createTeam(
  serverId: string,
  userId: string,
  input: TeamInput,
): Promise<TeamRow> {
  const db = getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tables.teams)
    .where(eq(tables.teams.serverId, serverId));
  if (n >= MAX_TEAMS_PER_SERVER) error(403, "Limite de 100 équipes atteinte");
  const [row] = await db
    .insert(tables.teams)
    .values({ serverId, authorId: userId, ...input })
    .returning({ id: tables.teams.id });
  return (await getTeam(serverId, row.id))!;
}

/** UPDATE … WHERE id AND server_id AND author_id ; 0 ligne → re-select pour
 *  distinguer 404 (inconnu) de 403 (pas l'auteur). */
export async function updateTeam(
  serverId: string,
  teamId: string,
  userId: string,
  input: TeamInput,
): Promise<TeamRow> {
  const db = getDb();
  const updated = await db
    .update(tables.teams)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(
        eq(tables.teams.id, teamId),
        eq(tables.teams.serverId, serverId),
        eq(tables.teams.authorId, userId),
      ),
    )
    .returning({ id: tables.teams.id });
  if (updated.length === 0) {
    const existing = await getTeam(serverId, teamId);
    if (!existing) error(404, "équipe inconnue");
    error(403, "seul l'auteur peut modifier cette équipe");
  }
  return (await getTeam(serverId, teamId))!;
}

export async function deleteTeam(serverId: string, teamId: string, userId: string): Promise<void> {
  const db = getDb();
  const deleted = await db
    .delete(tables.teams)
    .where(
      and(
        eq(tables.teams.id, teamId),
        eq(tables.teams.serverId, serverId),
        eq(tables.teams.authorId, userId),
      ),
    )
    .returning({ id: tables.teams.id });
  if (deleted.length === 0) {
    const existing = await getTeam(serverId, teamId);
    if (!existing) error(404, "équipe inconnue");
    error(403, "seul l'auteur peut supprimer cette équipe");
  }
}
```

- [ ] **Step 2: Créer `apps/web/src/routes/api/servers/[slug]/teams/+server.ts`**

```ts
import { json } from "@sveltejs/kit";
import { createTeam, validateTeamInput } from "$lib/server/teams";
import { requireMembership } from "$lib/server/servers";
import type { RequestEvent } from "./$types";

export async function POST(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const input = validateTeamInput(await event.request.json().catch(() => null));
  const team = await createTeam(server.id, event.locals.user!.id, input);
  return json(team, { status: 201 });
}
```

- [ ] **Step 3: Créer `apps/web/src/routes/api/servers/[slug]/teams/[teamId]/+server.ts`**

```ts
import { json } from "@sveltejs/kit";
import { deleteTeam, updateTeam, validateTeamInput } from "$lib/server/teams";
import { requireMembership } from "$lib/server/servers";
import type { RequestEvent } from "./$types";

export async function PUT(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const input = validateTeamInput(await event.request.json().catch(() => null));
  const team = await updateTeam(server.id, event.params.teamId, event.locals.user!.id, input);
  return json(team);
}

export async function DELETE(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  await deleteTeam(server.id, event.params.teamId, event.locals.user!.id);
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: Vérifier**

```bash
pnpm --filter web check
pnpm --filter web exec vitest run src/lib/server/teams.test.ts
```

Attendu : 0 erreur `check`, tests Task 3 toujours PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/server/teams.ts "apps/web/src/routes/api/servers/[slug]/teams"
git commit -m "feat(web): CRUD équipes + endpoints API (auteur seul en écriture)"
```

---

### Task 5: Tests d'intégration DB

**Files:**
- Create: `apps/web/src/lib/server/teams.integration.test.ts`

**Interfaces:**
- Consumes: tout Task 4. Motif fixture : `scoping.integration.test.ts` (deux serveurs, u1 owner-de-A + member-de-B).

- [ ] **Step 1: Écrire `apps/web/src/lib/server/teams.integration.test.ts`**

```ts
// Gated : TEST_DATABASE_URL ET DATABASE_URL sur la MÊME branche Neon (migrée 0008).
//   TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web test
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("teams CRUD + authz", () => {
  const tag = randomUUID().slice(0, 8);
  let db: Awaited<ReturnType<typeof mkDb>>;
  let srvA: string, srvB: string, u1: string, u2: string;

  const input = () => ({
    name: `Boss-${tag}`,
    notes: "notes",
    slots: [
      { palId: "Anubis", passives: ["AccuracyDecrease"], actives: ["AirCanon"] },
      null,
      null,
      null,
      null,
    ],
  });

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
      { serverId: srvA, userId: u2, role: "member" },
      { serverId: srvB, userId: u2, role: "owner" },
    ]);
  });

  afterAll(async () => {
    const { tables } = await import("$lib/server/db");
    const { inArray } = await import("drizzle-orm");
    // Cascade : supprimer les serveurs emporte membres et équipes.
    await db.delete(tables.servers).where(inArray(tables.servers.id, [srvA, srvB]));
    await db.delete(tables.users).where(inArray(tables.users.id, [u1, u2]));
  });

  it("CRUD complet avec fidélité jsonb", async () => {
    const { createTeam, getTeam, updateTeam, deleteTeam } = await import("$lib/server/teams");
    const created = await createTeam(srvA, u2, input());
    expect(created.authorId).toBe(u2);
    expect(created.slots).toEqual(input().slots);

    const fetched = await getTeam(srvA, created.id);
    expect(fetched?.slots?.[0]?.palId).toBe("Anubis");
    expect(fetched?.authorName).toBe(`t2-${tag}`);

    const updated = await updateTeam(srvA, created.id, u2, {
      ...input(),
      name: `Farm-${tag}`,
      slots: [null, null, null, null, null],
    });
    expect(updated.name).toBe(`Farm-${tag}`);
    expect(updated.slots).toEqual([null, null, null, null, null]);

    await deleteTeam(srvA, created.id, u2);
    expect(await getTeam(srvA, created.id)).toBeNull();
  });

  it("listTeams est scopé par serveur", async () => {
    const { createTeam, listTeams, deleteTeam } = await import("$lib/server/teams");
    const t = await createTeam(srvA, u1, input());
    expect((await listTeams(srvA)).map((x) => x.id)).toContain(t.id);
    expect((await listTeams(srvB)).map((x) => x.id)).not.toContain(t.id);
    // getTeam scopé : le même id via srvB → null.
    const { getTeam } = await import("$lib/server/teams");
    expect(await getTeam(srvB, t.id)).toBeNull();
    await deleteTeam(srvA, t.id, u1);
  });

  it("update/delete par un non-auteur → 403, y compris l'owner du serveur", async () => {
    const { createTeam, updateTeam, deleteTeam, getTeam } = await import("$lib/server/teams");
    const t = await createTeam(srvA, u2, input()); // auteur = u2 (member) ; u1 = owner
    await expect(updateTeam(srvA, t.id, u1, input())).rejects.toMatchObject({ status: 403 });
    await expect(deleteTeam(srvA, t.id, u1)).rejects.toMatchObject({ status: 403 });
    expect(await getTeam(srvA, t.id)).not.toBeNull();
    await deleteTeam(srvA, t.id, u2);
  });

  it("teamId inconnu → 404", async () => {
    const { updateTeam, deleteTeam } = await import("$lib/server/teams");
    const ghost = randomUUID();
    await expect(updateTeam(srvA, ghost, u1, input())).rejects.toMatchObject({ status: 404 });
    await expect(deleteTeam(srvA, ghost, u1)).rejects.toMatchObject({ status: 404 });
  });
});
```

- [ ] **Step 2: Lancer sur la branche Neon de dev (migrée 0008)**

```bash
TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web exec vitest run src/lib/server/teams.integration.test.ts
```

Attendu : PASS (4 tests). Sans les variables : SKIP.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/server/teams.integration.test.ts
git commit -m "test(web): intégration teams - CRUD, scoping, authz auteur seul"
```

---

### Task 6: i18n + entrée de nav

**Files:**
- Modify: `apps/web/messages/fr.json` ET `apps/web/messages/en.json` (même tâche, mêmes clés)
- Modify: `apps/web/src/routes/s/[slug]/+layout.svelte` (tableau `nav`, ~ligne 13)

**Interfaces:**
- Produces: clés `m.nav_teams`, `m.teams_*` consommées par Tasks 8–9.

- [ ] **Step 1: Ajouter les clés aux DEUX fichiers messages**

`fr.json` (valeurs FR — copie primaire) :

```json
{
  "nav_teams": "Équipes",
  "teams_title": "Équipes",
  "teams_count": "{count} équipes",
  "teams_empty": "Aucune équipe pour l'instant. Compose la première !",
  "teams_new": "Nouvelle équipe",
  "teams_by": "par {name}",
  "teams_updated": "modifiée {date}",
  "teams_name_label": "Nom de l'équipe",
  "teams_name_placeholder": "Boss rush, farm de charbon…",
  "teams_notes_label": "Notes",
  "teams_notes_placeholder": "Stratégie, cibles, ordre des slots…",
  "teams_save": "Enregistrer",
  "teams_saving": "Enregistrement…",
  "teams_saved": "Enregistré",
  "teams_unsaved": "Modifications non enregistrées",
  "teams_save_error": "Échec de l'enregistrement — réessaie.",
  "teams_delete": "Supprimer",
  "teams_delete_confirm": "Supprimer l'équipe « {name} » ?",
  "teams_readonly_hint": "Équipe de {name} — lecture seule",
  "teams_slot_empty": "Slot vide",
  "teams_add_pal": "Ajouter un Pal",
  "teams_change_pal": "Changer de Pal",
  "teams_remove_pal": "Retirer le Pal",
  "teams_partner_skill": "Partner skill",
  "teams_active_skills": "Skills actifs",
  "teams_passive_skills": "Passifs",
  "teams_add_active": "Ajouter un skill",
  "teams_add_passive": "Ajouter un passif",
  "teams_pick_pal": "Choisir un Pal",
  "teams_pick_active": "Choisir un skill actif",
  "teams_pick_passive": "Choisir un passif",
  "teams_picker_placeholder": "Rechercher…",
  "teams_picker_empty": "Aucun résultat",
  "teams_fruits_toggle": "Tous les skills (fruits de compétence)",
  "teams_learnset_empty": "Ce Pal n'a pas de learnset — tous les skills sont proposés.",
  "teams_caught_by_me": "Capturés par moi",
  "teams_level_badge": "Niv. {level}"
}
```

`en.json` (mêmes clés) :

```json
{
  "nav_teams": "Teams",
  "teams_title": "Teams",
  "teams_count": "{count} teams",
  "teams_empty": "No teams yet. Build the first one!",
  "teams_new": "New team",
  "teams_by": "by {name}",
  "teams_updated": "updated {date}",
  "teams_name_label": "Team name",
  "teams_name_placeholder": "Boss rush, coal farm…",
  "teams_notes_label": "Notes",
  "teams_notes_placeholder": "Strategy, targets, slot order…",
  "teams_save": "Save",
  "teams_saving": "Saving…",
  "teams_saved": "Saved",
  "teams_unsaved": "Unsaved changes",
  "teams_save_error": "Save failed — try again.",
  "teams_delete": "Delete",
  "teams_delete_confirm": "Delete team “{name}”?",
  "teams_readonly_hint": "{name}'s team — read-only",
  "teams_slot_empty": "Empty slot",
  "teams_add_pal": "Add a Pal",
  "teams_change_pal": "Change Pal",
  "teams_remove_pal": "Remove Pal",
  "teams_partner_skill": "Partner skill",
  "teams_active_skills": "Active skills",
  "teams_passive_skills": "Passives",
  "teams_add_active": "Add a skill",
  "teams_add_passive": "Add a passive",
  "teams_pick_pal": "Pick a Pal",
  "teams_pick_active": "Pick an active skill",
  "teams_pick_passive": "Pick a passive",
  "teams_picker_placeholder": "Search…",
  "teams_picker_empty": "No results",
  "teams_fruits_toggle": "All skills (skill fruits)",
  "teams_learnset_empty": "This Pal has no learnset — showing all skills.",
  "teams_caught_by_me": "Caught by me",
  "teams_level_badge": "Lv. {level}"
}
```

- [ ] **Step 2: Ajouter l'entrée de nav dans `apps/web/src/routes/s/[slug]/+layout.svelte`**

Dans le tableau `nav`, après `{ href: '/paldex', label: m.nav_paldex },` :

```ts
{ href: '/teams', label: m.nav_teams },
```

- [ ] **Step 3: Vérifier**

```bash
pnpm --filter web check
```

Si des clés « does not exist » : `pnpm --filter web exec paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide` puis relancer. Attendu : 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages "apps/web/src/routes/s/[slug]/+layout.svelte"
git commit -m "feat(web): i18n teams FR/EN + entrée de nav Équipes"
```

---

### Task 7: Session design-lab (point de décision utilisateur)

**Files:**
- Create: sortie du design-lab (emplacement décidé par le skill), résumée dans `docs/superpowers/specs/2026-07-24-team-builder-ui-direction.md`

**Interfaces:**
- Produces: le document de direction UI consommé par Task 9 (styles, hiérarchie, traitements des slots/pickers/barre de sauvegarde).

- [ ] **Step 1: Invoquer le skill `design-lab`** avec en entrée :
  - Anatomie fonctionnelle : page liste (cartes équipe : nom, 5 vignettes `palIcon`, auteur, aperçu notes, date) ; éditeur (champs nom/notes, 5 cartes de slot — identité Pal + ruban partner skill lecture seule + 3 chips skills actifs + 4 chips passifs —, barre de sauvegarde sticky avec état dirty, mode lecture seule) ; picker overlay 3 modes (pal avec grayscale non-capturé + `GroupAvatars` + filtre « capturés par moi » ; actif avec badges niveau + toggle fruits ; passif avec rang).
  - Contraintes : tokens `apps/web/src/app.css`, `.interface-design/system.md` (« expédition nocturne », color-mix, .tnum, flat + borders).
  - Références de craft existant : `PalCard.svelte`, `paldex/+page.svelte` (liste + fiche), `CommandPalette.svelte`.
- [ ] **Step 2: L'utilisateur choisit une des 5 variations** (point de blocage volontaire).
- [ ] **Step 3: Écrire le résumé de direction dans `docs/superpowers/specs/2026-07-24-team-builder-ui-direction.md` et commit**

```bash
git add docs/superpowers/specs/2026-07-24-team-builder-ui-direction.md
git commit -m "docs: direction UI team builder (design-lab)"
```

---

### Task 8: Store éditeur + squelette des routes

**Files:**
- Create: `apps/web/src/lib/game/team-editor.svelte.ts`
- Create: `apps/web/src/routes/s/[slug]/teams/+page.server.ts`
- Create: `apps/web/src/routes/s/[slug]/teams/+page.svelte` (markup minimal, stylé en Task 9)
- Create: `apps/web/src/routes/s/[slug]/teams/new/+page.server.ts`
- Create: `apps/web/src/routes/s/[slug]/teams/new/+page.svelte`
- Create: `apps/web/src/routes/s/[slug]/teams/[teamId]/+page.server.ts`
- Create: `apps/web/src/routes/s/[slug]/teams/[teamId]/+page.svelte`

**Interfaces:**
- Consumes: `listTeams`/`getTeam`/`TeamRow` (Task 4), `getProgress` (`$lib/server/progress`), `requireMembership`, clés i18n (Task 6), `TeamSlot` (`$lib/types`).
- Produces: `TeamEditorStore` consommé par `TeamEditor.svelte` (Task 9) :
  - constructeur `new TeamEditorStore(slug: string, initial: { id: string | null; name: string; notes: string; slots: TeamSlot[] })`
  - champs `$state` : `name: string`, `notes: string`, `slots: TeamSlot[]`, `status: "idle" | "saving" | "saved" | "error"`, `id: string | null`
  - `dirty: boolean` (dérivé), `save(): Promise<string | null>` (retourne l'id — POST si `id === null`, sinon PUT ; met à jour le snapshot)
  - `setSlot(i: number, slot: TeamSlot)`, `clearSlot(i: number)`

Tous les `.svelte`/`.svelte.ts` via l'agent `svelte:svelte-file-editor`.

- [ ] **Step 1: Écrire `apps/web/src/lib/game/team-editor.svelte.ts`**

```ts
import type { TeamSlot } from "$lib/types";

type Snapshot = { name: string; notes: string; slots: TeamSlot[] };

const clone = (s: Snapshot): Snapshot => JSON.parse(JSON.stringify(s));

/** État de l'éditeur d'équipe. Sauvegarde EXPLICITE (pas d'autosave) :
 *  invariants inter-champs + pas d'amplification d'écritures sur les notes. */
export class TeamEditorStore {
  id = $state<string | null>(null);
  name = $state("");
  notes = $state("");
  slots = $state<TeamSlot[]>([null, null, null, null, null]);
  status = $state<"idle" | "saving" | "saved" | "error">("idle");
  #slug: string;
  #saved = $state<Snapshot>({ name: "", notes: "", slots: [] });

  dirty = $derived(
    JSON.stringify({ name: this.name, notes: this.notes, slots: this.slots }) !==
      JSON.stringify(this.#saved),
  );

  constructor(
    slug: string,
    initial: { id: string | null; name: string; notes: string; slots: TeamSlot[] },
  ) {
    this.#slug = slug;
    this.id = initial.id;
    this.name = initial.name;
    this.notes = initial.notes;
    this.slots = padSlots(initial.slots);
    this.#saved = clone({ name: this.name, notes: this.notes, slots: this.slots });
  }

  setSlot(i: number, slot: TeamSlot) {
    this.slots[i] = slot;
  }

  clearSlot(i: number) {
    this.slots[i] = null;
  }

  async save(): Promise<string | null> {
    if (this.status === "saving") return this.id;
    this.status = "saving";
    const body = JSON.stringify({ name: this.name, notes: this.notes, slots: this.slots });
    const url =
      this.id === null
        ? `/api/servers/${this.#slug}/teams`
        : `/api/servers/${this.#slug}/teams/${this.id}`;
    const res = await fetch(url, {
      method: this.id === null ? "POST" : "PUT",
      headers: { "content-type": "application/json" },
      body,
    }).catch(() => null);
    if (!res?.ok) {
      this.status = "error";
      return null;
    }
    const team = await res.json();
    this.id = team.id;
    this.#saved = clone({ name: this.name, notes: this.notes, slots: this.slots });
    this.status = "saved";
    return this.id;
  }
}

export function padSlots(slots: TeamSlot[]): TeamSlot[] {
  const out = slots.slice(0, 5);
  while (out.length < 5) out.push(null);
  return out;
}
```

- [ ] **Step 2: Loads serveur**

`apps/web/src/routes/s/[slug]/teams/+page.server.ts` :

```ts
import { listTeams } from "$lib/server/teams";
import { requireMembership } from "$lib/server/servers";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const { server } = await requireMembership(locals.user, params.slug);
  return { teams: await listTeams(server.id), myUserId: locals.user!.id };
};
```

`apps/web/src/routes/s/[slug]/teams/new/+page.server.ts` :

```ts
import { getProgress } from "$lib/server/progress";
import { requireMembership } from "$lib/server/servers";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const { server } = await requireMembership(locals.user, params.slug);
  return { caught: await getProgress(server.id, "pal_caught", locals.user!.id) };
};
```

`apps/web/src/routes/s/[slug]/teams/[teamId]/+page.server.ts` :

```ts
import { error } from "@sveltejs/kit";
import { getTeam } from "$lib/server/teams";
import { getProgress } from "$lib/server/progress";
import { requireMembership } from "$lib/server/servers";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const { server } = await requireMembership(locals.user, params.slug);
  const team = await getTeam(server.id, params.teamId);
  if (!team) error(404);
  return {
    team,
    caught: await getProgress(server.id, "pal_caught", locals.user!.id),
    myUserId: locals.user!.id,
  };
};
```

- [ ] **Step 3: Pages squelette (markup fonctionnel non stylé)**

`teams/+page.svelte` : titre `m.teams_title()`, compteur `.tnum`, lien `m.teams_new()` vers `appHref('/teams/new')`, `{#each data.teams}` cartes minimales (nom + auteur + lien vers `appHref('/teams/' + t.id)`), bouton `m.teams_delete()` visible si `t.authorId === data.myUserId` (confirm via `m.teams_delete_confirm({ name: t.name })`, `DELETE fetch` puis `invalidateAll()` de `$app/navigation`), état vide `m.teams_empty()`.

`teams/new/+page.svelte` et `teams/[teamId]/+page.svelte` : instancient le store —

```svelte
<script lang="ts">
  import { TeamEditorStore } from '$lib/game/team-editor.svelte';
  import { page } from '$app/state';
  let { data } = $props();
  // new : initial vide ; [teamId] : initial = data.team
  const store = new TeamEditorStore(page.params.slug, {
    id: data.team?.id ?? null,
    name: data.team?.name ?? '',
    notes: data.team?.notes ?? '',
    slots: data.team?.slots ?? []
  });
  const readonly = data.team ? data.team.authorId !== data.myUserId : false;
</script>
```

`new` : après le premier `store.save()` réussi → `goto(appHref('/teams/' + id))`. Les deux pages posent la garde dirty :

```svelte
<svelte:window onbeforeunload={(e) => { if (store.dirty && !readonly) e.preventDefault(); }} />
```

Le rendu détaillé (slots, pickers) arrive en Task 9 — ici, champs nom/notes bindés + bouton save + affichage brut des slots suffisent.

- [ ] **Step 4: Vérifier**

```bash
pnpm --filter web check
```

Attendu : 0 erreur. Lancer `pnpm --filter web dev` et vérifier à la main : /teams liste vide → nouvelle équipe → save → redirection → édition → save → la liste montre l'équipe ; lecture seule pour un autre membre (vérifiable via l'intégration ou une 2e session).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/game/team-editor.svelte.ts "apps/web/src/routes/s/[slug]/teams"
git commit -m "feat(web): store éditeur d'équipe + routes teams (squelette)"
```

---

### Task 9: UI finale selon la direction design-lab

**Files:**
- Create: `apps/web/src/lib/components/teams/TeamEditor.svelte`
- Create: `apps/web/src/lib/components/teams/TeamSlotCard.svelte`
- Create: `apps/web/src/lib/components/teams/TeamPicker.svelte`
- Modify: `apps/web/src/routes/s/[slug]/teams/+page.svelte` (cartes stylées)
- Modify: `apps/web/src/routes/s/[slug]/teams/new/+page.svelte` et `[teamId]/+page.svelte` (monter `TeamEditor`)

**Interfaces:**
- Consumes: `TeamEditorStore` (Task 8), `team-data.ts` (Task 2), `gameName`/`gameDesc` (`$lib/game/names`), `palIcon` (`$lib/game/icons`), `ElementBadge.svelte`, `GroupAvatars.svelte`, i18n (Task 6), **le document de direction UI de Task 7** (`docs/superpowers/specs/2026-07-24-team-builder-ui-direction.md`) qui fixe le traitement visuel exact.
- Produces (contrats de composants) :
  - `TeamEditor.svelte` — props `{ store: TeamEditorStore, readonly: boolean, caught: { mine: string[]; group: Record<string, GroupUser[]> }, authorName?: string }`
  - `TeamSlotCard.svelte` — props `{ slot: TeamSlot, index: number, readonly: boolean, caught: …, onpick: (mode: 'pal'|'active'|'passive', index: number) => void, onclear: (index: number) => void, onremoveid: (kind: 'active'|'passive', index: number, id: string) => void }`
  - `TeamPicker.svelte` — props `{ mode: 'pal'|'active'|'passive', palId: string | null, caught: …, exclude: string[], onselect: (id: string) => void, onclose: () => void }`

Comportements imposés (indépendants du visuel) :
- Picker : overlay fixe + autofocus + navigation clavier (↑↓/Enter/Escape) + lock scroll — cloner les patterns de `CommandPalette.svelte` ; recherche insensible aux accents sur le nom localisé (`gameName`).
- Mode pal : portraits `palIcon`, désaturés si `!caught.mine.includes(id)` (convention Paldex : `caught={store.mine.has(pal.id)}` dans `paldex/+page.svelte:98`) ; `GroupAvatars` avec `caught.group[id]` ; checkbox `m.teams_caught_by_me()` filtrant sur `caught.mine`.
- Mode actif : liste = `learnsetFor(palId)` avec badge `m.teams_level_badge({ level })` + `ElementBadge` (élément depuis `skills.json`) + power `.tnum` ; toggle `m.teams_fruits_toggle()` → tout `ACTIVE_SKILL_IDS` ; toggle auto-ON + hint `m.teams_learnset_empty()` si learnset vide ; `exclude` masque les ids déjà pris.
- Mode passif : tout `PASSIVE_IDS` trié par `gameName('passive:' + id)`, rang affiché (`passiveRank`), description `gameDesc('passive:' + id)`.
- Slot : ruban partner skill = `gameName(partnerSkillNsId(slot.palId))` (lecture seule, pas de description — elle n'existe pas dans le jeu) ; chips retirables (× ) si `!readonly` ; boutons d'ajout masqués à 3 actifs / 4 passifs.
- Barre de sauvegarde sticky : bouton `m.teams_save()` désactivé si `!store.dirty || store.status === 'saving'`, libellés selon `store.status` (`teams_saving`/`teams_saved`/`teams_save_error`), badge `m.teams_unsaved()` si dirty.
- Lecture seule : hint `m.teams_readonly_hint({ name: authorName })`, aucune affordance d'édition rendue (pas seulement disabled).
- Style : tokens/app.css + direction Task 7 exclusivement ; `.tnum` sur niveaux/power/compteurs.

- [ ] **Step 1: Implémenter `TeamPicker.svelte`** (agent svelte-file-editor, autofixer MCP en fin)
- [ ] **Step 2: Implémenter `TeamSlotCard.svelte`** (idem)
- [ ] **Step 3: Implémenter `TeamEditor.svelte`** et monter dans `new/+page.svelte` + `[teamId]/+page.svelte` (remplacer le markup brut de Task 8)
- [ ] **Step 4: Styler la liste `teams/+page.svelte`** selon la direction Task 7
- [ ] **Step 5: Vérifier**

```bash
pnpm --filter web check
pnpm --filter web exec vitest run
```

Attendu : 0 erreur, tous tests PASS. Puis passe manuelle (dev server) : composer une équipe complète (5 Pals, passifs, actifs via learnset ET via fruits), save, recharger, rouvrir ; vérifier partner skill affiché, grayscale/avatars, filtre « capturés par moi », lecture seule.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/components/teams "apps/web/src/routes/s/[slug]/teams"
git commit -m "feat(web): UI team builder (éditeur, slots, picker 3 modes)"
```

---

### Task 10: Passe de vérification finale

**Files:** aucun nouveau (corrections éventuelles).

- [ ] **Step 1: Suite complète + check**

```bash
pnpm --filter web check
TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web test
```

Attendu : 0 erreur, toutes suites PASS (unitaires + intégration).

- [ ] **Step 2: Run-through manuel FR puis EN** (LangSwitch) : créer / modifier / supprimer une équipe ; vérifier en 2e compte (autre membre) : lecture seule, pas de bouton delete, PUT/DELETE direct via fetch → 403.
- [ ] **Step 3: Revue de code** — REQUIRED SUB-SKILL `superpowers:requesting-code-review` sur la branche.
- [ ] **Step 4: Finalisation** — REQUIRED SUB-SKILL `superpowers:finishing-a-development-branch` (PR vers main ; le rollout prod de la migration 0008 = action manuelle de Sephi, additive).
