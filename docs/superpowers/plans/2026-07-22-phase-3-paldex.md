# Phase 3 — Paldex : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Une étape **USER ACTION** (ré-export FModel du dossier Waza) avec repli
> documenté. Avant chaque tâche d'UI, invoquer le skill `interface-design`
> (installé dans le projet) pour le travail visuel. Exécution inline recommandée.

**Goal:** La section Paldex complète : grille filtrable des 286 Pals (éléments, aptitudes, recherche FR/EN), fiche détaillée (stats, drops liés aux items, passifs, skills si disponibles, breeding), et le **tracking "capturé" partagé** — première utilisation de l'API de progression générique que toutes les sections réutiliseront.

**Architecture:** Pipeline enrichi (champs breeding + skills Waza si exportables). Côté web : module serveur `progress.ts` (validation par registre de kinds, agrégation groupe) + endpoints `POST/GET /api/progress` ; store client `progress.svelte.ts` (optimiste + refetch focus + polling 60 s) ; helpers `gameName`/`gameDesc`/`palIcon` ; lib pure `breeding.ts` (règle du CombiRank + combos uniques) testée unitairement. Routes `(app)/paldex` (grille) et `(app)/paldex/[palId]` (fiche).

**Tech Stack:** existant (SvelteKit/Svelte 5, Drizzle/Neon, Paraglide, vitest) — aucune nouvelle dépendance.

## Global Constraints

- Spec + décisions : `docs/superpowers/specs/2026-07-21-palworld-companion-design.md`, `docs/decisions.md`
- `kind` de progression pour cette phase : `pal_caught` ; `entityId` = id de pals.json ; validation serveur obligatoire contre le dataset (jamais de kind/id libre)
- Import additif seulement pour l'API (`checked: true|false` = insert/delete de SA propre ligne ; jamais celle d'un autre)
- Toute chaîne d'UI passe par Paraglide (FR/EN) ; noms du jeu via `gameName()` — jamais en dur
- Icônes : `/icons/pals/<id>.webp`, présence testée via `icons.json` (jamais par 404)
- Breeding : règle documentée du jeu — enfant = pal élevable dont `combiRank` est le plus proche de `floor((rA+rB+1)/2)` (égalité → `combiDuplicatePriority` le plus bas) ; les combos de `breeding.json` priment ; A×A → A
- Pipeline : re-run déterministe, `verify.ts` doit rester vert (ajouts de champs = pas de retrait d'IDs)
- **Report assumé** : la « zone d'apparition » de la fiche Pal (spec) dépend des
  données de spawn liées à la carte — différée à la phase carte (Phase 6), la
  fiche prévoit l'emplacement de section
- Le type `GroupUser` vit dans `apps/web/src/lib/types.ts` (partagé client/serveur —
  ne JAMAIS importer un module `$lib/server/*` depuis du code client, même en type-only)
- Branche : `feature/phase-3-paldex`

---

### Task 1: Pipeline — champs breeding + skills Waza (USER ACTION + repli)

**Files:**
- Modify: `packages/pipeline/src/transform/pals.ts` (champs `ignoreCombi`, `combiPriority`, `partnerSkillNameId`)
- Create: `packages/pipeline/src/transform/skills.ts`
- Modify: `packages/pipeline/src/all.ts`
- Modify: `docs/extraction-runbook.md` + `docs/decisions.md`

**Interfaces:**
- Consumes: exports FModel (dont ré-export Waza), lib pipeline
- Produces: `pals.json` enrichi (`ignoreCombi?: true`, `combiPriority: number`,
  `partnerSkillNameId?: string`, `moves?: [{ skillId, level }]`) ;
  `game-data/skills.json` : `{ [skillId]: { element, power, ct } }` (vide si repli)

- [ ] **Step 1: USER ACTION — ré-exporter le dossier Waza**

Dans FModel : clic droit sur `Pal/Content/Pal/DataTable/Waza` →
*Save Folder's Packages Properties (.json)*. Vérifier ensuite :
```bash
stat -c%s "/mnt/c/PalExports/Exports/Pal/Content/Pal/DataTable/Waza/DT_WazaDataTable_Common.json"
```
Expected: ≥ 50 000 octets. **Si toujours ~500 octets** (struct non mappé) :
repli — consigner dans `docs/decisions.md` que les skills actifs sont différés,
`skills.json` sera `{}` et la fiche n'affichera pas la section Attaques.
Les Steps 2–3 s'adaptent (le transform tolère des Rows vides pour Waza
uniquement).

- [ ] **Step 2: Enrichir pals.ts**

Dans le `.map()` de `packages/pipeline/src/transform/pals.ts`, ajouter après
`maleProbability` :
```ts
    combiPriority: pick<number>(row, "CombiDuplicatePriority") ?? 0,
    ignoreCombi: pick<boolean>(row, "IgnoreCombi") || undefined,
    partnerSkillNameId: (() => {
      const v = pick<string>(row, "OverridePartnerSkillNameTextID");
      return v && v !== "None" ? v : undefined;
    })(),
```

- [ ] **Step 3: Écrire skills.ts (tolérant au repli)**

`packages/pipeline/src/transform/skills.ts` :
```ts
import { enumName, loadDataTableRows, pick, writeGameData } from "../lib.js";

let skills: Record<string, any> = {};
let moveRows: Record<string, any> = {};
try {
  skills = loadDataTableRows(/DT_WazaDataTable(_Common)?\.json$/);
  moveRows = loadDataTableRows(/DT_WazaMasterLevel(_Common)?\.json$/);
} catch {
  console.warn("  Waza indisponible (repli assumé, cf. decisions.md) — skills.json vide");
}

const out: Record<string, { element?: string; power?: number; ct?: number }> = {};
for (const [id, row] of Object.entries(skills)) {
  out[id] = {
    element: enumName(pick(row as any, "Element", "ElementType")),
    power: pick<number>(row as any, "Power"),
    ct: pick<number>(row as any, "CoolTime", "CT"),
  };
}
writeGameData("skills.json", out);

// Moves par pal -> injectés dans pals.json via un fichier d'appoint que
// pals.ts NE lit pas (éviter une dépendance d'ordre) : on écrit palMoves.json.
const movesByPal: Record<string, Array<{ skillId: string; level: number }>> = {};
for (const row of Object.values(moveRows) as any[]) {
  const pal = pick<string>(row, "PalID", "CharacterID");
  const skillId = pick<string>(row, "WazaID", "SkillID");
  const level = pick<number>(row, "Level") ?? 1;
  if (!pal || !skillId) continue;
  (movesByPal[pal] ??= []).push({ skillId, level });
}
for (const list of Object.values(movesByPal)) list.sort((a, b) => a.level - b.level);
writeGameData("pal-moves.json", movesByPal);
console.log(`skills OK (${Object.keys(out).length} skills, ${Object.keys(movesByPal).length} pals avec moves)`);
```
Ajouter `await import("./transform/skills.js");` dans `all.ts` (après pals).
Ajouter le ré-export Waza à la liste d'assets du runbook.

- [ ] **Step 4: Re-run, vérifier, committer**

Run: `pnpm --filter @palworld-companion/pipeline all`
Expected: tous les `OK`, `VERIFY OK` (aucun ID retiré — champs ajoutés
seulement).

```bash
git add packages/pipeline packages/game-data docs/
git commit -m "feat(pipeline): champs breeding + skills Waza (ou repli documenté)"
```

---

### Task 2: Serveur — module progress + endpoints API

**Files:**
- Create: `apps/web/src/lib/types.ts` (`export type GroupUser = { id: string; username: string; avatarUrl: string | null };`)
- Create: `apps/web/src/lib/server/progress.ts`
- Test: `apps/web/src/lib/server/progress.test.ts`
- Create: `apps/web/src/routes/api/progress/+server.ts`

**Interfaces:**
- Consumes: `getDb`, `tables` (Phase 1), `pals.json`
- Produces: `isValidEntity(kind, entityId): boolean` (registre pur, testé) ;
  `setProgress(userId, kind, entityId, checked)` ;
  `getProgress(kind)` → `{ mine: string[], group: Record<entityId, GroupUser[]> }`
  avec `GroupUser = { id, username, avatarUrl }` ;
  API : `POST /api/progress` body `{ kind, entityId, checked }` (204) ;
  `GET /api/progress?kind=pal_caught` (JSON ci-dessus) — consommés par Task 3

- [ ] **Step 1: Test du registre de validation (pur)**

`apps/web/src/lib/server/progress.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { isValidEntity } from "./progress";

describe("registre de progression", () => {
  it("accepte un pal connu pour pal_caught", () => {
    expect(isValidEntity("pal_caught", "Anubis")).toBe(true);
  });
  it("refuse un id inconnu et un kind inconnu", () => {
    expect(isValidEntity("pal_caught", "NotAPal")).toBe(false);
    expect(isValidEntity("tech_unlocked", "Anubis")).toBe(false); // kind pas encore enregistré
    expect(isValidEntity("__proto__", "Anubis")).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier l'échec, puis implémenter**

Run: `pnpm --filter web exec vitest run src/lib/server/progress.test.ts` → FAIL.

`apps/web/src/lib/server/progress.ts` :
```ts
import { and, eq } from "drizzle-orm";
import pals from "@palworld-companion/game-data/pals.json";
import { getDb, tables } from "$lib/server/db";
import type { GroupUser } from "$lib/types";

// Registre des kinds autorisés -> IDs valides. Les phases suivantes ajoutent
// tech_unlocked (tech.json) et marker (markers/*.json) ICI, nulle part ailleurs.
const REGISTRY: Record<string, Set<string>> = {
  pal_caught: new Set((pals as Array<{ id: string }>).map((p) => p.id)),
};

export function isValidEntity(kind: string, entityId: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRY, kind) && REGISTRY[kind].has(entityId);
}

export async function setProgress(userId: string, kind: string, entityId: string, checked: boolean) {
  const db = getDb();
  if (checked) {
    await db
      .insert(tables.progress)
      .values({ userId, kind, entityId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(tables.progress)
      .where(
        and(
          eq(tables.progress.userId, userId),
          eq(tables.progress.kind, kind),
          eq(tables.progress.entityId, entityId),
        ),
      );
  }
}

export function isValidKind(kind: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRY, kind);
}

export async function getProgress(kind: string, myUserId: string) {
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
    .where(eq(tables.progress.kind, kind));
  const mine: string[] = [];
  const group: Record<string, GroupUser[]> = {};
  for (const r of rows) {
    (group[r.entityId] ??= []).push({ id: r.userId, username: r.username, avatarUrl: r.avatarUrl });
    if (r.userId === myUserId) mine.push(r.entityId);
  }
  return { mine, group };
}
```

`apps/web/src/routes/api/progress/+server.ts` :
```ts
import { error, json } from "@sveltejs/kit";
import { getProgress, isValidEntity, setProgress } from "$lib/server/progress";
import type { RequestEvent } from "./$types";

export async function POST(event: RequestEvent) {
  if (!event.locals.user) error(401);
  const body = await event.request.json().catch(() => null);
  const { kind, entityId, checked } = body ?? {};
  if (typeof kind !== "string" || typeof entityId !== "string" || typeof checked !== "boolean")
    error(400, "kind, entityId, checked requis");
  if (!isValidEntity(kind, entityId)) error(400, "entité inconnue");
  await setProgress(event.locals.user.id, kind, entityId, checked);
  return new Response(null, { status: 204 });
}

export async function GET(event: RequestEvent) {
  if (!event.locals.user) error(401);
  const kind = event.url.searchParams.get("kind") ?? "";
  if (!isValidKind(kind)) error(400, "kind inconnu");
  return json(await getProgress(kind, event.locals.user.id));
}
```
(avec `import { getProgress, isValidEntity, isValidKind, setProgress } from "$lib/server/progress";`)

- [ ] **Step 3: Tests + build, commit**

Run: `pnpm --filter web exec vitest run && pnpm --filter web build`
Expected: PASS + build OK.

```bash
git add apps/web/src
git commit -m "feat(web): API de progression générique (registre de kinds, agrégation groupe)"
```

---

### Task 3: Client — helpers game-data + store de progression

**Files:**
- Create: `apps/web/src/lib/game/names.ts`
- Create: `apps/web/src/lib/game/icons.ts`
- Create: `apps/web/src/lib/game/progress.svelte.ts`

**Interfaces:**
- Consumes: Paraglide runtime, `l10n/*.json`, `icons.json`, API Task 2
- Produces: `gameName(nsId): string`, `gameDesc(nsId): string | undefined` ;
  `palIcon(id): string | undefined` ;
  classe `ProgressStore` : `.init(kind, mine, group)`, `.mine: Set<string>`,
  `.group: Record<string, GroupUser[]>`, `.toggle(entityId)` (optimiste),
  `.startSync()` / `.stopSync()` (focus + polling 60 s) — consommés par Tasks 4–5

- [ ] **Step 1: Helpers noms + icônes**

`apps/web/src/lib/game/names.ts` :
```ts
import { getLocale } from "$lib/paraglide/runtime";
import namesFr from "@palworld-companion/game-data/l10n/names.fr.json";
import namesEn from "@palworld-companion/game-data/l10n/names.en.json";
import descFr from "@palworld-companion/game-data/l10n/descriptions.fr.json";
import descEn from "@palworld-companion/game-data/l10n/descriptions.en.json";

const N = { fr: namesFr, en: namesEn } as Record<string, Record<string, string>>;
const D = { fr: descFr, en: descEn } as Record<string, Record<string, string>>;

/** nsId ex. "pal:Anubis", "item:Wood". Repli : EN puis l'id brut. */
export function gameName(nsId: string): string {
  const loc = getLocale();
  return N[loc]?.[nsId] ?? N.en[nsId] ?? nsId.split(":").pop()!;
}

export function gameDesc(nsId: string): string | undefined {
  const loc = getLocale();
  return D[loc]?.[nsId] ?? D.en[nsId];
}
```

`apps/web/src/lib/game/icons.ts` :
```ts
import icons from "@palworld-companion/game-data/icons.json";

const present = icons as Record<string, boolean>;

export function palIcon(id: string): string | undefined {
  return present[`pal:${id}`] ? `/icons/pals/${id}.webp` : undefined;
}

export function itemIcon(id: string): string | undefined {
  return present[`item:${id}`] ? `/icons/items/${id}.webp` : undefined;
}
```

- [ ] **Step 2: Store de progression (runes)**

`apps/web/src/lib/game/progress.svelte.ts` :
```ts
import type { GroupUser } from "$lib/types";

export class ProgressStore {
  kind = "";
  mine = $state(new Set<string>());
  group = $state<Record<string, GroupUser[]>>({});
  #timer: ReturnType<typeof setInterval> | undefined;
  #onVisible = () => {
    if (document.visibilityState === "visible") this.refetch();
  };

  init(kind: string, mine: string[], group: Record<string, GroupUser[]>) {
    this.kind = kind;
    this.mine = new Set(mine);
    this.group = group;
  }

  async toggle(entityId: string) {
    const next = new Set(this.mine);
    const checked = !next.has(entityId);
    if (checked) next.add(entityId);
    else next.delete(entityId);
    this.mine = next; // optimiste
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: this.kind, entityId, checked }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const rollback = new Set(this.mine);
      if (checked) rollback.delete(entityId);
      else rollback.add(entityId);
      this.mine = rollback;
    } else {
      this.refetch(); // rafraîchit les avatars du groupe
    }
  }

  async refetch() {
    const res = await fetch(`/api/progress?kind=${this.kind}`).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    this.mine = new Set(data.mine);
    this.group = data.group;
  }

  startSync() {
    document.addEventListener("visibilitychange", this.#onVisible);
    this.#timer = setInterval(() => {
      if (document.visibilityState === "visible") this.refetch();
    }, 60_000);
  }

  stopSync() {
    document.removeEventListener("visibilitychange", this.#onVisible);
    clearInterval(this.#timer);
  }
}
```

- [ ] **Step 3: Build + commit**

Run: `pnpm --filter web build && pnpm --filter web check`
Expected: 0 erreur.

```bash
git add apps/web/src/lib/game
git commit -m "feat(web): helpers game-data (noms, icônes) + store de progression optimiste"
```

---

### Task 4: Lib breeding pure (TDD)

**Files:**
- Create: `apps/web/src/lib/game/breeding.ts`
- Test: `apps/web/src/lib/game/breeding.test.ts`

**Interfaces:**
- Consumes: `pals.json` (combiRank, combiPriority, ignoreCombi), `breeding.json`
- Produces: `childOf(parentAId, parentBId): string` ;
  `parentsOf(childId): Array<[string, string]>` (paires triées, bornées) ;
  consommés par la fiche (Task 6)

- [ ] **Step 1: Tests d'abord**

`apps/web/src/lib/game/breeding.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import breeding from "@palworld-companion/game-data/breeding.json";
import { childOf, parentsOf } from "./breeding";

describe("breeding", () => {
  it("A×A donne toujours A", () => {
    expect(childOf("Anubis", "Anubis")).toBe("Anubis");
  });
  it("respecte les combos uniques du jeu", () => {
    const combo = (breeding as any).uniqueCombos[0];
    expect(childOf(combo.parentA, combo.parentB)).toBe(combo.child);
    expect(childOf(combo.parentB, combo.parentA)).toBe(combo.child); // symétrique
  });
  it("parentsOf retrouve des paires cohérentes", () => {
    const pairs = parentsOf("Anubis");
    expect(pairs.length).toBeGreaterThan(0);
    for (const [a, b] of pairs.slice(0, 10)) expect(childOf(a, b)).toBe("Anubis");
  });
});
```

- [ ] **Step 2: FAIL attendu, puis implémentation**

`apps/web/src/lib/game/breeding.ts` :
```ts
import palsJson from "@palworld-companion/game-data/pals.json";
import breedingJson from "@palworld-companion/game-data/breeding.json";

type Pal = { id: string; combiRank: number; combiPriority: number; ignoreCombi?: boolean };
const pals = palsJson as Pal[];
const byId = new Map(pals.map((p) => [p.id, p]));

// Pals éligibles comme enfant (règle du jeu : IgnoreCombi exclut).
const breedable = pals.filter((p) => !p.ignoreCombi);

const uniques = new Map<string, string>();
for (const c of (breedingJson as any).uniqueCombos as Array<{ parentA: string; parentB: string; child: string }>) {
  uniques.set([c.parentA, c.parentB].sort().join("|"), c.child);
}
const uniqueChildren = new Set(uniques.values());

/** Enfant = combo unique, sinon pal élevable au combiRank le plus proche de
 *  floor((rA+rB+1)/2) (égalité -> combiPriority le plus bas). A×A -> A. */
export function childOf(aId: string, bId: string): string {
  if (aId === bId) return aId;
  const unique = uniques.get([aId, bId].sort().join("|"));
  if (unique) return unique;
  const a = byId.get(aId), b = byId.get(bId);
  if (!a || !b) throw new Error(`Pal inconnu : ${aId} / ${bId}`);
  const target = Math.floor((a.combiRank + b.combiRank + 1) / 2);
  let best: Pal | null = null;
  for (const p of breedable) {
    if (uniqueChildren.has(p.id)) continue; // atteignables uniquement via combo unique
    if (
      !best ||
      Math.abs(p.combiRank - target) < Math.abs(best.combiRank - target) ||
      (Math.abs(p.combiRank - target) === Math.abs(best.combiRank - target) &&
        p.combiPriority < best.combiPriority)
    )
      best = p;
  }
  return best!.id;
}

/** Paires de parents produisant childId (échantillon représentatif, borné). */
export function parentsOf(childId: string, limit = 50): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, child] of uniques) if (child === childId) out.push(key.split("|") as [string, string]);
  outer: for (let i = 0; i < pals.length; i++) {
    for (let j = i; j < pals.length; j++) {
      if (out.length >= limit) break outer;
      const a = pals[i].id, b = pals[j].id;
      if (childOf(a, b) === childId) out.push([a, b]);
    }
  }
  return out.slice(0, limit);
}
```

- [ ] **Step 3: Tests verts + commit**

Run: `pnpm --filter web exec vitest run src/lib/game/breeding.test.ts`
Expected: 3 passed. (`parentsOf` sur 286² paires ~ vite en Node ; si > 200 ms,
mémoïser `childOf` — ne pas optimiser sans mesure.)

```bash
git add apps/web/src/lib/game
git commit -m "feat(web): lib breeding pure (règle CombiRank + combos uniques) testée"
```

---

### Task 5: Grille Paldex (UI — invoquer interface-design d'abord)

**Files:**
- Create: `apps/web/src/routes/(app)/paldex/+page.server.ts`
- Create: `apps/web/src/routes/(app)/paldex/+page.svelte`
- Create: `apps/web/src/lib/components/PalCard.svelte`
- Create: `apps/web/src/lib/components/ElementBadge.svelte`
- Modify: `apps/web/messages/fr.json` + `en.json` (messages paldex_*)

**Interfaces:**
- Consumes: `pals.json`, helpers Task 3, `ProgressStore`, API Task 2
- Produces: `/paldex` — grille responsive de cartes (icône, n° Paldex, nom,
  éléments, badge capturé + compteur groupe), filtres (élément, aptitude,
  texte FR/EN, masquer capturés), compteurs "X/286 (moi) · Y/286 (groupe)"

- [ ] **Step 1: Invoquer le skill interface-design**, puis messages

Ajouter à `messages/fr.json` (mêmes clés en EN, traduites) :
```json
  "paldex_title": "Paldex",
  "paldex_search": "Rechercher un Pal…",
  "paldex_filter_element": "Élément",
  "paldex_filter_work": "Aptitude",
  "paldex_hide_caught": "Masquer les capturés",
  "paldex_caught_me": "{count}/{total} capturés",
  "paldex_caught_group": "{count}/{total} par le groupe",
  "paldex_caught_by": "Capturé par"
```

- [ ] **Step 2: Chargement serveur**

`apps/web/src/routes/(app)/paldex/+page.server.ts` :
```ts
import { getProgress } from "$lib/server/progress";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals }: PageServerLoadEvent) {
  return { progress: await getProgress("pal_caught", locals.user!.id) };
}
```
(Les pals eux-mêmes sont importés statiquement côté composant — pas besoin de
les faire transiter par le load.)

- [ ] **Step 3: Composants + page**

`apps/web/src/lib/components/ElementBadge.svelte` :
```svelte
<script lang="ts">
	let { element }: { element: string } = $props();
</script>

<span class="element element-{element.toLowerCase()}">{element}</span>

<style>
	.element {
		font-size: 0.7rem;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: var(--element-bg, #8884);
	}
	.element-fire { --element-bg: #f4433666; }
	.element-water { --element-bg: #2196f366; }
	.element-leaf { --element-bg: #4caf5066; }
	.element-electricity { --element-bg: #ffc10766; }
	.element-ice { --element-bg: #80deea66; }
	.element-earth { --element-bg: #79554866; }
	.element-dark { --element-bg: #67318766; }
	.element-dragon { --element-bg: #3f51b566; }
	.element-normal { --element-bg: #9e9e9e66; }
</style>
```

`apps/web/src/lib/components/PalCard.svelte` :
```svelte
<script lang="ts">
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import ElementBadge from './ElementBadge.svelte';

	let {
		pal,
		caught,
		groupCount,
		ontoggle
	}: {
		pal: { id: string; zukanIndex: number; zukanSuffix?: string; elements: string[] };
		caught: boolean;
		groupCount: number;
		ontoggle: () => void;
	} = $props();
</script>

<div class="card" class:caught>
	<a href="/paldex/{pal.id}">
		{#if palIcon(pal.id)}<img src={palIcon(pal.id)} alt="" loading="lazy" width="64" height="64" />{/if}
		<span class="num">#{pal.zukanIndex}{pal.zukanSuffix ?? ''}</span>
		<span class="name">{gameName(`pal:${pal.id}`)}</span>
		<span class="elements">
			{#each pal.elements as e (e)}<ElementBadge element={e} />{/each}
		</span>
	</a>
	<button class="catch" class:on={caught} onclick={ontoggle} aria-pressed={caught}>
		●{#if groupCount > 0}<small>{groupCount}</small>{/if}
	</button>
</div>
```

`apps/web/src/routes/(app)/paldex/+page.svelte` :
```svelte
<script lang="ts">
	import pals from '@palworld-companion/game-data/pals.json';
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { ProgressStore } from '$lib/game/progress.svelte';
	import PalCard from '$lib/components/PalCard.svelte';

	let { data } = $props();

	const ELEMENTS = [...new Set(pals.flatMap((p) => p.elements))].sort();
	const WORKS = [...new Set(pals.flatMap((p) => Object.keys(p.work)))].sort();

	const store = new ProgressStore();
	store.init('pal_caught', data.progress.mine, data.progress.group);
	$effect(() => {
		store.startSync();
		return () => store.stopSync();
	});

	let search = $state('');
	let element = $state('');
	let work = $state('');
	let hideCaught = $state(false);

	const visible = $derived(
		pals.filter((p) => {
			if (element && !p.elements.includes(element)) return false;
			if (work && !(work in p.work)) return false;
			if (hideCaught && store.mine.has(p.id)) return false;
			if (search) {
				const q = search.toLowerCase();
				if (!gameName(`pal:${p.id}`).toLowerCase().includes(q) && !p.id.toLowerCase().includes(q))
					return false;
			}
			return true;
		})
	);
	const groupCaught = $derived(Object.keys(store.group).length);
</script>

<h1>{m.paldex_title()}</h1>
<p>
	{m.paldex_caught_me({ count: store.mine.size, total: pals.length })} ·
	{m.paldex_caught_group({ count: groupCaught, total: pals.length })}
</p>
<div class="filters">
	<input type="search" placeholder={m.paldex_search()} bind:value={search} />
	<select bind:value={element}>
		<option value="">{m.paldex_filter_element()}</option>
		{#each ELEMENTS as e (e)}<option value={e}>{e}</option>{/each}
	</select>
	<select bind:value={work}>
		<option value="">{m.paldex_filter_work()}</option>
		{#each WORKS as w (w)}<option value={w}>{w}</option>{/each}
	</select>
	<label><input type="checkbox" bind:checked={hideCaught} /> {m.paldex_hide_caught()}</label>
</div>
<div class="grid">
	{#each visible as pal (pal.id)}
		<PalCard
			{pal}
			caught={store.mine.has(pal.id)}
			groupCount={store.group[pal.id]?.length ?? 0}
			ontoggle={() => store.toggle(pal.id)}
		/>
	{/each}
</div>
```
Le stylage précis (grid responsive, états hover/caught) est fait en suivant le
skill `interface-design` — pas de CSS improvisé.

- [ ] **Step 4: Vérification manuelle + commit**

Run: `pnpm --filter web dev` → `/paldex` : grille visible, filtres opérants,
clic sur ● coche/décoche instantanément (et survit à un rechargement).

```bash
git add apps/web
git commit -m "feat(web): grille Paldex filtrable avec tracking capturé partagé"
```

---

### Task 6: Fiche Pal + breeding + avatars du groupe

**Files:**
- Create: `apps/web/src/routes/(app)/paldex/[palId]/+page.server.ts`
- Create: `apps/web/src/routes/(app)/paldex/[palId]/+page.svelte`
- Create: `apps/web/src/lib/components/GroupAvatars.svelte`
- Modify: `apps/web/messages/*.json` (messages pal_*)

**Interfaces:**
- Consumes: `pals.json`, `skills.json`, `pal-moves.json`, breeding lib (Task 4),
  helpers Task 3, `ProgressStore`
- Produces: `/paldex/[palId]` — stats, éléments, aptitudes, passifs, drops
  (liens `/items/<id>` — page Phase 4, lien déjà correct), attaques (si données),
  breeding (sélecteur de partenaire → enfant ; paires de parents), bouton
  capturé + `GroupAvatars` (avatars Discord, grisés si non capturé)

- [ ] **Step 1: Messages + load**

Messages FR (EN homologues) :
```json
  "pal_stats": "Statistiques",
  "pal_work": "Aptitudes de travail",
  "pal_drops": "Butin",
  "pal_passives": "Talents passifs",
  "pal_moves": "Attaques",
  "pal_breeding": "Reproduction",
  "pal_breeding_partner": "Partenaire…",
  "pal_breeding_child": "Enfant",
  "pal_breeding_parents": "Paires de parents possibles",
  "pal_not_found": "Pal introuvable"
```

`+page.server.ts` :
```ts
import { error } from "@sveltejs/kit";
import pals from "@palworld-companion/game-data/pals.json";
import { getProgress } from "$lib/server/progress";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals, params }: PageServerLoadEvent) {
  if (!(pals as Array<{ id: string }>).some((p) => p.id === params.palId)) error(404);
  return { palId: params.palId, progress: await getProgress("pal_caught", locals.user!.id) };
}
```

- [ ] **Step 2: GroupAvatars**

`apps/web/src/lib/components/GroupAvatars.svelte` :
```svelte
<script lang="ts">
	import type { GroupUser } from '$lib/types';
	let { users }: { users: GroupUser[] } = $props();
</script>

{#each users as u (u.id)}
	<img src={u.avatarUrl} alt={u.username} title={u.username} width="28" height="28" class="avatar" />
{/each}

<style>
	.avatar { border-radius: 50%; }
</style>
```

- [ ] **Step 3: Fiche**

`+page.svelte` (structure — sections conditionnelles si données absentes) :
```svelte
<script lang="ts">
	import pals from '@palworld-companion/game-data/pals.json';
	import skills from '@palworld-companion/game-data/skills.json';
	import moves from '@palworld-companion/game-data/pal-moves.json';
	import { m } from '$lib/paraglide/messages';
	import { gameName, gameDesc } from '$lib/game/names';
	import { palIcon, itemIcon } from '$lib/game/icons';
	import { childOf, parentsOf } from '$lib/game/breeding';
	import { ProgressStore } from '$lib/game/progress.svelte';
	import ElementBadge from '$lib/components/ElementBadge.svelte';
	import GroupAvatars from '$lib/components/GroupAvatars.svelte';

	let { data } = $props();
	const pal = $derived(pals.find((p) => p.id === data.palId)!);
	const palMoves = $derived((moves as Record<string, any[]>)[data.palId] ?? []);
	const pairs = $derived(parentsOf(data.palId, 30));

	const store = new ProgressStore();
	store.init('pal_caught', data.progress.mine, data.progress.group);
	$effect(() => {
		store.startSync();
		return () => store.stopSync();
	});

	let partner = $state('');
	const child = $derived(partner ? childOf(pal.id, partner) : null);
</script>

<a href="/paldex">← {m.paldex_title()}</a>
<header>
	{#if palIcon(pal.id)}<img src={palIcon(pal.id)} alt="" width="96" height="96" />{/if}
	<h1>#{pal.zukanIndex}{pal.zukanSuffix ?? ''} {gameName(`pal:${pal.id}`)}</h1>
	{#each pal.elements as e (e)}<ElementBadge element={e} />{/each}
	<button onclick={() => store.toggle(pal.id)} aria-pressed={store.mine.has(pal.id)}>
		{store.mine.has(pal.id) ? '✔' : '○'}
	</button>
	<GroupAvatars users={store.group[pal.id] ?? []} />
</header>
{#if gameDesc(`pal:${pal.id}`)}<p>{gameDesc(`pal:${pal.id}`)}</p>{/if}

<section><h2>{m.pal_stats()}</h2>
	<dl>
		{#each Object.entries(pal.stats) as [k, v] (k)}<dt>{k}</dt><dd>{v}</dd>{/each}
	</dl>
</section>
<section><h2>{m.pal_work()}</h2>
	{#each Object.entries(pal.work) as [w, lvl] (w)}<span>{w} ×{lvl}</span>{/each}
</section>
<section><h2>{m.pal_drops()}</h2>
	<ul>
		{#each pal.drops as d (d.itemId)}
			<li>
				<a href="/items/{d.itemId}">
					{#if itemIcon(d.itemId)}<img src={itemIcon(d.itemId)} alt="" width="24" height="24" />{/if}
					{gameName(`item:${d.itemId}`)}
				</a>
				×{d.min}–{d.max} ({d.rate}%)
			</li>
		{/each}
	</ul>
</section>
{#if pal.passives.length}
	<section><h2>{m.pal_passives()}</h2>
		{#each pal.passives as p (p)}<span>{gameName(`passive:${p}`)}</span>{/each}
	</section>
{/if}
{#if palMoves.length}
	<section><h2>{m.pal_moves()}</h2>
		<ul>
			{#each palMoves as mv (mv.skillId)}
				<li>Niv. {mv.level} — {gameName(`skill:${mv.skillId}`)}
					{#if (skills as any)[mv.skillId]?.power}({(skills as any)[mv.skillId].power}){/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
<section><h2>{m.pal_breeding()}</h2>
	<label>{m.pal_breeding_partner()}
		<select bind:value={partner}>
			<option value=""></option>
			{#each pals as p (p.id)}<option value={p.id}>{gameName(`pal:${p.id}`)}</option>{/each}
		</select>
	</label>
	{#if child}<p>{m.pal_breeding_child()} : <a href="/paldex/{child}">{gameName(`pal:${child}`)}</a></p>{/if}
	{#if pairs.length}
		<h3>{m.pal_breeding_parents()}</h3>
		<ul>
			{#each pairs as [a, b] (a + b)}
				<li><a href="/paldex/{a}">{gameName(`pal:${a}`)}</a> × <a href="/paldex/{b}">{gameName(`pal:${b}`)}</a></li>
			{/each}
		</ul>
	{/if}
</section>
```

- [ ] **Step 4: Vérification + commit**

Run: dev → `/paldex/Anubis` : toutes les sections rendues, toggle + avatars OK,
sélecteur de partenaire calcule un enfant, liens croisés fonctionnels.
`pnpm --filter web exec vitest run && pnpm --filter web build && pnpm --filter web check` → verts.

```bash
git add apps/web
git commit -m "feat(web): fiche Pal complète (stats, drops, skills, breeding, groupe)"
```

---

### Task 7: Déploiement + vérification de sortie de phase

**Files:** aucun nouveau (déploiement + tests manuels)

**Interfaces:**
- Consumes: tout ce qui précède
- Produces: Paldex en production, critère de sortie spec Phase 3 :
  « test à 2 comptes, A coche → B voit »

- [ ] **Step 1: Suite complète**

Run: `pnpm --filter web exec vitest run && pnpm --filter @palworld-companion/pipeline exec vitest run && pnpm --filter web build`
Expected: tout vert.

- [ ] **Step 2: Déployer**

```bash
vercel deploy --yes
```

- [ ] **Step 3: Vérification à deux comptes (USER ACTION)**

Sur l'URL de prod : compte A coche 3 Pals → compte B (autre navigateur/joueur
allowlisté) voit les avatars de A sur ces Pals dans les 60 s (ou au focus).
Basculer FR/EN : noms de Pals traduits. Mobile : grille utilisable au pouce.

- [ ] **Step 4: Commit final éventuel + clôture**

Corrections mineures issues de la vérification, puis passer au skill
finishing-a-development-branch.
