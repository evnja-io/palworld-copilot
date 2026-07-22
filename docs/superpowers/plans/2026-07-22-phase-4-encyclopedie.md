# Phase 4 — Items, Craft, Technologies, Constructions : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Aucune USER ACTION (les données sont déjà extraites). Suivre le design system
> existant (`app.css`, direction « expédition nocturne ») — invoquer
> `interface-design` seulement si un nouveau pattern visuel est nécessaire.

**Goal:** Les quatre sections restantes de l'encyclopédie — Items, Craft, Technologies (avec tracking partagé « débloqué »), Constructions — reliées entre elles et au Paldex par des liens croisés, plus la **recherche globale** dans le header ; critère de sortie : « comment crafter X » trouvable en moins de 10 s.

**Architecture:** Une lib pure d'**index inversés** (`indexes.ts`, testée) calcule une fois : recettes par produit, recettes par matériau, Pals qui droppent un item, techno qui débloque une recette/construction. Les pages la consomment. Le kind `tech_unlocked` s'ajoute au registre de progression existant (une ligne + un toggle UI). Recherche globale = `search-index.json` filtré côté client dans un composant du topbar.

**Tech Stack:** existant, aucune nouvelle dépendance.

## Global Constraints

- Spec + décisions ; design system : tokens de `app.css`, densité et patterns des composants Paldex (cartes `surface-1` + bordure, badges, `tnum`)
- Progression : `tech_unlocked` (entityId = id de tech.json) via le MÊME registre (`REGISTRY` dans `progress.ts`) et le même `ProgressStore`
- Routes : `/items`, `/items/[itemId]`, `/craft`, `/tech`, `/buildings`, `/buildings/[buildingId]` — toutes sous `(app)`
- **Report assumé** : l'attribution recette→station de craft n'est pas extractible proprement (les tables candidates ne couvrent que la production automatique) ; la section Craft groupe par **niveau de technologie**. Consigné dans decisions.md.
- Liens croisés obligatoires : item ↔ recettes (produit/ingrédient) ↔ techno ↔ construction ↔ Pals (drops) — jamais de texte mort quand une page cible existe
- i18n Paraglide pour l'UI, `gameName`/`gameDesc` pour le jeu ; FR ET EN à chaque ajout de message
- Branche : `feature/phase-4-encyclopedie`

---

### Task 1: Lib d'index inversés (TDD)

**Files:**
- Create: `apps/web/src/lib/game/indexes.ts`
- Test: `apps/web/src/lib/game/indexes.test.ts`
- Modify: `docs/decisions.md` (report stations)

**Interfaces:**
- Consumes: `recipes.json`, `pals.json`, `tech.json`, `buildings.json`
- Produces: `recipesByProduct: Map<string, Recipe[]>`,
  `recipesUsingItem: Map<string, Recipe[]>`, `palsDropping: Map<string, string[]>`,
  `techUnlocking: Map<string, Tech>` (clé = id de recette OU de construction),
  `buildingByMapObjectId: Map<string, Building>` — consommés par Tasks 3–6

- [ ] **Step 1: Tests d'abord**

`apps/web/src/lib/game/indexes.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import {
  palsDropping,
  recipesByProduct,
  recipesUsingItem,
  techUnlocking,
} from "./indexes";

describe("index inversés", () => {
  it("retrouve les recettes produisant un item courant", () => {
    const r = recipesByProduct.get("PalSphere");
    expect(r?.length).toBeGreaterThan(0);
    expect(r![0].productId).toBe("PalSphere");
  });
  it("retrouve les recettes consommant le bois", () => {
    expect(recipesUsingItem.get("Wood")?.length).toBeGreaterThan(5);
  });
  it("retrouve les Pals droppant du bois", () => {
    expect(palsDropping.get("Wood")?.length).toBeGreaterThan(0);
  });
  it("retrouve la techno débloquant une recette", () => {
    const anyTech = techUnlocking.size;
    expect(anyTech).toBeGreaterThan(300);
  });
});
```

- [ ] **Step 2: FAIL, puis implémentation**

`apps/web/src/lib/game/indexes.ts` :
```ts
import recipesJson from "@palworld-companion/game-data/recipes.json";
import palsJson from "@palworld-companion/game-data/pals.json";
import techJson from "@palworld-companion/game-data/tech.json";
import buildingsJson from "@palworld-companion/game-data/buildings.json";

export type Recipe = {
  id: string;
  productId: string;
  count: number;
  workAmount: number;
  materials: Array<{ id: string; count: number }>;
};
export type Tech = {
  id: string;
  nameId: string;
  level: number;
  cost: number;
  isBoss: boolean;
  requireBoss?: string;
  unlocks: string[];
};
export type Building = {
  id: string;
  mapObjectId: string;
  category?: string;
  rank: number;
  workAmount: number;
  energyType?: string;
  materials: Array<{ id: string; count: number }>;
};

export const recipes = recipesJson as Recipe[];
export const tech = techJson as Tech[];
export const buildings = buildingsJson as Building[];

export const recipesByProduct = new Map<string, Recipe[]>();
export const recipesUsingItem = new Map<string, Recipe[]>();
for (const r of recipes) {
  (recipesByProduct.get(r.productId) ?? recipesByProduct.set(r.productId, []).get(r.productId)!).push(r);
  for (const mat of r.materials) {
    (recipesUsingItem.get(mat.id) ?? recipesUsingItem.set(mat.id, []).get(mat.id)!).push(r);
  }
}

export const palsDropping = new Map<string, string[]>();
for (const p of palsJson as Array<{ id: string; drops: Array<{ itemId: string }> }>) {
  for (const d of p.drops) {
    (palsDropping.get(d.itemId) ?? palsDropping.set(d.itemId, []).get(d.itemId)!).push(p.id);
  }
}

/** Techno débloquant une recette ou une construction (clé = id débloqué). */
export const techUnlocking = new Map<string, Tech>();
for (const t of tech) for (const u of t.unlocks) techUnlocking.set(u, t);

export const buildingByMapObjectId = new Map(buildings.map((b) => [b.mapObjectId, b]));
```

Run: `pnpm --filter web exec vitest run src/lib/game/indexes.test.ts` → 4 passed.

- [ ] **Step 3: Consigner le report stations + commit**

Ajouter à `docs/decisions.md` :
```markdown
## 2026-07-22 — Stations de craft : report

**Constat** : `DT_MapObjectItemProductDataTable` ne couvre que la production
automatique (16 lignes) ; l'attribution recette→station vit dans les
blueprints des stations, non extractible proprement.
**Décision** : la section Craft groupe par niveau de technologie. Station
ajoutable plus tard si une source fiable émerge.
```

```bash
git add apps/web/src/lib/game docs/decisions.md
git commit -m "feat(web): index inversés du craft (produit, matériau, drops, technos)"
```

---

### Task 2: Kind tech_unlocked dans le registre

**Files:**
- Modify: `apps/web/src/lib/server/progress.ts` (une entrée REGISTRY)
- Modify: `apps/web/src/lib/server/progress.test.ts`

**Interfaces:**
- Consumes: `tech.json`
- Produces: `isValidEntity("tech_unlocked", <techId>)` vrai — utilisé par la
  page Technologies (Task 5) via l'API existante, sans autre changement serveur

- [ ] **Step 1: Test (rouge)**

Dans `progress.test.ts`, remplacer le test du kind inconnu et ajouter :
```ts
  it("accepte une techno connue pour tech_unlocked", () => {
    expect(isValidEntity("tech_unlocked", "Workbench")).toBe(true);
    expect(isValidEntity("tech_unlocked", "NotATech")).toBe(false);
  });
```
(supprimer l'assertion devenue fausse `isValidEntity("tech_unlocked", "Anubis") === false`
au profit de celle-ci.)

- [ ] **Step 2: Implémentation (une ligne de registre)**

Dans `progress.ts` :
```ts
import tech from "@palworld-companion/game-data/tech.json";
```
et dans `REGISTRY` :
```ts
  tech_unlocked: new Set((tech as Array<{ id: string }>).map((t) => t.id)),
```

Run: `pnpm --filter web exec vitest run src/lib/server` → PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/server
git commit -m "feat(web): kind tech_unlocked dans le registre de progression"
```

---

### Task 3: Items — liste + fiche

**Files:**
- Create: `apps/web/src/routes/(app)/items/+page.svelte`
- Create: `apps/web/src/routes/(app)/items/[itemId]/+page.server.ts`
- Create: `apps/web/src/routes/(app)/items/[itemId]/+page.svelte`
- Create: `apps/web/src/lib/components/RecipeCard.svelte`
- Modify: `apps/web/messages/*.json`

**Interfaces:**
- Consumes: `items.json`, index (Task 1), `gameName`/`itemIcon`
- Produces: `/items` (liste filtrable par catégorie typeA + recherche),
  `/items/[itemId]` (description, comment l'obtenir : recette + Pals qui le
  droppent, « entre dans » : recettes qui le consomment) ;
  `RecipeCard` (produit, ingrédients liés, techno requise) réutilisé par /craft

- [ ] **Step 1: Messages**

FR (EN homologue) :
```json
  "items_title": "Objets",
  "items_search": "Rechercher un objet…",
  "items_filter_cat": "Catégorie",
  "item_obtain": "Comment l'obtenir",
  "item_craft_recipe": "Recette",
  "item_dropped_by": "Droppé par",
  "item_used_in": "Entre dans",
  "item_tech_required": "Technologie requise",
  "item_no_source": "Aucune source connue"
```

- [ ] **Step 2: RecipeCard**

`apps/web/src/lib/components/RecipeCard.svelte` :
```svelte
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { itemIcon } from '$lib/game/icons';
	import { techUnlocking, type Recipe } from '$lib/game/indexes';

	let { recipe }: { recipe: Recipe } = $props();
	const tech = $derived(techUnlocking.get(recipe.id));
</script>

<div class="recipe">
	<a class="product" href="/items/{recipe.productId}">
		{#if itemIcon(recipe.productId)}<img src={itemIcon(recipe.productId)} alt="" width="26" height="26" />{/if}
		{gameName(`item:${recipe.productId}`)}
		{#if recipe.count > 1}<span class="tnum count">×{recipe.count}</span>{/if}
	</a>
	<ul class="mats">
		{#each recipe.materials as mat (mat.id)}
			<li>
				<a href="/items/{mat.id}">
					{#if itemIcon(mat.id)}<img src={itemIcon(mat.id)} alt="" width="18" height="18" />{/if}
					{gameName(`item:${mat.id}`)}
				</a>
				<span class="tnum">×{mat.count}</span>
			</li>
		{/each}
	</ul>
	{#if tech}
		<a class="tech" href="/tech#{tech.id}">
			{m.item_tech_required()} : {gameName(`tech:${tech.nameId}`)} · Niv. {tech.level}
		</a>
	{/if}
</div>

<style>
	.recipe {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 10px 12px;
	}
	.product {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 500;
		color: var(--text-1);
	}
	.count {
		color: var(--text-3);
	}
	.mats {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
	}
	.mats li {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
	}
	.mats a {
		display: flex;
		align-items: center;
		gap: 5px;
		color: var(--text-2);
	}
	.tech {
		display: block;
		margin-top: 8px;
		font-size: 12px;
		color: var(--accent);
	}
</style>
```

- [ ] **Step 3: Liste + fiche**

`/items/+page.svelte` — même squelette que la grille Paldex (recherche +
select catégorie sur `typeA`, grille de cartes compactes icône+nom+rareté,
lien vers la fiche). `/items/[itemId]/+page.server.ts` — 404 si id inconnu
(même motif que la fiche Pal, sans progression). `/items/[itemId]/+page.svelte` :
en-tête (icône, nom, description, catégorie), section `item_obtain` :
`RecipeCard` pour chaque recette de `recipesByProduct`, liste `item_dropped_by`
avec liens `/paldex/<id>` (via `palsDropping`), sinon `item_no_source` ;
section `item_used_in` : liens vers les produits des recettes de
`recipesUsingItem` (borner l'affichage à 40 avec compteur du reste).

- [ ] **Step 4: Vérification + commit**

Run: check + build + navigation manuelle `/items` → fiche Wood → "Entre dans"
→ une recette → fiche du produit. Aller-retour Paldex : depuis une fiche Pal,
cliquer un drop → fiche item → "Droppé par" pointe en retour.

```bash
git add apps/web
git commit -m "feat(web): section Objets (liste, fiche, sources et usages croisés)"
```

---

### Task 4: Craft — recettes par niveau de technologie

**Files:**
- Create: `apps/web/src/routes/(app)/craft/+page.svelte`
- Modify: `apps/web/messages/*.json`

**Interfaces:**
- Consumes: index (Task 1), `RecipeCard` (Task 3), `tech.json`
- Produces: `/craft` — recherche d'une recette par nom de produit + groupes
  par niveau de techno (les recettes sans techno dans un groupe « de base »)

- [ ] **Step 1: Messages**

FR : `"craft_title": "Craft"`, `"craft_search": "Que veux-tu fabriquer ?"`,
`"craft_base": "Débloqué de base"`, `"craft_level": "Niveau {level}"` (EN homologue).

- [ ] **Step 2: Page**

`/craft/+page.svelte` : `$state` de recherche ; `$derived` des recettes
filtrées par `gameName(item:productId)` ; groupement
`Map<level, Recipe[]>` via `techUnlocking` (recettes sans tech → groupe -1
« de base ») ; rendu par niveau croissant, `RecipeCard` par recette ; sans
recherche n'afficher que les 3 premiers niveaux + compteur, la recherche
déplie tout.

- [ ] **Step 3: Vérification + commit**

« Comment crafter une Sphère Pal ? » : `/craft`, taper "sphère" (FR) → la
recette apparaît avec ingrédients et techno en < 10 s. Check + build verts.

```bash
git add apps/web
git commit -m "feat(web): section Craft (recherche + groupes par niveau de techno)"
```

---

### Task 5: Technologies — arbre par niveau + tracking partagé

**Files:**
- Create: `apps/web/src/routes/(app)/tech/+page.server.ts`
- Create: `apps/web/src/routes/(app)/tech/+page.svelte`
- Modify: `apps/web/messages/*.json`

**Interfaces:**
- Consumes: `tech.json`, `ProgressStore` (kind `tech_unlocked`), index
- Produces: `/tech` — arbre groupé par `level`, chaque techno : nom, coût en
  points, badge boss, ce qu'elle débloque (liens), toggle « débloqué » +
  avatars du groupe ; ancres `#<techId>` (cibles des liens RecipeCard)

- [ ] **Step 1: Messages**

FR : `"tech_title": "Technologies"`, `"tech_cost": "{cost} pts"`,
`"tech_boss": "Boss"`, `"tech_unlocks": "Débloque"`,
`"tech_unlocked_me": "{count}/{total} débloquées"` (EN homologue).

- [ ] **Step 2: Load + page**

`+page.server.ts` : `getProgress("tech_unlocked", locals.user!.id)`.
`+page.svelte` : même motif store/$effect que le Paldex ; groupes par
niveau (`Map` dérivée), carte par techno `id={t.id}` (ancre) : coche (bouton
sphère réutilisé ou case), nom `gameName(tech:${t.nameId})`, coût `tnum`,
badge boss si `isBoss`, liste `unlocks` → lien `/items/<produit>` quand
l'unlock est une recette de `recipesByProduct`... (l'unlock est un id de
recette : résoudre `recipes.find(r => r.id === u)?.productId` → lien item ;
sinon id de construction → lien `/buildings/<id>` si présent dans
`buildings.json`, texte sinon). Compteur en tête comme le Paldex.

- [ ] **Step 3: Vérification + commit**

Toggle sur 2-3 technos (optimiste), rechargement conserve, ancre depuis une
`RecipeCard` de `/craft` atterrit sur la bonne techno. Check + build verts.

```bash
git add apps/web
git commit -m "feat(web): arbre des technologies avec tracking débloqué partagé"
```

---

### Task 6: Constructions — liste + fiche

**Files:**
- Create: `apps/web/src/routes/(app)/buildings/+page.svelte`
- Create: `apps/web/src/routes/(app)/buildings/[buildingId]/+page.server.ts`
- Create: `apps/web/src/routes/(app)/buildings/[buildingId]/+page.svelte`
- Modify: `apps/web/messages/*.json`

**Interfaces:**
- Consumes: `buildings.json`, index, `gameName`
- Produces: `/buildings` (groupes par `category`, recherche) ;
  `/buildings/[buildingId]` : nom (`building:<mapObjectId>`), matériaux
  (liens items), techno qui la débloque (via `techUnlocking.get(id)`),
  énergie requise

- [ ] **Step 1: Messages**

FR : `"buildings_title": "Constructions"`, `"buildings_search": "Rechercher…"`,
`"building_materials": "Matériaux"`, `"building_energy": "Énergie"`,
`"building_work": "Travail requis"` (EN homologue).

- [ ] **Step 2: Pages**

Liste : groupes par `category` (ordre alphabétique, groupe sans catégorie en
dernier), cartes compactes nom + rang. Fiche : 404 si inconnu ; matériaux avec
icônes/liens, `techUnlocking.get(building.id)` → lien `/tech#<techId>`,
`energyType` et `workAmount` si présents.

- [ ] **Step 3: Vérification + commit**

Navigation croisée : `/tech` → unlock construction → fiche → matériau → item.
Check + build verts.

```bash
git add apps/web
git commit -m "feat(web): section Constructions (liste par catégorie, fiche, liens croisés)"
```

---

### Task 7: Recherche globale + déploiement + sortie de phase

**Files:**
- Create: `apps/web/src/lib/components/GlobalSearch.svelte`
- Modify: `apps/web/src/routes/(app)/+layout.svelte` (intégration topbar)
- Modify: `apps/web/messages/*.json`

**Interfaces:**
- Consumes: `search-index.json`, `buildingByMapObjectId` (Task 1)
- Produces: champ de recherche topbar (raccourci `/`), résultats live (max 12)
  vers `/paldex/<id>`, `/items/<id>`, `/tech#<id>`, `/buildings/<id>`

- [ ] **Step 1: Composant**

`GlobalSearch.svelte` : input + dropdown (position absolute sous le champ,
`surface-2`, bordure, une entrée = icône de namespace + nom localisé) ;
filtrage `$derived` sur `fr`/`en` en `includes` insensible à la casse, tri :
préfixe d'abord ; routage par namespace :
`pal:` → `/paldex/<id>` · `item:` → `/items/<id>` ·
`tech:` → résoudre l'id de tech par `nameId` (`tech.find(t => t.nameId === id)`)
→ `/tech#<techId>` · `building:` → si `buildingByMapObjectId.has(id)` →
`/buildings/<building.id>`, sinon omettre. Raccourci clavier `/` focus le champ,
`Escape` ferme, flèches + Entrée naviguent (rôle listbox/option ARIA).
Messages : FR `"search_placeholder": "Rechercher ( / )"`, EN `"Search ( / )"`.

- [ ] **Step 2: Intégration + vérification complète**

Topbar : `GlobalSearch` entre la nav et `.user` (max-width 260px, caché sous
480px au profit de la recherche des pages). Parcours de sortie de phase :
taper "sphère" → item → recette → techno → construction en < 10 s.
Run: `pnpm --filter web exec vitest run && pnpm --filter web check && pnpm --filter web build` → verts.

- [ ] **Step 3: Déployer + USER ACTION**

```bash
vercel deploy --prod --yes
```
USER ACTION : sur mobile et desktop, dérouler le parcours « comment crafter X »
et cocher des technos à deux comptes.

- [ ] **Step 4: Commit final**

```bash
git add apps/web
git commit -m "feat(web): recherche globale (raccourci /) reliant toutes les sections"
```
