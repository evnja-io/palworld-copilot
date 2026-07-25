# Carte — icônes de Pal et zones de spawn — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher le portrait du Pal sur les marqueurs Alpha de la carte, et ouvrir depuis chaque fiche de Pal la carte centrée sur ses zones de spawn.

**Architecture:** Trois couches indépendantes. (1) Le rendu des marqueurs devient une fonction pure `markerHtml()` qui choisit entre glyphe et `<img>`. (2) Un nouveau transform du pipeline lit `UI/DT_PaldexDistributionData`, projette et regroupe les points, et écrit un fichier par Pal dans `apps/web/static/spawns/` plus un index léger dans `game-data/`. (3) Une couche Leaflet impérative `SpawnLayer`, jumelle de `MarkerController`, dessine les cercles du Pal sélectionné via `?pal=<palId>`.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), Leaflet (`CRS.Simple`), Vitest, Paraglide (FR base + EN), pipeline TypeScript via `tsx`.

## Global Constraints

- **UI et commentaires de code en français.** Les noms de symboles restent en anglais, comme dans le code existant.
- **Toujours `appHref()`** (`apps/web/src/lib/nav.ts`) pour construire un lien interne. Jamais `/s/${slug}/…` en dur : c'est ce qui fait fonctionner le mode invité.
- **Les deux catalogues Paraglide** (`apps/web/messages/fr.json` et `en.json`) reçoivent toute nouvelle clé, à la même position. FR est la locale de base.
- **Ne jamais éditer `apps/web/src/lib/paraglide/`** — répertoire généré et gitignoré.
- **Aucune nouvelle dépendance npm.** Le rendu des zones se fait avec Leaflet seul.
- **Icônes de Pal** : toujours via `palIcon(id)` de `$lib/game/icons`, qui renvoie `undefined` si absente. Toute utilisation doit gérer ce cas.
- **Constantes de projection** (ne pas recalculer à la main) : `SIZE = 8192`, `SCALE = 725`, `TRANSL_X = 375247`, `TRANSL_Y = -18`, `RANGE = 1000`.
- **Commits** : un par tâche, message en français, préfixe conventionnel (`feat:`, `fix:`, `refactor:`, `docs:`).

**Spec de référence :** `docs/superpowers/specs/2026-07-25-carte-icones-pal-et-zones-de-spawn-design.md`

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `packages/pipeline/src/icons.lib.ts` | *(créé)* Alias d'icônes quand seule la casse diverge — fonction pure | 1 |
| `packages/pipeline/src/icons.ts` | *(modifié)* Applique les alias de casse aux Pals | 1 |
| `apps/web/src/lib/map/markerController.ts` | *(modifié)* `markerHtml()` pure + branche portrait pour les Alpha | 2 |
| `apps/web/src/lib/map/LeafletMap.svelte` | *(modifié)* CSS `.mk-pal` et `.spawn-zone` | 2, 7 |
| `apps/web/src/lib/game/indexes.ts` | *(modifié)* Index inversé `markersByPal` | 3 |
| `apps/web/src/routes/s/[slug]/paldex/[palId]/+page.svelte` | *(modifié)* Section « Où le trouver » | 3, 9 |
| `packages/pipeline/src/transform/coord.ts` | *(créé)* Projection monde → pixels, module pur sans effet de bord | 4 |
| `packages/pipeline/src/transform/markers.ts` | *(modifié)* Importe la projection au lieu de la définir | 4 |
| `packages/pipeline/src/transform/spawns.lib.ts` | *(créé)* Résolution d'id, clustering, construction — fonctions pures | 5 |
| `packages/pipeline/src/transform/spawns.ts` | *(créé)* Entrées/sorties du transform | 6 |
| `packages/pipeline/src/paths.ts` | *(modifié)* `SPAWNS_OUT` | 6 |
| `packages/pipeline/src/all.ts`, `verify.ts` | *(modifiés)* Orchestration et garde-fous | 6 |
| `apps/web/src/lib/map/mapState.svelte.ts` | *(modifié)* État `spawnPal` / `spawnPhase`, clé v2 | 7 |
| `apps/web/src/lib/map/spawnLayer.ts` | *(créé)* Couche Leaflet des zones | 7 |
| `apps/web/src/lib/map/SpawnPanel.svelte` | *(créé)* Panneau Pal sélectionné + bascule jour/nuit | 8 |
| `apps/web/src/routes/s/[slug]/map/+page.svelte` | *(modifié)* `?pal=`, câblage de la couche, correctif `focusedId` | 8 |

## Ordre et dépendances

Les tâches 1 à 3 ne dépendent d'aucune extraction et sont livrables immédiatement. La tâche 6 exige un export FModel de `DT_PaldexDistributionData` — **étape manuelle sous Windows**, décrite dans `docs/extraction-runbook.md`. Les tâches 7 à 9 consomment ses artefacts.

```
1 ──► 2 ──► 3            (livrable sans extraction)
4 ──► 5 ──► 6 ──► 7 ──► 8 ──► 9
```

---

### Task 1: Correctif des icônes de Pal à casse divergente

Trois Pals n'affichent aucun portrait dans toute l'application (`VolcanicMonster`, `KingAlpaca_Ice`, `BadCatgirl`) : les `.webp` existent sous une casse différente (`Volcanicmonster.webp`, `KingAlpaca_ice.webp`, `BadCatGirl.webp`) et `icons.json` ne contient pas la clé attendue. Le mécanisme d'alias existe déjà pour les items ; on l'étend aux Pals.

**Files:**
- Create: `packages/pipeline/src/icons.lib.ts`
- Create: `packages/pipeline/src/icons.lib.test.ts`
- Modify: `packages/pipeline/src/icons.ts` (après le bloc `ITEM_ICON_ALIASES`, avant `writeGameData`)

**Interfaces:**
- Consumes: rien.
- Produces: `caseAliases(present: Record<string, boolean | string>, ns: string, ids: string[]): Record<string, string>` — exportée par `icons.lib.ts`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `packages/pipeline/src/icons.lib.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { caseAliases } from "./icons.lib.js";

describe("caseAliases", () => {
  it("aliase un id dont seule la casse diverge du fichier généré", () => {
    const present = { "pal:Volcanicmonster": true, "pal:Anubis": true };
    expect(caseAliases(present, "pal:", ["VolcanicMonster", "Anubis"])).toEqual({
      "pal:VolcanicMonster": "Volcanicmonster",
    });
  });

  it("ignore les ids déjà présents à la casse exacte", () => {
    expect(caseAliases({ "pal:Anubis": true }, "pal:", ["Anubis"])).toEqual({});
  });

  it("ignore les ids sans fichier correspondant", () => {
    expect(caseAliases({ "pal:Anubis": true }, "pal:", ["Inexistant"])).toEqual({});
  });

  it("ne se contredit pas quand la valeur existante est déjà un alias", () => {
    const present = { "pal:KingAlpaca_ice": "KingAlpaca_ice" };
    expect(caseAliases(present, "pal:", ["KingAlpaca_Ice"])).toEqual({
      "pal:KingAlpaca_Ice": "KingAlpaca_ice",
    });
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @palworld-companion/pipeline test icons.lib`
Expected: FAIL — `Cannot find module './icons.lib.js'`

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `packages/pipeline/src/icons.lib.ts` :

```ts
/** Alias `<ns><id>` -> nom réel du .webp quand seule la casse diverge entre
 *  l'id du jeu (DT_PalMonsterParameter) et la clé de la table d'icônes.
 *  Ex. pals.json a « VolcanicMonster », le fichier est « Volcanicmonster.webp ». */
export function caseAliases(
  present: Record<string, boolean | string>,
  ns: string,
  ids: string[],
): Record<string, string> {
  const byLower = new Map<string, string>();
  for (const key of Object.keys(present)) {
    if (!key.startsWith(ns)) continue;
    const id = key.slice(ns.length);
    byLower.set(id.toLowerCase(), id);
  }
  const out: Record<string, string> = {};
  for (const id of ids) {
    if (present[ns + id]) continue;
    const target = byLower.get(id.toLowerCase());
    if (!target || target === id) continue;
    out[ns + id] = target;
  }
  return out;
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter @palworld-companion/pipeline test icons.lib`
Expected: PASS — 4 tests

- [ ] **Step 5: Brancher dans `icons.ts`**

Dans `packages/pipeline/src/icons.ts`, ajouter aux imports existants :

```ts
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { caseAliases } from "./icons.lib.js";
import { ICONS_OUT, OUT_DIR } from "./paths.js";
```

(`mkdirSync` est déjà importé ; ajouter `existsSync` et `readFileSync` à la même ligne, et `OUT_DIR` à l'import de `paths.js`.)

Puis, **juste avant** la garde `if (Object.keys(pals).length < 100 …)` :

```ts
/** Alias de casse pour les Pals : la table d'icônes et DT_PalMonsterParameter
 *  ne s'accordent pas toujours (VolcanicMonster / Volcanicmonster). On croise
 *  avec pals.json, artefact déjà commité — absent = étape simplement ignorée. */
{
  const palsPath = join(OUT_DIR, "pals.json");
  if (existsSync(palsPath)) {
    const ids = (JSON.parse(readFileSync(palsPath, "utf8")) as Array<{ id: string }>).map(
      (p) => p.id,
    );
    const aliases = caseAliases(pals, "pal:", ids);
    Object.assign(pals, aliases);
    console.log(`  alias d'icônes pals (casse) : ${Object.keys(aliases).length}`);
  } else {
    console.warn("  (pals.json absent - alias de casse des Pals ignorés)");
  }
}
```

- [ ] **Step 6: Vérifier la compilation et la suite complète**

Run: `pnpm --filter @palworld-companion/pipeline test`
Expected: PASS, aucune régression

- [ ] **Step 7: Commit**

```bash
git add packages/pipeline/src/icons.lib.ts packages/pipeline/src/icons.lib.test.ts packages/pipeline/src/icons.ts
git commit -m "fix(pipeline): aliaser les icônes de Pal dont la casse diverge"
```

> **Note :** `icons.json` ne sera régénéré qu'au prochain `pnpm --filter @palworld-companion/pipeline icons`, qui exige les exports FModel. Le correctif est donc en place mais ses effets ne seront visibles qu'après régénération — c'est attendu, ne pas chercher à modifier `icons.json` à la main.

---

### Task 2: Portrait du Pal sur les marqueurs Alpha

**Files:**
- Modify: `apps/web/src/lib/map/markerController.ts:17-48`
- Create: `apps/web/src/lib/map/markerController.test.ts`
- Modify: `apps/web/src/lib/map/LeafletMap.svelte` (bloc `<style>`, après la règle `:global(.mk-checked)`)

**Interfaces:**
- Consumes: `palIcon(id: string): string | undefined` de `$lib/game/icons`.
- Produces: `markerHtml(mk: MapMarker, checked: boolean): string` — exportée par `markerController.ts`, utilisée par la méthode privée `#icon()` et par les tests.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/web/src/lib/map/markerController.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { markerHtml, type MapMarker } from "./markerController";

const alpha = (palId: string, level = 30): MapMarker => ({
  id: `alpha_${palId}`,
  type: "alpha",
  px: 100,
  py: 200,
  meta: { palId, level },
});

describe("markerHtml", () => {
  it("rend un portrait pour un Alpha dont le Pal a une icône", () => {
    const html = markerHtml(alpha("Anubis"), false);
    expect(html).toContain("mk-pal");
    expect(html).toContain('src="/icons/pals/Anubis.webp"');
    expect(html).toContain("<i>30</i>");
  });

  it("retombe sur le glyphe quand le Pal est inconnu", () => {
    const html = markerHtml(alpha("None"), false);
    expect(html).not.toContain("mk-pal");
    expect(html).toContain("▲");
  });

  it("retombe sur le glyphe pour un Alpha sans palId", () => {
    const html = markerHtml({ id: "a", type: "alpha", px: 0, py: 0 }, false);
    expect(html).toContain("▲");
  });

  it("laisse les effigies et voyages rapides inchangés", () => {
    expect(markerHtml({ id: "r", type: "relic", px: 0, py: 0 }, false)).toContain("✦");
    expect(markerHtml({ id: "f", type: "ft", px: 0, py: 0 }, false)).toContain("◆");
  });

  it("propage l'état coché", () => {
    expect(markerHtml({ id: "r", type: "relic", px: 0, py: 0 }, true)).toContain("mk-checked");
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter web test src/lib/map/markerController.test.ts`
Expected: FAIL — `markerHtml` n'est pas exportée

- [ ] **Step 3: Écrire l'implémentation**

Dans `apps/web/src/lib/map/markerController.ts`, ajouter l'import en tête (après `import type * as L from "leaflet";`) :

```ts
import { palIcon } from "$lib/game/icons";
```

Puis remplacer la constante `GLYPH` et la méthode `#icon()` par :

```ts
const GLYPH: Record<MapMarker["type"], string> = { relic: "✦", alpha: "▲", ft: "◆" };

/** HTML du divIcon. Les Alpha portent le portrait de leur Pal ; les spawners
 *  sans Pal résolu (palId « None ») et les icônes absentes gardent le glyphe. */
export function markerHtml(mk: MapMarker, checked: boolean): string {
  const level = mk.type === "alpha" && mk.meta?.level ? `<i>${mk.meta.level}</i>` : "";
  const icon = mk.type === "alpha" && mk.meta?.palId ? palIcon(mk.meta.palId) : undefined;
  const body = icon ? `<img src="${icon}" alt="" width="18" height="18" />` : GLYPH[mk.type];
  const cls = `mk mk-${mk.type}${icon ? " mk-pal" : ""}${checked ? " mk-checked" : ""}`;
  return `<span class="${cls}">${body}${level}</span>`;
}
```

Et dans la classe, `#icon()` devient :

```ts
  #icon(mk: MapMarker, checked: boolean): L.DivIcon {
    return this.#L.divIcon({
      className: "",
      html: markerHtml(mk, checked),
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter web test src/lib/map/markerController.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Ajouter le CSS**

Dans `apps/web/src/lib/map/LeafletMap.svelte`, insérer après la règle `:global(.mk-checked)` :

```css
	:global(.mk-pal) {
		padding: 1px;
	}
	:global(.mk-pal img) {
		display: block;
		width: 18px;
		height: 18px;
		object-fit: contain;
	}
```

- [ ] **Step 6: Vérifier types et suite complète**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS

- [ ] **Step 7: Vérification visuelle**

Run: `pnpm --filter web dev` puis ouvrir `http://localhost:5173/map`
Attendu : les marqueurs Alpha affichent un portrait de Pal dans la pastille ronde ; le badge de niveau reste lisible sous l'icône ; les effigies (✦ vert) et voyages rapides (◆ bleu) sont inchangés ; quelques Alpha gardent le ▲ (spawners sans Pal).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/map/markerController.ts apps/web/src/lib/map/markerController.test.ts apps/web/src/lib/map/LeafletMap.svelte
git commit -m "feat(web): portrait du Pal sur les marqueurs Alpha de la carte"
```

---

### Task 3: Section « Où le trouver » — entrée Boss Alpha

Livrable indépendant du pipeline : couvre les 83 Pals ayant un spawner Alpha. L'entrée « zones de spawn » sera ajoutée en tâche 9.

**Files:**
- Modify: `apps/web/src/lib/game/indexes.ts` (fin de fichier)
- Modify: `apps/web/src/lib/game/indexes.test.ts`
- Modify: `apps/web/src/routes/s/[slug]/paldex/[palId]/+page.svelte`
- Modify: `apps/web/messages/fr.json`, `apps/web/messages/en.json`

**Interfaces:**
- Consumes: `MapMarker` (type) de `$lib/map/markerController` — **import de type uniquement**, pour ne pas tirer Leaflet ni `palIcon` dans `$lib/game`.
- Produces: `markersByPal: Map<string, MapMarker[]>` — exportée par `$lib/game/indexes`.

- [ ] **Step 1: Écrire le test qui échoue**

Dans `apps/web/src/lib/game/indexes.test.ts`, ajouter `markersByPal` à l'import existant puis ce bloc à la fin du `describe` :

```ts
  it("indexe les marqueurs Alpha par Pal, sans la clé « None »", () => {
    // Anubis n'existe qu'en boss de terrain : il doit avoir un marqueur.
    const anubis = markersByPal.get("Anubis");
    expect(anubis?.length).toBeGreaterThan(0);
    expect(anubis![0].type).toBe("alpha");
    expect(anubis![0].meta?.level).toBeGreaterThan(0);
    // Lamball n'a aucun spawner Alpha.
    expect(markersByPal.get("Lamball")).toBeUndefined();
    // Les 69 spawners sans Pal résolu ne doivent pas créer d'entrée.
    expect(markersByPal.has("None")).toBe(false);
  });
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter web test src/lib/game/indexes.test.ts`
Expected: FAIL — `markersByPal` n'est pas exportée

- [ ] **Step 3: Écrire l'implémentation**

Dans `apps/web/src/lib/game/indexes.ts`, ajouter aux imports :

```ts
import markersJson from "@palworld-companion/game-data/markers.json";
import type { MapMarker } from "$lib/map/markerController";
```

et à la fin du fichier :

```ts
/** Marqueurs de la carte portant un Pal (spawners de boss Alpha), indexés par
 *  Pal. Le palId « None » désigne un spawner sans boss résolu : écarté. */
export const markersByPal = new Map<string, MapMarker[]>();
for (const mk of markersJson as MapMarker[]) {
  const palId = mk.meta?.palId;
  if (!palId || palId === "None") continue;
  push(markersByPal, palId, mk);
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter web test src/lib/game/indexes.test.ts`
Expected: PASS

- [ ] **Step 5: Ajouter les clés i18n**

Dans `apps/web/messages/fr.json`, après `"pal_toggle_caught": "Capturé",` :

```json
  "pal_locations": "Où le trouver",
  "pal_locations_alpha": "Boss Alpha · Niv. {level}",
```

Dans `apps/web/messages/en.json`, après `"pal_toggle_caught": "Caught",` :

```json
  "pal_locations": "Where to find",
  "pal_locations_alpha": "Alpha boss · Lv. {level}",
```

- [ ] **Step 6: Ajouter la section à la fiche Pal**

Dans `apps/web/src/routes/s/[slug]/paldex/[palId]/+page.svelte`, ajouter à l'import :

```ts
	import { markersByPal } from '$lib/game/indexes';
```

et après la déclaration `const caught = $derived(...)` :

```ts
	const alphaMarker = $derived(markersByPal.get(pal.id)?.[0]);
```

Puis insérer **après** la balise fermante `</header>` (et avant le bloc `{#if gameDesc(...)}`) :

```svelte
{#if alphaMarker}
	<section class="locations">
		<h2>{m.pal_locations()}</h2>
		<div class="loc-links">
			<a class="loc-link" href={appHref(`/map?focus=${alphaMarker.id}`)}>
				{m.pal_locations_alpha({ level: alphaMarker.meta?.level ?? 0 })}
			</a>
		</div>
	</section>
{/if}
```

Et dans le bloc `<style>` du même fichier :

```css
	.locations {
		margin: 18px 0 0;
	}
	.loc-links {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.loc-link {
		display: inline-flex;
		align-items: center;
		min-height: 36px;
		padding: 6px 14px;
		background: var(--accent);
		color: var(--accent-ink);
		border-radius: var(--r-sm);
		font-weight: 600;
		font-size: 13px;
	}
	.loc-link:hover {
		background: color-mix(in srgb, var(--accent) 85%, white);
		color: var(--accent-ink);
	}
```

- [ ] **Step 7: Vérifier**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS

Run: `pnpm --filter web dev` puis :
- `http://localhost:5173/paldex/Anubis` → section « Où le trouver » avec un bouton `Boss Alpha · Niv. N` ; le clic ouvre la carte centrée sur le marqueur, popup ouverte.
- `http://localhost:5173/paldex/Lamball` → aucune section.
- `http://localhost:5173/en/paldex/Anubis` → libellé anglais, lien préfixé `/en/`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/game/indexes.ts apps/web/src/lib/game/indexes.test.ts apps/web/src/routes/s/\[slug\]/paldex/\[palId\]/+page.svelte apps/web/messages/fr.json apps/web/messages/en.json
git commit -m "feat(web): section « Où le trouver » avec le boss Alpha sur la fiche Pal"
```

---

### Task 4: Extraire la projection monde → pixels

`markers.ts` exécute tout son traitement à l'import (il écrit `markers.json` au chargement du module). Importer `worldToPixel` depuis un autre transform déclencherait cette écriture. On déplace la projection dans un module pur. Aucun autre fichier ne référence ces fonctions : la bascule est mécanique.

**Files:**
- Create: `packages/pipeline/src/transform/coord.ts`
- Create: `packages/pipeline/src/transform/coord.test.ts`
- Modify: `packages/pipeline/src/transform/markers.ts:4-25`

**Interfaces:**
- Consumes: rien.
- Produces, exportés par `coord.ts` :
  - `SIZE`, `SCALE`, `TRANSL_X`, `TRANSL_Y`, `RANGE` (constantes `number`)
  - `worldToGame(worldX: number, worldY: number): [number, number]`
  - `worldToPixel(worldX: number, worldY: number): [number, number] | null` — `null` hors plage (carte de l'Arbre-Monde)
  - `radiusToPx(worldRadius: number): number`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `packages/pipeline/src/transform/coord.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { radiusToPx, worldToGame, worldToPixel } from "./coord.js";

describe("worldToGame", () => {
  it("place l'origine in-game au centre des translations", () => {
    expect(worldToGame(-375247, -18)).toEqual([0, 0]);
  });
});

describe("worldToPixel", () => {
  it("projette l'origine in-game au centre de la texture", () => {
    expect(worldToPixel(-375247, -18)).toEqual([4096, 4096]);
  });

  it("écarte les points hors de la plage in-game (Arbre-Monde)", () => {
    expect(worldToPixel(-375247, 800_000)).toBeNull();
  });

  it("arrondit à une décimale", () => {
    const pt = worldToPixel(-375247, 1234)!;
    expect(pt[0]).toBe(Math.round(pt[0] * 10) / 10);
  });
});

describe("radiusToPx", () => {
  it("convertit le rayon de spawn du jeu en pixels de texture", () => {
    // 15000 / 725 unités in-game, sur 2000 unités pour 8192 px
    expect(radiusToPx(15000)).toBeCloseTo(84.74, 2);
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @palworld-companion/pipeline test coord`
Expected: FAIL — `Cannot find module './coord.js'`

- [ ] **Step 3: Créer le module**

Créer `packages/pipeline/src/transform/coord.ts` :

```ts
// Transform monde -> coordonnées in-game v1.0 (constantes de
// PalworldSaveTools/palworld_coord, variante « new » : scale 725) ; la
// texture T_WorldMap couvre exactement la plage in-game [-1000, 1000]².
// Les POI hors plage appartiennent à la carte de l'Arbre-Monde (T_TreeMap,
// hors v1 - exclus avec comptage). CALIBRÉ VISUELLEMENT en Task 4.
// Module pur : aucun effet de bord, importable par tous les transforms.
export const SIZE = 8192;
export const SCALE = 725;
export const TRANSL_X = 375247;
export const TRANSL_Y = -18;
export const RANGE = 1000;

export function worldToGame(worldX: number, worldY: number): [number, number] {
  return [(worldY - TRANSL_Y) / SCALE, (worldX + TRANSL_X) / SCALE];
}

export function worldToPixel(worldX: number, worldY: number): [number, number] | null {
  const [gx, gy] = worldToGame(worldX, worldY);
  if (Math.abs(gx) > RANGE || Math.abs(gy) > RANGE) return null; // Arbre-Monde
  const px = ((gx + RANGE) / (2 * RANGE)) * SIZE;
  const py = ((RANGE - gy) / (2 * RANGE)) * SIZE;
  return [Math.round(px * 10) / 10, Math.round(py * 10) / 10];
}

/** Rayon monde -> rayon en pixels de texture (l'échelle est isotrope). */
export function radiusToPx(worldRadius: number): number {
  return (worldRadius / SCALE / (2 * RANGE)) * SIZE;
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter @palworld-companion/pipeline test coord`
Expected: PASS — 5 tests

- [ ] **Step 5: Faire pointer `markers.ts` sur le module**

Dans `packages/pipeline/src/transform/markers.ts`, **supprimer** les lignes 4 à 25 (le commentaire de calibration, les cinq constantes, `worldToGame` et `worldToPixel`) et ajouter cet import sous celui de `../lib.js` :

```ts
import { worldToPixel } from "./coord.js";
```

Ne rien changer d'autre : les trois appels à `worldToPixel` restent identiques.

- [ ] **Step 6: Vérifier la non-régression**

Run: `pnpm --filter @palworld-companion/pipeline test`
Expected: PASS

Vérifier qu'aucune référence orpheline ne subsiste :

Run: `grep -rn "worldToGame\|worldToPixel" packages/pipeline/src`
Expected: uniquement `transform/coord.ts`, `transform/coord.test.ts` et l'import dans `transform/markers.ts`

- [ ] **Step 7: Commit**

```bash
git add packages/pipeline/src/transform/coord.ts packages/pipeline/src/transform/coord.test.ts packages/pipeline/src/transform/markers.ts
git commit -m "refactor(pipeline): extraire la projection monde/pixels dans un module pur"
```

---

### Task 5: Logique des zones de spawn (fonctions pures)

**Files:**
- Create: `packages/pipeline/src/transform/spawns.lib.ts`
- Create: `packages/pipeline/src/transform/spawns.lib.test.ts`

**Interfaces:**
- Consumes: `worldToPixel`, `radiusToPx` de `./coord.js` (tâche 4).
- Produces, exportés par `spawns.lib.ts` :
  - `type SpawnPoint = [number, number]`
  - `type PalSpawns = { r: number; day: SpawnPoint[]; night: SpawnPoint[] }`
  - `type DistributionRow = { dayTimeLocations?: PhaseBlock; nightTimeLocations?: PhaseBlock }` où `PhaseBlock = { Locations?: Array<{ X: number; Y: number }>; Radius?: number }`
  - `buildPalIdIndex(ids: string[]): Map<string, string>`
  - `resolvePalId(rawKey: string, index: Map<string, string>): string | null`
  - `clusterPoints(points: SpawnPoint[], cell: number): SpawnPoint[]`
  - `buildSpawns(rows: Record<string, DistributionRow>, palIds: string[]): { spawns: Record<string, PalSpawns>; unresolved: string[]; treeSkipped: number }`

**Règles métier à respecter :**
- Les clés `BOSS_*` (casse libre — `Boss_Anubis` existe) sont **fusionnées** dans l'espèce de base. Sans cela, Anubis, JetDragon, Umihebi et sept autres n'auraient aucune zone : ils n'apparaissent qu'en boss de terrain.
- La résolution de casse est indispensable : `Volcanicmonster` dans la table, `VolcanicMonster` dans `pals.json`.
- Le clustering se fait au **demi-rayon**, ce qui divise le volume par ~2,8.
- Parcours des clés **trié**, pour un artefact reproductible d'un run à l'autre.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `packages/pipeline/src/transform/spawns.lib.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  buildPalIdIndex,
  buildSpawns,
  clusterPoints,
  resolvePalId,
  type DistributionRow,
} from "./spawns.lib.js";

const index = buildPalIdIndex(["Anubis", "VolcanicMonster", "Alpaca"]);

describe("resolvePalId", () => {
  it("retire le préfixe BOSS_ quelle que soit sa casse", () => {
    expect(resolvePalId("BOSS_Anubis", index)).toBe("Anubis");
    expect(resolvePalId("Boss_Anubis", index)).toBe("Anubis");
  });

  it("résout une casse divergente", () => {
    expect(resolvePalId("Volcanicmonster", index)).toBe("VolcanicMonster");
  });

  it("laisse intact un id déjà exact", () => {
    expect(resolvePalId("Alpaca", index)).toBe("Alpaca");
  });

  it("renvoie null pour un id inconnu", () => {
    expect(resolvePalId("Inexistant", index)).toBeNull();
  });
});

describe("clusterPoints", () => {
  it("ne garde qu'un point par cellule de grille", () => {
    expect(clusterPoints([[0, 0], [1, 1], [100, 100]], 10)).toEqual([[0, 0], [100, 100]]);
  });

  it("préserve l'ordre d'entrée des représentants", () => {
    expect(clusterPoints([[100, 100], [0, 0]], 10)).toEqual([[100, 100], [0, 0]]);
  });

  it("accepte une liste vide", () => {
    expect(clusterPoints([], 10)).toEqual([]);
  });
});

// Le centre de la texture : worldToPixel(-375247, -18) === [4096, 4096].
const CENTER = { X: -375247, Y: -18 };
const row = (day: Array<{ X: number; Y: number }>, night: Array<{ X: number; Y: number }> = []): DistributionRow => ({
  dayTimeLocations: { Locations: day, Radius: 15000 },
  nightTimeLocations: { Locations: night, Radius: 15000 },
});

describe("buildSpawns", () => {
  it("projette les points et expose le rayon en pixels", () => {
    const { spawns } = buildSpawns({ Anubis: row([CENTER]) }, ["Anubis"]);
    expect(spawns.Anubis.day).toEqual([[4096, 4096]]);
    // Arrondi explicite à 1 décimale, comme les points : égalité stricte.
    expect(spawns.Anubis.r).toBe(84.7);
  });

  it("sépare le jour et la nuit", () => {
    const { spawns } = buildSpawns({ Anubis: row([CENTER], [CENTER]) }, ["Anubis"]);
    expect(spawns.Anubis.day).toHaveLength(1);
    expect(spawns.Anubis.night).toHaveLength(1);
  });

  it("fusionne une clé BOSS_ dans l'espèce de base", () => {
    const far = { X: -375247, Y: 200_000 };
    const { spawns } = buildSpawns(
      { Anubis: row([CENTER]), BOSS_Anubis: row([far]) },
      ["Anubis"],
    );
    expect(spawns.Anubis.day).toHaveLength(2);
  });

  it("crée l'entrée même quand seule la clé BOSS_ existe", () => {
    const { spawns } = buildSpawns({ Boss_Anubis: row([CENTER]) }, ["Anubis"]);
    expect(spawns.Anubis.day).toEqual([[4096, 4096]]);
  });

  it("écarte et compte les points de l'Arbre-Monde", () => {
    const { spawns, treeSkipped } = buildSpawns(
      { Anubis: row([CENTER, { X: -375247, Y: 800_000 }]) },
      ["Anubis"],
    );
    expect(spawns.Anubis.day).toHaveLength(1);
    expect(treeSkipped).toBe(1);
  });

  it("signale les clés non résolues sans planter", () => {
    const { spawns, unresolved } = buildSpawns({ Inexistant: row([CENTER]) }, ["Anubis"]);
    expect(unresolved).toEqual(["Inexistant"]);
    expect(spawns).toEqual({});
  });

  it("n'émet aucune entrée pour un Pal sans point exploitable", () => {
    const { spawns } = buildSpawns({ Anubis: row([]) }, ["Anubis"]);
    expect(spawns.Anubis).toBeUndefined();
  });

  it("regroupe les points trop proches", () => {
    const near = { X: CENTER.X + 100, Y: CENTER.Y + 100 };
    const { spawns } = buildSpawns({ Anubis: row([CENTER, near]) }, ["Anubis"]);
    expect(spawns.Anubis.day).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `pnpm --filter @palworld-companion/pipeline test spawns.lib`
Expected: FAIL — `Cannot find module './spawns.lib.js'`

- [ ] **Step 3: Écrire l'implémentation**

Créer `packages/pipeline/src/transform/spawns.lib.ts` :

```ts
// Zones de spawn des Pals, depuis DT_PaldexDistributionData - la table que le
// jeu utilise pour son propre Paldex. Fonctions pures : les I/O sont dans
// spawns.ts.
import { radiusToPx, worldToPixel } from "./coord.js";

export type SpawnPoint = [number, number];
export type PalSpawns = { r: number; day: SpawnPoint[]; night: SpawnPoint[] };

type PhaseBlock = { Locations?: Array<{ X: number; Y: number }>; Radius?: number };
export type DistributionRow = {
  dayTimeLocations?: PhaseBlock;
  nightTimeLocations?: PhaseBlock;
};

/** Rayon par défaut : uniforme à 15000 dans toutes les lignes observées. */
const DEFAULT_RADIUS = 15000;

export function buildPalIdIndex(ids: string[]): Map<string, string> {
  return new Map(ids.map((id) => [id.toLowerCase(), id]));
}

/** Clé de la table -> id de pals.json. Le préfixe BOSS_ (casse libre : le jeu
 *  écrit aussi « Boss_Anubis ») désigne la variante boss de terrain d'une
 *  espèce ; on la fusionne dans l'espèce de base, sinon les Pals qui
 *  n'apparaissent qu'en boss n'auraient aucune zone. */
export function resolvePalId(rawKey: string, index: Map<string, string>): string | null {
  const stripped = rawKey.replace(/^boss_/i, "");
  return index.get(stripped.toLowerCase()) ?? index.get(rawKey.toLowerCase()) ?? null;
}

/** Un représentant par cellule de grille : les points bruts se chevauchent
 *  massivement (réduction mesurée ×2,8 au demi-rayon). */
export function clusterPoints(points: SpawnPoint[], cell: number): SpawnPoint[] {
  const seen = new Set<string>();
  const out: SpawnPoint[] = [];
  for (const [x, y] of points) {
    const key = `${Math.round(x / cell)}:${Math.round(y / cell)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([x, y]);
  }
  return out;
}

export function buildSpawns(
  rows: Record<string, DistributionRow>,
  palIds: string[],
): { spawns: Record<string, PalSpawns>; unresolved: string[]; treeSkipped: number } {
  const index = buildPalIdIndex(palIds);
  const merged = new Map<string, { day: SpawnPoint[]; night: SpawnPoint[]; radius: number }>();
  const unresolved: string[] = [];
  let treeSkipped = 0;

  // Parcours trié : artefact reproductible d'un run à l'autre.
  for (const rawKey of Object.keys(rows).sort()) {
    const palId = resolvePalId(rawKey, index);
    if (!palId) {
      unresolved.push(rawKey);
      continue;
    }
    const entry = merged.get(palId) ?? { day: [], night: [], radius: 0 };
    for (const [phase, block] of [
      ["day", rows[rawKey].dayTimeLocations],
      ["night", rows[rawKey].nightTimeLocations],
    ] as const) {
      if (!block) continue;
      entry.radius = Math.max(entry.radius, block.Radius ?? DEFAULT_RADIUS);
      for (const loc of block.Locations ?? []) {
        const pt = worldToPixel(loc.X, loc.Y);
        if (!pt) {
          treeSkipped++;
          continue;
        }
        entry[phase].push(pt);
      }
    }
    merged.set(palId, entry);
  }

  const spawns: Record<string, PalSpawns> = {};
  for (const [palId, entry] of merged) {
    const radiusPx = radiusToPx(entry.radius || DEFAULT_RADIUS);
    const cell = radiusPx / 2;
    const day = clusterPoints(entry.day, cell);
    const night = clusterPoints(entry.night, cell);
    if (day.length === 0 && night.length === 0) continue;
    spawns[palId] = { r: Math.round(radiusPx * 10) / 10, day, night };
  }
  return { spawns, unresolved, treeSkipped };
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `pnpm --filter @palworld-companion/pipeline test spawns.lib`
Expected: PASS — 15 tests

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/transform/spawns.lib.ts packages/pipeline/src/transform/spawns.lib.test.ts
git commit -m "feat(pipeline): logique des zones de spawn (résolution, fusion BOSS_, clustering)"
```

---

### Task 6: Transform des zones de spawn (I/O)

⚠️ **Prérequis manuel :** exporter `Pal/Content/Pal/DataTable/UI/DT_PaldexDistributionData` depuis FModel vers `RAW_DIR` (`/mnt/c/PalExports/Exports` par défaut), via **Save Properties (.json)**. Voir `docs/extraction-runbook.md`. Sans cet export, `pnpm all` échouera sur ce transform avec « Aucun export ne matche ».

**Files:**
- Create: `packages/pipeline/src/transform/spawns.ts`
- Modify: `packages/pipeline/src/paths.ts`
- Modify: `packages/pipeline/src/all.ts`
- Modify: `packages/pipeline/src/verify.ts`
- Modify: `docs/extraction-runbook.md`
- Modify: `apps/web/.gitignore` — **vérifier** qu'aucune règle n'exclut `static/spawns/`

**Interfaces:**
- Consumes: `buildSpawns` de `./spawns.lib.js` (tâche 5) ; `loadDataTableRows`, `writeGameData` de `../lib.js` ; `OUT_DIR` de `./paths.js`.
- Produces :
  - `SPAWNS_OUT` — exportée par `paths.ts`, pointe sur `apps/web/static/spawns/`
  - `apps/web/static/spawns/<PalId>.json` → `{ "r": number, "day": [[number, number]], "night": [[number, number]] }`
  - `packages/game-data/spawns-index.json` → `{ "<PalId>": { "day": number, "night": number } }`

- [ ] **Step 1: Ajouter le chemin de sortie**

Dans `packages/pipeline/src/paths.ts`, après `ICONS_OUT` :

```ts
export const SPAWNS_OUT = fileURLToPath(new URL("../../../apps/web/static/spawns/", import.meta.url));
```

- [ ] **Step 2: Écrire le transform**

Créer `packages/pipeline/src/transform/spawns.ts` :

```ts
// Zones de spawn par Pal, depuis DT_PaldexDistributionData.
// Deux sorties : un fichier par Pal sous static/ (chargé à la demande par la
// carte, ~4 Ko chacun) et un index de comptages dans game-data (importé
// statiquement par la fiche Pal, qui n'a besoin que de savoir s'il y a
// quelque chose à montrer).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadDataTableRows, writeGameData } from "../lib.js";
import { OUT_DIR, SPAWNS_OUT } from "../paths.js";
import { buildSpawns, type DistributionRow } from "./spawns.lib.js";

const palIds = (
  JSON.parse(readFileSync(join(OUT_DIR, "pals.json"), "utf8")) as Array<{ id: string }>
).map((p) => p.id);

const rows = loadDataTableRows(/DT_PaldexDistributionData(_Common)?\.json$/) as Record<
  string,
  DistributionRow
>;

const { spawns, unresolved, treeSkipped } = buildSpawns(rows, palIds);

// Réécriture complète : un Pal disparu d'une version du jeu ne doit pas
// laisser un fichier orphelin servi par static/.
rmSync(SPAWNS_OUT, { recursive: true, force: true });
mkdirSync(SPAWNS_OUT, { recursive: true });

const index: Record<string, { day: number; night: number }> = {};
for (const [palId, data] of Object.entries(spawns)) {
  writeFileSync(join(SPAWNS_OUT, `${palId}.json`), JSON.stringify(data) + "\n");
  index[palId] = { day: data.day.length, night: data.night.length };
}
writeGameData("spawns-index.json", index);

const total = Object.values(index).reduce((s, c) => s + c.day + c.night, 0);
if (Object.keys(index).length < 100) {
  throw new Error(`zones de spawn : seulement ${Object.keys(index).length} Pals couverts`);
}
if (unresolved.length > 0) {
  console.log(`  (${unresolved.length} clés non résolues : ${unresolved.slice(0, 5).join(", ")}…)`);
}
console.log(`  (${treeSkipped} points de l'Arbre-Monde exclus - carte séparée, hors v1)`);
console.log(`spawns OK (${Object.keys(index).length} Pals, ${total} zones)`);
```

- [ ] **Step 3: Brancher dans l'orchestrateur**

Dans `packages/pipeline/src/all.ts`, insérer entre `markers.js` et `search-index.js` :

```ts
await import("./transform/spawns.js");
```

- [ ] **Step 4: Ajouter les garde-fous à `verify.ts`**

Dans `packages/pipeline/src/verify.ts`, après le bloc des marqueurs (`if (markers.length < 400) …`) :

```ts
// Zones de spawn : couverture, ids connus, coordonnées dans la texture.
const spawnsIndex = load("spawns-index.json") as Record<string, { day: number; night: number }>;
const spawnPalIds = Object.keys(spawnsIndex);
if (spawnPalIds.length < 100) fail(`spawns: ${spawnPalIds.length} Pals`);
const palIdSet = new Set((pals as Array<{ id: string }>).map((p) => p.id));
for (const id of spawnPalIds) {
  if (!palIdSet.has(id)) fail(`spawns: id inconnu dans pals.json (${id})`);
  const c = spawnsIndex[id];
  if (c.day + c.night === 0) fail(`spawns: entrée vide (${id})`);
}
{
  const sample = spawnPalIds[0];
  const data = JSON.parse(
    readFileSync(join(SPAWNS_OUT, `${sample}.json`), "utf8"),
  ) as { r: number; day: number[][]; night: number[][] };
  if (!(data.r > 0)) fail(`spawns: rayon invalide (${sample})`);
  for (const [px, py] of [...data.day, ...data.night]) {
    if (px < 0 || px > 8192 || py < 0 || py > 8192) fail(`spawns: point hors texture (${sample})`);
  }
}
```

Ajouter `SPAWNS_OUT` à l'import de `./paths.js` en tête de `verify.ts` (`readFileSync` et `join` y sont déjà importés).

- [ ] **Step 5: Documenter l'asset dans le runbook**

Dans `docs/extraction-runbook.md`, ajouter une ligne au tableau des DataTables, sous celle des boss Alpha :

```markdown
| Zones de spawn des Pals | `UI/DT_PaldexDistributionData` - table du Paldex en jeu (jour/nuit) |
```

- [ ] **Step 6: Vérifier qu'aucune règle n'ignore la sortie**

Run: `git check-ignore -v apps/web/static/spawns/ ; echo "exit=$?"`
Expected: `exit=1` (aucune règle ne correspond). Si une règle apparaît, l'assouplir pour laisser passer `static/spawns/`.

- [ ] **Step 7: Lancer le pipeline**

Run: `pnpm --filter @palworld-companion/pipeline all`
Expected: `spawns OK (N Pals, M zones)` avec N ≥ 100, puis `PIPELINE OK`

Vérifier les sorties :

Run: `ls apps/web/static/spawns | wc -l && node -e "const i=require('./packages/game-data/spawns-index.json');console.log(Object.keys(i).length,'Pals');console.log(JSON.stringify(i.Anubis))"`
Expected: le nombre de fichiers correspond au nombre de clés de l'index ; `Anubis` a une entrée non vide.

- [ ] **Step 8: Lancer la suite de tests**

Run: `pnpm --filter @palworld-companion/pipeline test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/pipeline/src/transform/spawns.ts packages/pipeline/src/paths.ts packages/pipeline/src/all.ts packages/pipeline/src/verify.ts docs/extraction-runbook.md packages/game-data/spawns-index.json apps/web/static/spawns
git commit -m "feat(pipeline): générer les zones de spawn par Pal depuis DT_PaldexDistributionData"
```

---

### Task 7: Couche Leaflet des zones de spawn

**Files:**
- Modify: `apps/web/src/lib/map/mapState.svelte.ts`
- Create: `apps/web/src/lib/map/spawnLayer.ts`
- Modify: `apps/web/src/lib/map/LeafletMap.svelte` (bloc `<style>`, à la fin)

**Interfaces:**
- Consumes: `toLatLng(px, py)` fourni par `LeafletMap` via `onready`.
- Produces :
  - `MapFilters` gagne `spawnPal: string | null` et `spawnPhase: SpawnPhase`
  - `type SpawnPhase = "day" | "night"` — exporté par `spawnLayer.ts`
  - `class SpawnLayer` avec `setPal(palId: string | null, phase: SpawnPhase): Promise<void>`, `bounds(): L.LatLngBounds | null`, `destroy(): void`

**Points techniques à ne pas rater :**
- Utiliser `L.circle` et **non** `L.circleMarker` : le rayon de `circleMarker` est en pixels écran et ne suivrait pas le zoom.
- En `CRS.Simple`, le rayon d'un `L.circle` s'exprime dans l'unité projetée, pas en pixels de texture. Le facteur se calcule une fois : `toLatLng(1, 0).lng - toLatLng(0, 0).lng`.
- Utiliser `L.featureGroup` (et non `layerGroup`) : seul le premier expose `getBounds()`, nécessaire pour cadrer la vue.
- Aucun réglage d'ordre de couches : les vecteurs vont dans l'`overlayPane` (z 400), sous le `markerPane` (z 600). Les Alpha restent cliquables.
- `interactive: false` sur les cercles, sinon ils capturent les clics destinés aux marqueurs.

- [ ] **Step 1: Étendre l'état de la carte**

Remplacer intégralement `apps/web/src/lib/map/mapState.svelte.ts` par :

```ts
// Filtres de la carte, persistés en localStorage.
import type { SpawnPhase } from "./spawnLayer";

// v2 : ajout de spawnPal / spawnPhase - un état v1 restauré tel quel
// laisserait ces champs absents.
const STORAGE_KEY = "map-filters-v2";

export type MapFilters = {
  relic: boolean;
  alpha: boolean;
  ft: boolean;
  hideChecked: boolean;
  /** Pal dont les zones de spawn sont affichées, null si aucune. */
  spawnPal: string | null;
  spawnPhase: SpawnPhase;
};

const DEFAULTS: MapFilters = {
  relic: true,
  alpha: true,
  ft: true,
  hideChecked: false,
  spawnPal: null,
  spawnPhase: "day",
};

export class MapState {
  filters = $state<MapFilters>({ ...DEFAULTS });

  restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.filters = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* localStorage indisponible : défauts */
    }
  }

  persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.filters));
    } catch {
      /* ignore */
    }
  }
}
```

- [ ] **Step 2: Écrire la couche**

Créer `apps/web/src/lib/map/spawnLayer.ts` :

```ts
// Zones de spawn d'un Pal. Même contrat que MarkerController : Leaflet possède
// le DOM, Svelte l'état, et rien n'est monté par cercle (~190 par Pal).
import type * as L from "leaflet";

export type SpawnPhase = "day" | "night";
export type PalSpawns = { r: number; day: [number, number][]; night: [number, number][] };

export class SpawnLayer {
  #L: typeof L;
  #layer: L.FeatureGroup;
  #toLatLng: (px: number, py: number) => L.LatLng;
  /** Unité projetée correspondant à 1 px de texture (CRS.Simple). */
  #unit: number;
  #cache = new Map<string, PalSpawns | null>();
  /** Clé `palId:phase` en cours, pour ignorer les chargements obsolètes. */
  #current: string | null = null;

  constructor(leaflet: typeof L, map: L.Map, toLatLng: (px: number, py: number) => L.LatLng) {
    this.#L = leaflet;
    this.#toLatLng = toLatLng;
    this.#unit = toLatLng(1, 0).lng - toLatLng(0, 0).lng;
    this.#layer = leaflet.featureGroup().addTo(map);
  }

  async #load(palId: string): Promise<PalSpawns | null> {
    const hit = this.#cache.get(palId);
    if (hit !== undefined) return hit;
    let data: PalSpawns | null = null;
    try {
      const res = await fetch(`/spawns/${palId}.json`);
      if (res.ok) data = (await res.json()) as PalSpawns;
    } catch {
      /* hors ligne ou 404 : pas de zone à afficher */
    }
    this.#cache.set(palId, data);
    return data;
  }

  /** Affiche les zones d'un Pal pour une phase, ou vide la couche si null. */
  async setPal(palId: string | null, phase: SpawnPhase): Promise<void> {
    const key = palId ? `${palId}:${phase}` : null;
    if (key === this.#current) return;
    this.#current = key;
    this.#layer.clearLayers();
    if (!palId) return;
    const data = await this.#load(palId);
    // Un autre Pal a pu être demandé pendant le fetch.
    if (this.#current !== key || !data) return;
    const radius = data.r * this.#unit;
    for (const [px, py] of data[phase]) {
      this.#layer.addLayer(
        this.#L.circle(this.#toLatLng(px, py), {
          radius,
          className: "spawn-zone",
          stroke: false,
          interactive: false,
        }),
      );
    }
  }

  /** Emprise des zones affichées, pour cadrer la vue. */
  bounds(): L.LatLngBounds | null {
    const b = this.#layer.getBounds();
    return b.isValid() ? b : null;
  }

  destroy(): void {
    this.#layer.remove();
    this.#cache.clear();
  }
}
```

- [ ] **Step 3: Ajouter le CSS**

Dans `apps/web/src/lib/map/LeafletMap.svelte`, à la fin du bloc `<style>` :

```css
	/* Zones de spawn (vecteurs Leaflet - hors scope Svelte, d'où :global).
	   L'opacité s'accumule aux recouvrements : la densité se lit d'elle-même. */
	:global(.spawn-zone) {
		fill: var(--accent);
		fill-opacity: 0.13;
	}
```

- [ ] **Step 4: Vérifier les types**

Run: `pnpm --filter web check`
Expected: PASS — aucune erreur

> `mapState.svelte.ts` importe désormais un type de `spawnLayer.ts`, et le compte des filtres a changé ; `+page.svelte` ne compilera correctement qu'après la tâche 8. Si `check` signale un `spawnPal` manquant dans un littéral `MapFilters`, c'est attendu — le corriger en tâche 8.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/map/mapState.svelte.ts apps/web/src/lib/map/spawnLayer.ts apps/web/src/lib/map/LeafletMap.svelte
git commit -m "feat(web): couche Leaflet des zones de spawn"
```

---

### Task 8: Panneau jour/nuit et câblage `?pal=`

**Files:**
- Create: `apps/web/src/lib/map/SpawnPanel.svelte`
- Modify: `apps/web/src/routes/s/[slug]/map/+page.svelte`
- Modify: `apps/web/messages/fr.json`, `apps/web/messages/en.json`

**Interfaces:**
- Consumes: `SpawnLayer`, `SpawnPhase` (tâche 7) ; `spawns-index.json` (tâche 6) ; `palIcon`, `gameName`.
- Produces: `SpawnPanel` — props `{ palId: string; phase: SpawnPhase; counts: { day: number; night: number }; onphase: (p: SpawnPhase) => void; onclear: () => void }`.

- [ ] **Step 1: Ajouter les clés i18n**

Dans `apps/web/messages/fr.json`, après `"map_view_pal": "Voir la fiche",` :

```json
  "map_spawn_day": "Jour",
  "map_spawn_night": "Nuit",
  "map_spawn_zones": "{count} zones",
  "map_spawn_clear": "Effacer les zones",
```

Dans `apps/web/messages/en.json`, après `"map_view_pal": "View Pal",` :

```json
  "map_spawn_day": "Day",
  "map_spawn_night": "Night",
  "map_spawn_zones": "{count} areas",
  "map_spawn_clear": "Clear areas",
```

- [ ] **Step 2: Écrire le panneau**

Créer `apps/web/src/lib/map/SpawnPanel.svelte` :

```svelte
<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import type { SpawnPhase } from './spawnLayer';

	let {
		palId,
		phase,
		counts,
		onphase,
		onclear
	}: {
		palId: string;
		phase: SpawnPhase;
		counts: { day: number; night: number };
		onphase: (p: SpawnPhase) => void;
		onclear: () => void;
	} = $props();
</script>

<div class="panel">
	<p class="head">
		{#if palIcon(palId)}
			<img src={palIcon(palId)} alt="" width="24" height="24" />
		{/if}
		<span class="name">{gameName(`pal:${palId}`)}</span>
	</p>
	<div class="segs">
		<button class="seg" class:on={phase === 'day'} aria-pressed={phase === 'day'} onclick={() => onphase('day')}>
			☀ {m.map_spawn_day()}
		</button>
		<button class="seg" class:on={phase === 'night'} aria-pressed={phase === 'night'} onclick={() => onphase('night')}>
			☾ {m.map_spawn_night()}
		</button>
	</div>
	<p class="count tnum">{m.map_spawn_zones({ count: counts[phase] })}</p>
	<button class="clear" onclick={onclear}>{m.map_spawn_clear()}</button>
</div>

<style>
	.panel {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 500;
		display: flex;
		flex-direction: column;
		gap: 6px;
		background: color-mix(in srgb, var(--surface-2) 92%, transparent);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		padding: 10px 12px;
		font-size: 13px;
		backdrop-filter: blur(4px);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 7px;
		margin: 0;
	}
	.name {
		font-weight: 600;
		color: var(--text-1);
	}
	.segs {
		display: flex;
		gap: 4px;
	}
	.seg {
		flex: 1;
		padding: 4px 8px;
		font-size: 12px;
	}
	.seg.on {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: var(--accent);
	}
	.count {
		margin: 0;
		font-size: 12px;
		color: var(--text-3);
	}
	.clear {
		font-size: 12px;
	}
</style>
```

- [ ] **Step 3: Câbler la page carte**

Dans `apps/web/src/routes/s/[slug]/map/+page.svelte` :

**3a.** Ajouter aux imports :

```ts
	import spawnsIndex from '@palworld-companion/game-data/spawns-index.json';
	import palsJson from '@palworld-companion/game-data/pals.json';
	import SpawnPanel from '$lib/map/SpawnPanel.svelte';
	import { SpawnLayer, type SpawnPhase } from '$lib/map/spawnLayer';
```

**3b.** Après `let markerController: MarkerController | undefined = $state();` :

```ts
	let spawnLayer: SpawnLayer | undefined = $state();

	const spawnCounts = spawnsIndex as Record<string, { day: number; night: number }>;
	const nocturnal = new Set(
		(palsJson as Array<{ id: string; nocturnal?: boolean }>)
			.filter((p) => p.nocturnal)
			.map((p) => p.id)
	);
	const spawnPal = $derived(mapState.filters.spawnPal);
	const spawnPhase = $derived(mapState.filters.spawnPhase);
```

**3c.** Dans le `$effect` de nettoyage, ajouter `spawnLayer?.destroy();` à côté de `markerController?.destroy();`.

**3d.** Dans `onMapReady`, après la création du `MarkerController` :

```ts
		spawnLayer = new SpawnLayer(leaflet, map, toLatLng);
```

**3e.** Après le `$effect` qui appelle `markerController?.sync(...)` :

```ts
	// Svelte -> Leaflet : zones de spawn du Pal sélectionné.
	$effect(() => {
		spawnLayer?.setPal(spawnPal, spawnPhase);
	});

	// Zones depuis la fiche d'un Pal : /map?pal=<palId>.
	// `zonedPal` est un `let` nu, PAS un $state : l'effet l'écrit, et le rendre
	// réactif créerait une auto-dépendance — « Effacer » le remettrait à null,
	// l'effet se relancerait avec ?pal= toujours dans l'URL, et les zones
	// reviendraient aussitôt.
	let zonedPal: string | null = null;
	$effect(() => {
		const palId = page.url.searchParams.get('pal');
		const layer = spawnLayer;
		if (!layer) return;
		if (!palId) {
			zonedPal = null;
			return;
		}
		if (palId === zonedPal || !spawnCounts[palId]) return;
		zonedPal = palId;
		mapState.filters.spawnPal = palId;
		// La phase persistée est écrasée : un Pal nocturne n'a souvent rien à
		// montrer de jour, et hériter du Pal précédent donnerait une carte vide.
		mapState.filters.spawnPhase = nocturnal.has(palId) ? 'night' : 'day';
		mapState.persist();
		// Après le flush des effets, la couche a chargé et dessiné les cercles.
		setTimeout(() => {
			const b = layer.bounds();
			if (b && mapRef) mapRef.fitBounds(b.pad(0.15));
		}, 0);
	});

	// Ne pas toucher à `zonedPal` ici : le laisser sur le Pal effacé est ce qui
	// empêche l'effet de le réafficher tant que ?pal= n'a pas changé.
	function clearSpawns() {
		mapState.filters.spawnPal = null;
		mapState.persist();
	}

	function setPhase(p: SpawnPhase) {
		mapState.filters.spawnPhase = p;
		mapState.persist();
	}
```

**3f.** Corriger `focusedId` — il n'est aujourd'hui jamais remis à zéro, donc quitter puis revenir sur un `?focus=` déjà vu ne recentre plus. **Laisser la déclaration `let focusedId: string | null = null;` telle quelle** (un `$state` s'auto-déclencherait, comme pour `zonedPal`) et remplacer seulement la garde `if (!id || !controller || id === focusedId) return;` par :

```ts
		if (!id) {
			focusedId = null;
			return;
		}
		if (!controller || id === focusedId) return;
```

**3g.** Dans le balisage, après `<FilterPanel … />` :

```svelte
	{#if spawnPal && spawnCounts[spawnPal]}
		<SpawnPanel
			palId={spawnPal}
			phase={spawnPhase}
			counts={spawnCounts[spawnPal]}
			onphase={setPhase}
			onclear={clearSpawns}
		/>
	{/if}
```

- [ ] **Step 4: Vérifier types et tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS

- [ ] **Step 5: Vérification visuelle**

Run: `pnpm --filter web dev`

- `http://localhost:5173/map?pal=Anubis` → zones translucides bleues, vue cadrée dessus, panneau en haut à droite avec le portrait et le nom.
- Basculer ☀ / ☾ → les zones changent ; le compteur suit.
- « Effacer les zones » → la couche disparaît, le panneau aussi.
- Recharger la page → la sélection est restaurée (persistance).
- `http://localhost:5173/map?pal=Inconnu` → aucune erreur console, aucun panneau.
- Cliquer un marqueur Alpha par-dessus une zone → la popup s'ouvre (les cercles ne capturent pas le clic).
- `http://localhost:5173/map?focus=<id d'un marqueur>` deux fois de suite → recentre à chaque fois.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/map/SpawnPanel.svelte apps/web/src/routes/s/\[slug\]/map/+page.svelte apps/web/messages/fr.json apps/web/messages/en.json
git commit -m "feat(web): panneau jour/nuit et ouverture de la carte par ?pal="
```

---

### Task 9: Entrée « zones de spawn » sur la fiche Pal

Complète la section créée en tâche 3.

**Files:**
- Modify: `apps/web/src/routes/s/[slug]/paldex/[palId]/+page.svelte`
- Modify: `apps/web/messages/fr.json`, `apps/web/messages/en.json`

**Interfaces:**
- Consumes: `spawns-index.json` (tâche 6) ; `alphaMarker`, classes `.locations` / `.loc-links` / `.loc-link` (tâche 3).
- Produces: rien.

- [ ] **Step 1: Ajouter les clés i18n**

Dans `apps/web/messages/fr.json`, après `"pal_locations_alpha": "Boss Alpha · Niv. {level}",` :

```json
  "pal_locations_zones": "Voir sur la carte · {count} zones",
```

Dans `apps/web/messages/en.json`, après `"pal_locations_alpha": "Alpha boss · Lv. {level}",` :

```json
  "pal_locations_zones": "View on map · {count} areas",
```

- [ ] **Step 2: Ajouter le lien**

Dans `apps/web/src/routes/s/[slug]/paldex/[palId]/+page.svelte`, ajouter à l'import :

```ts
	import spawnsIndex from '@palworld-companion/game-data/spawns-index.json';
```

À côté de `const alphaMarker = $derived(...)` :

```ts
	const spawnCount = $derived(
		(spawnsIndex as Record<string, { day: number; night: number }>)[pal.id]
	);
	// Le lien annonce la phase que la carte ouvrira par défaut.
	const spawnZones = $derived(
		spawnCount ? (pal.nocturnal ? spawnCount.night : spawnCount.day) : 0
	);
```

Remplacer la garde de la section par `{#if alphaMarker || spawnZones > 0}` et ajouter, **avant** le lien Alpha dans `.loc-links` :

```svelte
			{#if spawnZones > 0}
				<a class="loc-link" href={appHref(`/map?pal=${pal.id}`)}>
					{m.pal_locations_zones({ count: spawnZones })}
				</a>
			{/if}
```

- [ ] **Step 3: Vérifier types et tests**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: PASS

- [ ] **Step 4: Vérification visuelle complète**

Run: `pnpm --filter web dev`

- `/paldex/Anubis` → deux boutons (zones + Boss Alpha) ; le premier ouvre la carte sur les zones, le second sur le marqueur.
- `/paldex/Lamball` → un seul bouton (zones), pas d'Alpha.
- Un Pal nocturne (`pal.nocturnal` vrai) → le compteur affiche les zones de nuit, et la carte s'ouvre en phase nuit.
- Un Pal ni zoné ni Alpha → section absente.
- `/paldex/VolcanicMonster` → le portrait s'affiche (effet de la tâche 1, après régénération d'`icons.json`).
- Mode invité : `/paldex/Anubis` (sans `/s/<slug>/`) → les liens restent corrects. En `/en/paldex/Anubis` aussi.

- [ ] **Step 5: Vérification finale de l'ensemble**

```bash
pnpm --filter @palworld-companion/pipeline test
pnpm --filter @palworld-companion/pipeline verify
pnpm --filter web check
pnpm --filter web test
pnpm --filter web build
```

Expected: tout PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/s/\[slug\]/paldex/\[palId\]/+page.svelte apps/web/messages/fr.json apps/web/messages/en.json
git commit -m "feat(web): lien vers les zones de spawn depuis la fiche Pal"
```

---

## Notes pour l'exécutant

**Ce qui n'est pas dans ce plan, volontairement :**
- Aucun test sur `spawnLayer.ts` ni `SpawnPanel.svelte` : ils exigeraient une infrastructure de test Leaflet/DOM qui n'existe pas dans ce dépôt. Ils sont vérifiés à l'écran (tâche 8, étape 5).
- Aucun filtre par Pal dans le `FilterPanel` : la sélection passe par `?pal=`, depuis la fiche ou la palette de recherche.
- Les spawns de donjons, de pêche et les patrouilles de PNJ ne sont pas couverts — `DT_PaldexDistributionData` ne les contient pas.

**Pièges connus :**
- `icons.json`, `markers.json`, `spawns-index.json` et `apps/web/static/spawns/` sont des artefacts **commités**. Ils ne se régénèrent que par le pipeline, qui exige les exports FModel. Ne jamais les éditer à la main.
- `pnpm --filter web check` échoue tant que la tâche 8 n'est pas terminée si la tâche 7 est livrée seule : `MapFilters` a gagné deux champs obligatoires. C'est signalé dans la tâche 7.
- Les clés Paraglide doivent exister dans **les deux** catalogues, sinon le build échoue sur la locale manquante.
