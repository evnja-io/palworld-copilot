# Barre latérale de la carte — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les trois cases à cocher de la carte par une barre latérale à rail : sept catégories réelles, liste de résultats cliquable et cochable, partage par lien, feuille glissante sur mobile.

**Architecture :** Le pipeline devient la source unique de vérité des catégories — `markers.json` gagne les types `boss`, `tower`, `watchtower` et perd ses 33 ids dupliqués. Côté web, deux modules purs (`categories.ts`, `query.ts`) portent la logique et les tests ; les composants de `lib/map/sidebar/` restent fins. Leaflet garde la propriété du DOM de la carte : `MarkerController.sync()` continue de diffuser un état dérivé, jamais un composant Svelte par marqueur.

**Tech Stack :** SvelteKit 2 / Svelte 5 (runes), TypeScript, Vitest, Paraglide (FR/EN), Leaflet, Drizzle + Neon, pnpm monorepo, `tsx` pour les scripts de pipeline.

**Spec :** `docs/superpowers/specs/2026-07-26-carte-barre-laterale-design.md`

## Global Constraints

- **Aucune nouvelle dépendance.** Tout se fait avec l'existant.
- **Interface et commentaires de code en français.** Les libellés visibles passent par Paraglide (`messages/fr.json` + `messages/en.json`), jamais en dur.
- **Jetons de `apps/web/src/app.css` uniquement** — pas de couleur littérale ; profondeur par bordures et paliers de surface, pas d'ombres.
- **Thème sombre uniquement** (`color-scheme: dark`).
- **Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`) — les runes sont forcées dans `vite.config.ts`.
- **Node ≥ 22, pnpm 11.** Commandes ciblées par `--filter`.
- **Densité confortable :** lignes ≈ 34–36 px, texte 13 px, métadonnées 12 px, libellés capitalisés 10–11 px. Cibles tactiles 44 px minimum sur mobile.
- **Chiffres qui changent en place :** classe `.tnum`.
- **Accessibilité :** `aria-current` sur la tuile sélectionnée, `aria-label` sur tout contrôle iconique, focus visible hérité de `app.css`.
- **Pluriels français explicites** (`1 cible` / `2 cibles`) — jamais de `s` inconditionnel.
- **Pas de virtualisation de liste** : au pire 138 lignes pour une catégorie.
- **Ne pas casser** `?pal=` ni `?focus=`, ni le contrat « Leaflet possède le DOM, Svelte l'état ».

## Ordre et dépendances

```
T1 (données pipeline) ─► T2 (types & consommateurs) ─► T3 (registre serveur)
                                    │
                                    └─► T4 (modules purs) ─► T5 (état + URL) ─► T6 (composants)
                                                                                     │
                                                                                     └─► T7 (câblage carte) ─► T8 (mobile + i18n) ─► T9 (docs)
```

T1 est bloquant pour tout le reste : sans ids uniques, aucune liste keyée ne rend.

---

### Task 1 : Normaliser `markers.json` (dédoublonnage + classification)

**Contexte pour l'implémenteur :** `packages/pipeline/src/transform/markers.ts` produit `markers.json` à partir de DataTables extraites du jeu. **Ces DataTables ne sont pas dans le dépôt** (`packages/pipeline/raw/` ne contient que `community/`) : on ne peut donc pas régénérer `markers.json` en lançant le transform. La logique de normalisation est donc extraite dans un module pur, utilisé à la fois par le transform (pour les futures régénérations) et par un script qui réécrit le fichier déjà commité (pour maintenant). Le module est idempotent : le relancer ne change rien.

**Files:**
- Create: `packages/pipeline/src/transform/markers.lib.ts`
- Create: `packages/pipeline/src/transform/markers.lib.test.ts`
- Create: `packages/pipeline/src/normalize-markers.ts`
- Modify: `packages/pipeline/src/transform/markers.ts`
- Modify: `packages/pipeline/package.json` (ajout du script `markers:normalize`)
- Modify: `packages/pipeline/src/verify.ts`
- Modify: `packages/game-data/markers.json` (réécrit par le script)

**Interfaces:**
- Consumes: rien.
- Produces:
  - `type MarkerType = "relic" | "alpha" | "boss" | "tower" | "watchtower" | "ft"`
  - `type Marker = { id: string; type: MarkerType; px: number; py: number; nameId?: string; meta?: { palId?: string; level?: number } }`
  - `TOWER_FT_IDS: ReadonlySet<string>`
  - `classifyFt(nameId: string | undefined): MarkerType`
  - `classifyBossSpawner(palId: string | undefined): "alpha" | "boss"`
  - `normalizeMarkers(markers: Marker[]): Marker[]`
  - `assertMarkerCounts(markers: Marker[]): Record<MarkerType, number>`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `packages/pipeline/src/transform/markers.lib.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  assertMarkerCounts,
  classifyBossSpawner,
  classifyFt,
  normalizeMarkers,
  TOWER_FT_IDS,
  type Marker,
} from "./markers.lib.js";

const mk = (id: string, type: Marker["type"], extra: Partial<Marker> = {}): Marker => ({
  id,
  type,
  px: 100,
  py: 200,
  ...extra,
});

describe("classifyFt", () => {
  it("classe les huit entrées de tours de boss", () => {
    expect(TOWER_FT_IDS.size).toBe(8);
    for (const id of TOWER_FT_IDS) expect(classifyFt(id)).toBe("tower");
  });

  it("classe les tours d'observation", () => {
    expect(classifyFt("WatchTower_1")).toBe("watchtower");
    expect(classifyFt("WatchTower_22")).toBe("watchtower");
  });

  it("laisse le reste en voyage rapide", () => {
    expect(classifyFt("FTPoint1")).toBe("ft");
    expect(classifyFt("SkyIsland_A")).toBe("ft");
    expect(classifyFt(undefined)).toBe("ft");
  });

  it("ne se fie pas au libellé : Boss_KingWhale n'est pas une tour", () => {
    expect(classifyFt("Boss_KingWhale")).toBe("ft");
  });
});

describe("classifyBossSpawner", () => {
  it("sépare les Pals des PNJ", () => {
    expect(classifyBossSpawner("Anubis")).toBe("alpha");
    expect(classifyBossSpawner("None")).toBe("boss");
    expect(classifyBossSpawner(undefined)).toBe("boss");
    expect(classifyBossSpawner("")).toBe("boss");
  });
});

describe("normalizeMarkers", () => {
  it("rend les ids uniques par suffixe numérique", () => {
    const out = normalizeMarkers([
      mk("alpha_BOSS_X", "alpha", { px: 1, py: 1, meta: { palId: "None" } }),
      mk("alpha_BOSS_X", "alpha", { px: 2, py: 2, meta: { palId: "None" } }),
      mk("alpha_BOSS_X", "alpha", { px: 3, py: 3, meta: { palId: "None" } }),
    ]);
    expect(out.map((m) => m.id)).toEqual(["alpha_BOSS_X", "alpha_BOSS_X_2", "alpha_BOSS_X_3"]);
  });

  it("évite un suffixe déjà pris", () => {
    const out = normalizeMarkers([
      mk("a", "relic", { px: 1, py: 1 }),
      mk("a", "relic", { px: 2, py: 2 }),
      mk("a_2", "relic", { px: 3, py: 3 }),
    ]);
    expect(new Set(out.map((m) => m.id)).size).toBe(3);
    expect(out.map((m) => m.id)).toContain("a_3");
  });

  it("reclasse les spawners PNJ en boss et garde les Pals en alpha", () => {
    const out = normalizeMarkers([
      mk("alpha_1", "alpha", { meta: { palId: "Anubis", level: 47 } }),
      mk("alpha_2", "alpha", { meta: { palId: "None", level: 23 } }),
    ]);
    expect(out.find((m) => m.id === "alpha_1")!.type).toBe("alpha");
    expect(out.find((m) => m.id === "alpha_2")!.type).toBe("boss");
  });

  it("reclasse les points de voyage rapide en tours", () => {
    const out = normalizeMarkers([
      mk("ft_a", "ft", { nameId: "FTPoint45" }),
      mk("ft_b", "ft", { nameId: "WatchTower_3" }),
      mk("ft_c", "ft", { nameId: "FTPoint1" }),
    ]);
    expect(out.map((m) => m.type)).toEqual(["tower", "watchtower", "ft"]);
  });

  it("est idempotent et déterministe", () => {
    const input = [
      mk("b", "ft", { nameId: "FTPoint45" }),
      mk("a", "alpha", { meta: { palId: "None" } }),
      mk("a", "alpha", { px: 9, py: 9, meta: { palId: "None" } }),
    ];
    const once = normalizeMarkers(input);
    const twice = normalizeMarkers(once);
    expect(twice).toEqual(once);
  });

  it("trie par id pour un diff stable", () => {
    const out = normalizeMarkers([mk("z", "relic"), mk("a", "relic")]);
    expect(out.map((m) => m.id)).toEqual(["a", "z"]);
  });
});

describe("assertMarkerCounts", () => {
  it("refuse un id dupliqué", () => {
    const dup = [mk("a", "relic"), mk("a", "relic")];
    expect(() => assertMarkerCounts(dup)).toThrow(/dupliqué/i);
  });

  it("refuse un nombre de tours inattendu", () => {
    const markers = [mk("t", "tower")];
    expect(() => assertMarkerCounts(markers)).toThrow(/tower/i);
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run: `pnpm --filter @palworld-companion/pipeline test src/transform/markers.lib.test.ts`
Expected: FAIL — `Failed to resolve import "./markers.lib.js"`.

- [ ] **Step 3 : Écrire le module**

Créer `packages/pipeline/src/transform/markers.lib.ts` :

```ts
// Normalisation des marqueurs : classification en catégories et unicité des ids.
// Module pur (testable sans DataTables), partagé par transform/markers.ts et
// par le script normalize-markers.ts.

export type MarkerType = "relic" | "alpha" | "boss" | "tower" | "watchtower" | "ft";

export type Marker = {
  id: string;
  type: MarkerType;
  px: number;
  py: number;
  nameId?: string;
  meta?: { palId?: string; level?: number };
};

/** Entrées des arènes de tours de boss, par `nameId` de point de voyage rapide.
 *  Ids stables : les noms sont localisés, une regex dessus casserait en EN. */
export const TOWER_FT_IDS: ReadonlySet<string> = new Set([
  "FTPoint45", // Syndicat de Rayne
  "Boss_Forest", // Ligue pour la Protection des Pals
  "FTPoint3", // Confrérie des Flammes Éternelles
  "FTPoint20", // Unité de Recherche Génétique
  "FTPoint67", // Clan des Fleurs Lunaires
  "FTPoint9", // Milice Populaire
  "FTPoint76", // Paradis Déchu
  "SkyIsland_BOSS", // Alliance Azurée
]);

/** Volumétrie attendue par catégorie. Bornes larges sur alpha/boss : une mise à
 *  jour du jeu peut en ajouter, un écart franc signale une régression. */
const EXPECTED: Record<MarkerType, [min: number, max: number]> = {
  relic: [120, 200],
  alpha: [75, 95],
  boss: [60, 80],
  tower: [8, 8],
  watchtower: [20, 24],
  ft: [110, 140],
};

export function classifyFt(nameId: string | undefined): MarkerType {
  if (!nameId) return "ft";
  if (TOWER_FT_IDS.has(nameId)) return "tower";
  if (nameId.startsWith("WatchTower_")) return "watchtower";
  return "ft";
}

/** `DT_BossSpawnerLoactionData` mélange boss de Pals et boss humains : ces
 *  derniers n'ont pas de CharacterID exploitable (`None`). */
export function classifyBossSpawner(palId: string | undefined): "alpha" | "boss" {
  return palId && palId !== "None" ? "alpha" : "boss";
}

function reclassify(mk: Marker): Marker {
  if (mk.type === "alpha" || mk.type === "boss") {
    const type = classifyBossSpawner(mk.meta?.palId);
    // « None » est un sentinelle de DataTable, pas un id de Pal : le laisser
    // fuiter donnerait un nom « None » et un lien /paldex/None en 404 côté web.
    if (type === "boss" && mk.meta?.palId) {
      const { palId: _drop, ...meta } = mk.meta;
      return { ...mk, type, meta };
    }
    return { ...mk, type };
  }
  if (mk.type === "ft" || mk.type === "tower" || mk.type === "watchtower") {
    return { ...mk, type: classifyFt(mk.nameId) };
  }
  return mk;
}

/** Reclasse, dédoublonne les ids, trie. Idempotent : appliquer deux fois donne
 *  le même résultat, ce qui permet de réparer un fichier déjà commité. */
export function normalizeMarkers(markers: Marker[]): Marker[] {
  // Tri AVANT dédoublonnage : l'affectation des suffixes doit être
  // déterministe, sinon une régénération produit un diff pour rien.
  const sorted = [...markers]
    .map(reclassify)
    .sort((a, b) => a.id.localeCompare(b.id) || a.px - b.px || a.py - b.py);

  const taken = new Set<string>();
  return sorted.map((mk) => {
    if (!taken.has(mk.id)) {
      taken.add(mk.id);
      return mk;
    }
    let n = 2;
    while (taken.has(`${mk.id}_${n}`)) n++;
    const id = `${mk.id}_${n}`;
    taken.add(id);
    return { ...mk, id };
  });
}

/** Lève si un id est dupliqué ou si une catégorie sort de ses bornes. */
export function assertMarkerCounts(markers: Marker[]): Record<MarkerType, number> {
  const seen = new Set<string>();
  for (const mk of markers) {
    if (seen.has(mk.id)) throw new Error(`id dupliqué : ${mk.id}`);
    seen.add(mk.id);
  }
  const counts = Object.fromEntries(
    (Object.keys(EXPECTED) as MarkerType[]).map((t) => [t, markers.filter((m) => m.type === t).length]),
  ) as Record<MarkerType, number>;
  for (const [type, [min, max]] of Object.entries(EXPECTED) as Array<[MarkerType, [number, number]]>) {
    const n = counts[type];
    if (n < min || n > max) throw new Error(`${type} suspect : ${n} (attendu ${min}–${max})`);
  }
  return counts;
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier le succès**

Run: `pnpm --filter @palworld-companion/pipeline test src/transform/markers.lib.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5 : Brancher le transform sur le module**

Dans `packages/pipeline/src/transform/markers.ts`, remplacer la déclaration de type locale et le bloc final de tri/assertions.

Remplacer l'en-tête (lignes 1–14) par :

```ts
import { readFileSync } from "node:fs";
import { loadDataTableRows, must, pick, writeGameData } from "../lib.js";
import { worldToPixel } from "./coord.js";
import { assertMarkerCounts, normalizeMarkers, type Marker } from "./markers.lib.js";

const markers: Marker[] = [];
const communityDir = new URL("../../raw/community/", import.meta.url).pathname;
```

Remplacer le bloc final (à partir de `markers.sort(...)`) par :

```ts
const out = normalizeMarkers(markers);
const counts = assertMarkerCounts(out);
console.log(`  (${treeSkipped} POI de l'Arbre-Monde exclus - carte séparée, hors v1)`);

writeGameData("markers.json", out);
console.log(
  `markers OK (${counts.relic} effigies, ${counts.alpha} alphas, ${counts.boss} boss PNJ, ` +
    `${counts.tower} tours, ${counts.watchtower} tours d'observation, ${counts.ft} voyages rapides)`,
);
```

Le `push` des boss (ligne ~37) garde `type: "alpha"` : `normalizeMarkers` reclasse en `boss` selon `palId`. Idem pour les points de voyage rapide qui gardent `type: "ft"`.

- [ ] **Step 6 : Écrire le script de normalisation du fichier commité**

Créer `packages/pipeline/src/normalize-markers.ts` :

```ts
// Réécrit packages/game-data/markers.json en place : reclassement en catégories
// et unicité des ids. Nécessaire parce que les DataTables du jeu ne sont pas
// dans le dépôt — on ne peut pas relancer le transform pour réparer les données
// déjà commitées. Idempotent : relancer ne produit aucun diff.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR } from "./paths.js";
import { assertMarkerCounts, normalizeMarkers, type Marker } from "./transform/markers.lib.js";
import { writeGameData } from "./lib.js";

const before = JSON.parse(readFileSync(join(OUT_DIR, "markers.json"), "utf8")) as Marker[];
const after = normalizeMarkers(before);
const counts = assertMarkerCounts(after);

const renamed = after.filter((mk, i) => before[i]?.id !== mk.id).length;
writeGameData("markers.json", after);
console.log(
  `markers.json normalisé : ${after.length} marqueurs — ` +
    `${counts.relic} effigies, ${counts.alpha} alphas, ${counts.boss} boss PNJ, ` +
    `${counts.tower} tours, ${counts.watchtower} observation, ${counts.ft} voyage rapide` +
    (renamed ? ` (${renamed} ids réaffectés)` : ""),
);
```

Ajouter dans `packages/pipeline/package.json`, dans `scripts`, juste après `"verify"` :

```json
    "markers:normalize": "tsx src/normalize-markers.ts",
```

- [ ] **Step 7 : Lancer le script sur les données commitées**

Run: `pnpm --filter @palworld-companion/pipeline markers:normalize`
Expected: `markers.json normalisé : 414 marqueurs — 138 effigies, 83 alphas, 36 boss PNJ, 8 tours, 20 observation, 129 voyage rapide (33 doublons fusionnés)`

> **Correction post-implémentation (revue de branche complète, 2026-07-26) :**
> les 33 « ids réaffectés » n'étaient pas 33 spawners à des emplacements
> différents partageant un `SpawnerID` - c'était 33 doublons **exacts**
> (`DT_BossSpawnerLoactionData` contient chaque boss PNJ deux fois : même id,
> même position, même niveau). Le suffixe `_2` était donc la mauvaise
> réparation : la bonne est de dédoublonner ces entrées, pas de les
> renommer pour les garder toutes les deux. Voir `docs/decisions.md`,
> « Catégories de marqueurs et ids uniques », pour le détail vérifié sur les
> données. Les valeurs `Expected:` de ce plan ont été remises à jour (414 au
> total, 36 boss) ; seuls les blocs explicitement marqués comme historiques
> conservent les anciens chiffres.

Vérifier l'unicité et les volumes :

```bash
node -e "
const m=require('./packages/game-data/markers.json');
const ids=new Set(m.map(x=>x.id));
console.log('marqueurs', m.length, '| ids uniques', ids.size);
const by={}; for(const x of m) by[x.type]=(by[x.type]||0)+1;
console.log(by);
if (ids.size !== m.length) throw new Error('ids dupliqués');
"
```
Expected (historique, avant correction du 2026-07-26 — voir note ci-dessus) : `447 | 447` et `{ relic: 138, alpha: 83, boss: 69, tower: 8, watchtower: 20, ft: 129 }`. Valeur actuelle après dédoublonnage des 33 boss PNJ identiques : `414 | 414` et `{ relic: 138, alpha: 83, boss: 36, tower: 8, watchtower: 20, ft: 129 }`.

Relancer le script pour prouver l'idempotence :

Run: `pnpm --filter @palworld-companion/pipeline markers:normalize && git diff --stat packages/game-data/markers.json`
Expected: le second passage affiche `0 ids réaffectés` et `git diff` ne montre qu'un seul diff cumulé (celui du premier passage).

- [ ] **Step 8 : Ajouter le garde-fou dans `verify.ts`**

Dans `packages/pipeline/src/verify.ts`, juste après la ligne `if (markers.length < 400) fail(...)` (ligne ~28), ajouter :

```ts
// Unicité des ids : MarkerController indexe par id et toute liste keyée côté web
// lève each_key_duplicate sur un doublon (33 doublons constatés le 2026-07-26).
{
  const ids = new Set<string>();
  const dups = (markers as Array<{ id: string }>).filter((mk) => !ids.has(mk.id) ? (ids.add(mk.id), false) : true);
  if (dups.length) fail(`markers: ${dups.length} ids dupliqués (ex. ${dups[0].id})`);
  const byType = (markers as Array<{ type: string }>).reduce<Record<string, number>>((acc, mk) => {
    acc[mk.type] = (acc[mk.type] ?? 0) + 1;
    return acc;
  }, {});
  if (byType.tower !== 8) fail(`markers: ${byType.tower} tours (attendu 8)`);
  if (!byType.boss) fail("markers: aucun boss PNJ - classification perdue ?");
}
```

- [ ] **Step 9 : Lancer la suite pipeline complète**

Run: `pnpm --filter @palworld-companion/pipeline test`
Expected: PASS, tous fichiers.

Note : `pnpm --filter @palworld-companion/pipeline verify` nécessite l'ensemble des artefacts game-data et peut être lancé tel quel — il lit `packages/game-data/`, pas `raw/`.

Run: `pnpm --filter @palworld-companion/pipeline verify`
Expected: PASS.

- [ ] **Step 10 : Commit**

```bash
git add packages/pipeline/src/transform/markers.lib.ts \
        packages/pipeline/src/transform/markers.lib.test.ts \
        packages/pipeline/src/transform/markers.ts \
        packages/pipeline/src/normalize-markers.ts \
        packages/pipeline/src/verify.ts \
        packages/pipeline/package.json \
        packages/game-data/markers.json
git commit -m "fix(carte): ids de marqueurs uniques et classification en 6 types

33 SpawnerID occupaient deux emplacements : autant de marqueurs jamais
affichés (MarkerController indexe par id) et un each_key_duplicate sur
toute liste keyée. Les huit arènes de tours et les 20 tours d'observation
sortent des points de voyage rapide, les 69 boss humains sortent des alphas."
```

---

### Task 2 : Propager le type élargi aux consommateurs

**Contexte :** six valeurs de `type` circulent maintenant. Les consommateurs qui font `mk.type === "ft"` ou typent `"alpha" | "ft" | "relic"` doivent suivre, sinon la palette de recherche perd les tours et les marqueurs perdent leur glyphe.

**Files:**
- Modify: `packages/pipeline/src/search-index.ts`
- Modify: `apps/web/src/lib/search/tokens.ts`
- Modify: `apps/web/src/lib/search/engine.ts:82`
- Modify: `apps/web/src/lib/components/CommandPalette.svelte`
- Modify: `apps/web/src/lib/map/markerController.ts`
- Modify: `apps/web/src/lib/map/LeafletMap.svelte`
- Modify: `apps/web/src/lib/map/MarkerPopup.svelte`
- Test: `apps/web/src/lib/map/markerController.test.ts`

**Interfaces:**
- Consumes: `MarkerType` de la Task 1 (mais redéclaré côté web : `apps/web` n'importe pas de `packages/pipeline`).
- Produces:
  - `apps/web/src/lib/search/tokens.ts` : `MarkerType = "alpha" | "boss" | "tower" | "watchtower" | "ft" | "relic"`, `MARKER_LABELS: Record<MarkerType, L10n>`
  - `apps/web/src/lib/map/markerController.ts` : `MapMarker["type"]` élargi au même jeu, `markerHtml(mk, checked)` inchangé de signature.

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans `apps/web/src/lib/map/markerController.test.ts` (garder les tests existants) :

```ts
	it("rend un glyphe distinct pour chaque nouveau type", () => {
		expect(markerHtml({ id: "b", type: "boss", px: 0, py: 0 }, false)).toContain("mk-boss");
		expect(markerHtml({ id: "t", type: "tower", px: 0, py: 0 }, false)).toContain("mk-tower");
		expect(markerHtml({ id: "w", type: "watchtower", px: 0, py: 0 }, false)).toContain("mk-watchtower");
	});

	it("affiche le niveau d'un boss PNJ comme celui d'un alpha", () => {
		const html = markerHtml({ id: "b", type: "boss", px: 0, py: 0, meta: { level: 30 } }, false);
		expect(html).toContain("<i>30</i>");
	});
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run: `pnpm --filter web test src/lib/map/markerController.test.ts`
Expected: FAIL — le type `"boss"` n'existe pas dans `MapMarker`, `mk-boss` absent.

- [ ] **Step 3 : Élargir `markerController.ts`**

Dans `apps/web/src/lib/map/markerController.ts`, remplacer le type et la table de glyphes :

```ts
export type MapMarker = {
  id: string;
  type: "relic" | "alpha" | "boss" | "tower" | "watchtower" | "ft";
  px: number;
  py: number;
  nameId?: string;
  meta?: { palId?: string; level?: number };
};

export type MarkerClickHandler = (marker: MapMarker, leafletMarker: L.Marker) => void;

const GLYPH: Record<MapMarker["type"], string> = {
  relic: "✦",
  alpha: "▲",
  boss: "☠",
  tower: "⌂",
  watchtower: "⌖",
  ft: "◆",
};
```

Puis, dans `markerHtml`, généraliser le niveau et le portrait aux deux catégories de boss :

```ts
/** HTML du divIcon. Les Alpha portent le portrait de leur Pal ; les boss PNJ et
 *  les icônes absentes gardent le glyphe. */
export function markerHtml(mk: MapMarker, checked: boolean): string {
  const hasLevel = mk.type === "alpha" || mk.type === "boss";
  const level = hasLevel && mk.meta?.level ? `<i>${mk.meta.level}</i>` : "";
  const icon = mk.type === "alpha" && mk.meta?.palId ? palIcon(mk.meta.palId) : undefined;
  const body = icon ? `<img src="${icon}" alt="" width="18" height="18" />` : GLYPH[mk.type];
  const cls = `mk mk-${mk.type}${icon ? " mk-pal" : ""}${checked ? " mk-checked" : ""}`;
  return `<span class="${cls}">${body}${level}</span>`;
}
```

- [ ] **Step 4 : Ajouter les couleurs de marqueur**

Dans `apps/web/src/lib/map/LeafletMap.svelte`, après le bloc `:global(.mk-ft)`, ajouter :

```css
	:global(.mk-boss) {
		--mk-color: var(--el-dark);
	}
	:global(.mk-tower) {
		--mk-color: var(--el-electricity);
	}
	:global(.mk-watchtower) {
		--mk-color: var(--el-ice);
	}
```

- [ ] **Step 5 : Lancer les tests pour vérifier le succès**

Run: `pnpm --filter web test src/lib/map/markerController.test.ts`
Expected: PASS.

- [ ] **Step 6 : Élargir les facettes de recherche**

Dans `apps/web/src/lib/search/tokens.ts`, remplacer la ligne 5 :

```ts
export type MarkerType = "alpha" | "boss" | "tower" | "watchtower" | "ft" | "relic";
```

et compléter `MARKER_LABELS` (chercher `Record<MarkerType, L10n>` vers la ligne 73) avec les trois nouvelles entrées, en gardant les existantes :

```ts
  boss: { fr: "Boss humains", en: "Human bosses" },
  tower: { fr: "Tours de boss", en: "Boss towers" },
  watchtower: { fr: "Tours d'observation", en: "Watchtowers" },
```

- [ ] **Step 7 : Corriger le filtre de progression du moteur de recherche**

Dans `apps/web/src/lib/search/engine.ts`, remplacer le corps du `case "progress"` (ligne ~80) :

```ts
    case "progress": {
      // Tous les marqueurs sont cochables depuis la barre latérale ; seules les
      // entrées non-marqueur (pals, techs…) sortent de ce filtre.
      if (!e.mk) return false;
      const checked = ctx.checked?.has(rawId(e)) ?? false;
      return t.value === "checked" ? checked : !checked;
    }
```

- [ ] **Step 8 : Indexer les nouveaux types dans la recherche**

Dans `packages/pipeline/src/search-index.ts`, élargir le champ `mk` du type `Entry` (ligne ~18) :

```ts
  mk?: "alpha" | "boss" | "tower" | "watchtower" | "ft" | "relic"; // type de marqueur
```

puis remplacer la boucle sur `markers.json` (à partir de `for (const mk of load("markers.json"))`) :

```ts
for (const mk of load("markers.json")) {
  const base = { id: `marker:${mk.id}`, mk: mk.type, px: mk.px, py: mk.py };
  if (mk.type === "alpha") {
    const n = mk.meta?.palId ? names(`pal:${mk.meta.palId}`) : null;
    if (!n) continue;
    index.push({ ...base, ...n, lvl: mk.meta.level, pal: mk.meta.palId });
  } else if (mk.type === "boss") {
    // Les boss humains n'ont pas d'entrée L10N : nom dérivé du SpawnerID.
    const label = mk.id.replace(/^alpha_(?:BOSS_)?/i, "").replaceAll("_", " ").trim();
    index.push({ ...base, fr: label, en: label, lvl: mk.meta?.level });
  } else if (mk.type === "ft" || mk.type === "tower" || mk.type === "watchtower") {
    const n = mk.nameId ? names(`ft:${mk.nameId}`) : null;
    if (!n) continue;
    index.push({ ...base, ...n });
  } else {
    const c = coords(mk.px, mk.py);
    index.push({ ...base, fr: `Effigie Lifmunk ${c}`, en: `Lifmunk Effigy ${c}` });
  }
}
```

- [ ] **Step 9 : Régénérer l'index de recherche**

Run: `pnpm --filter @palworld-companion/pipeline exec tsx src/search-index.ts`
Expected: `search-index OK (… marker <n> …)` avec `n` ≈ 414.

Vérifier qu'une tour est indexée :

```bash
node -e "
const i=require('./packages/game-data/search-index.json');
const t=i.filter(e=>e.mk==='tower');
console.log('tours indexées', t.length);
console.log(t.map(e=>e.fr));
const b=i.filter(e=>e.mk==='boss');
console.log('boss PNJ indexés', b.length, '| ex.', b[0] && b[0].fr);
"
```
Expected: `tours indexées 8`, huit noms de tours, `boss PNJ indexés 36`.

- [ ] **Step 10 : Adapter les badges de la palette**

Dans `apps/web/src/lib/components/CommandPalette.svelte`, chercher `MK_GLYPH` et compléter la table avec les trois nouveaux types (mêmes glyphes que `markerController.ts` : `boss: '☠'`, `tower: '⌂'`, `watchtower: '⌖'`).

Puis, dans le bloc `<span class="badges">` (vers la ligne 320), remplacer les trois branches marqueur :

```svelte
										{#if e.mk === 'relic'}
											<span class="check" class:on={checked.has(rawId(e))} aria-hidden="true">
												{checked.has(rawId(e)) ? '✓' : '○'}
											</span>
										{:else if (e.mk === 'alpha' || e.mk === 'boss') && e.lvl}
											<span class="muted tnum">{m.map_level({ level: e.lvl })}</span>
										{:else if e.mk === 'ft' || e.mk === 'tower' || e.mk === 'watchtower'}
											<span class="muted">{MARKER_LABELS[e.mk][locale]}</span>
										{/if}
```

- [ ] **Step 11 : Adapter la popup**

Dans `apps/web/src/lib/map/MarkerPopup.svelte`, remplacer la branche `alpha` et la branche finale :

```svelte
	{:else if marker.type === 'alpha' || marker.type === 'boss'}
		<strong class="alpha-name">
			{#if marker.meta?.palId && palIcon(marker.meta.palId)}
				<img src={palIcon(marker.meta.palId)} alt="" width="28" height="28" />
			{/if}
			{marker.meta?.palId
				? gameName(`pal:${marker.meta.palId}`)
				: marker.id.replace(/^alpha_(?:BOSS_)?/i, '').replaceAll('_', ' ')}
		</strong>
		{#if marker.meta?.level}<span class="level tnum">{m.map_level({ level: marker.meta.level })}</span>{/if}
		<span class="coords tnum">({coords[0]}, {coords[1]})</span>
		{#if marker.meta?.palId}
			<a href={appHref(`/paldex/${marker.meta.palId}`)} class="link">{m.map_view_pal()}</a>
		{/if}
	{:else}
		<strong>{marker.nameId ? gameName(`ft:${marker.nameId}`) : m.map_cat_ft()}</strong>
		<span class="coords tnum">({coords[0]}, {coords[1]})</span>
	{/if}
```

À cette étape, écrire `m.map_filter_ft()` (la clé qui existe aujourd'hui) : `map_cat_ft` n'est créée qu'en Task 4. La Task 8 Step 6 fait le renommage groupé de toutes les clés obsolètes, y compris celle-ci.

- [ ] **Step 12 : Vérifier l'ensemble**

Run: `pnpm --filter web check && pnpm --filter web test && pnpm --filter @palworld-companion/pipeline test`
Expected: 0 erreur, tous les tests passent.

- [ ] **Step 13 : Commit**

```bash
git add packages/pipeline/src/search-index.ts packages/game-data/search-index.json \
        apps/web/src/lib/search/tokens.ts apps/web/src/lib/search/engine.ts \
        apps/web/src/lib/components/CommandPalette.svelte \
        apps/web/src/lib/map/markerController.ts apps/web/src/lib/map/markerController.test.ts \
        apps/web/src/lib/map/LeafletMap.svelte apps/web/src/lib/map/MarkerPopup.svelte
git commit -m "feat(carte): glyphes, couleurs et recherche pour boss PNJ et tours"
```

---

### Task 3 : Rendre tous les marqueurs cochables (registre serveur)

**Contexte :** `lib/server/progress.ts` n'autorise que les ids `relic_*` sous le kind `marker`. On élargit ce kind à tous les ids de `markers.json` : aucune migration, aucun changement de schéma, les lignes existantes restent valides, et les deux fusions d'import (`packages/pipeline/src/import-lib.ts`, `apps/web/src/lib/server/import.ts`) restent inchangées puisqu'elles écrivent déjà des ids `relic_*` sous le kind `marker`.

Le tableau de bord doit rester honnête : sa tuile « Effigies » compte les lignes du kind `marker`, qui vont maintenant inclure boss et tours. On la retitre en « Carte » avec pour total l'ensemble des marqueurs.

**Files:**
- Modify: `apps/web/src/lib/server/progress.ts:10-19`
- Modify: `apps/web/src/lib/server/import.ts:6`
- Modify: `apps/web/src/routes/s/[slug]/+page.server.ts:9-13`
- Modify: `apps/web/src/routes/s/[slug]/+page.svelte:33-40,98`
- Create: `apps/web/src/lib/server/progress.test.ts`

**Interfaces:**
- Consumes: `markers.json` normalisé (Task 1).
- Produces: `isValidEntity("marker", <tout id de markers.json>) === true`.

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `apps/web/src/lib/server/progress.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import markers from "@palworld-companion/game-data/markers.json";
import { isValidEntity, isValidKind } from "./progress";

const byType = (t: string) =>
	(markers as Array<{ id: string; type: string }>).filter((mk) => mk.type === t);

describe("registre de progression", () => {
	it("accepte les trois kinds", () => {
		expect(isValidKind("pal_caught")).toBe(true);
		expect(isValidKind("tech_unlocked")).toBe(true);
		expect(isValidKind("marker")).toBe(true);
		expect(isValidKind("nope")).toBe(false);
	});

	it("accepte un id de chaque catégorie de marqueur", () => {
		for (const type of ["relic", "alpha", "boss", "tower", "watchtower", "ft"]) {
			const sample = byType(type)[0];
			expect(sample, `aucun marqueur de type ${type}`).toBeDefined();
			expect(isValidEntity("marker", sample.id), type).toBe(true);
		}
	});

	it("refuse un id inconnu", () => {
		expect(isValidEntity("marker", "relic_inexistant")).toBe(false);
	});
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

Run: `pnpm --filter web test src/lib/server/progress.test.ts`
Expected: FAIL — `isValidEntity("marker", <id alpha>)` renvoie `false`.

- [ ] **Step 3 : Élargir le registre**

Dans `apps/web/src/lib/server/progress.ts`, remplacer l'entrée `marker` du `REGISTRY` (lignes 13–18) :

```ts
  // Toutes les catégories de marqueurs sont cochables depuis la barre latérale
  // (2026-07-26). Les lignes déjà en base sont des ids relic_* : élargir le jeu
  // d'ids valides ne les invalide pas et n'exige aucune migration.
  marker: new Set((markers as Array<{ id: string }>).map((mk) => mk.id)),
```

- [ ] **Step 4 : Élargir le garde-fou d'import**

Dans `apps/web/src/lib/server/import.ts`, la constante en tête de fichier (ligne ~6) filtre les effigies pour valider les ids issus des saves. Elle doit **rester** limitée aux effigies : les saves ne fournissent que des GUID d'effigies (`raw:relic`). Ajouter seulement un commentaire pour éviter qu'un lecteur l'élargisse par symétrie :

```ts
// Volontairement limité aux effigies : les snapshots de save ne portent que des
// GUID d'effigies (kind raw:relic). Le registre de progress.ts, lui, accepte
// désormais tous les marqueurs (cochage manuel depuis la barre latérale).
```

- [ ] **Step 5 : Rendre la tuile du tableau de bord honnête**

Dans `apps/web/src/routes/s/[slug]/+page.server.ts`, remplacer l'entrée `marker` de `TOTALS` (ligne 12) :

```ts
  // Toutes les catégories sont cochables : le total couvre l'ensemble des
  // marqueurs, pas seulement les effigies.
  marker: (markers as Array<{ id: string }>).length,
```

Dans `apps/web/src/routes/s/[slug]/+page.svelte`, remplacer le titre de la tuile carte (ligne ~34) :

```svelte
			title: m.map_title(),
```

et la statistique par membre (ligne ~98) :

```svelte
						· {m.home_member_markers({ count: mb.counts.marker })}
```

- [ ] **Step 6 : Ajouter la clé i18n `home_member_markers`**

Dans `apps/web/messages/fr.json`, à côté de `home_member_relics` :

```json
  "home_member_markers": "{count} repères",
```

Dans `apps/web/messages/en.json` :

```json
  "home_member_markers": "{count} markers",
```

Laisser `home_member_relics` en place : la Task 9 la retire si plus aucun appelant (`grep -rn "home_member_relics" apps/web/src`).

- [ ] **Step 7 : Lancer les tests pour vérifier le succès**

Run: `pnpm --filter web test src/lib/server/progress.test.ts && pnpm --filter web check`
Expected: PASS, 0 erreur de type.

- [ ] **Step 8 : Commit**

```bash
git add apps/web/src/lib/server/progress.ts apps/web/src/lib/server/progress.test.ts \
        apps/web/src/lib/server/import.ts \
        "apps/web/src/routes/s/[slug]/+page.server.ts" "apps/web/src/routes/s/[slug]/+page.svelte" \
        apps/web/messages/fr.json apps/web/messages/en.json
git commit -m "feat(carte): tous les marqueurs cochables sous le kind marker

Élargissement du registre, sans migration : les lignes relic_* existantes
restent valides et les fusions d'import restent inchangées."
```

---

### Task 4 : Modules purs — catégories et requête

**Contexte :** toute la logique de filtrage vit ici, sans DOM ni i18n, pour être testable en une milliseconde. Les composants de la Task 6 ne font que rendre ce que ces modules calculent.

**Files:**
- Create: `apps/web/src/lib/map/categories.ts`
- Create: `apps/web/src/lib/map/categories.test.ts`
- Create: `apps/web/src/lib/map/query.ts`
- Create: `apps/web/src/lib/map/query.test.ts`
- Create: `apps/web/src/lib/map/categoryLabels.ts`

**Interfaces:**
- Consumes: `MapMarker` de `apps/web/src/lib/map/markerController.ts` (Task 2).
- Produces:
  - `categories.ts` : `type CatKey`, `CATEGORY_ORDER: CatKey[]`, `CATEGORIES: Record<CatKey, CategoryMeta>`, `type CategoryMeta = { color: string; glyph: string; trackable: boolean; refine: "none" | "level" | "level+element"; future: boolean }`, `categoryOf(mk: MapMarker): CatKey`, `countsByCategory(markers, mine, group): Record<CatKey, CatCount>`, `type CatCount = { total: number; mine: number; group: number }`
  - `query.ts` : `type Query`, `defaultQuery(): Query`, `runQuery(markers: MapMarker[], q: Query, mine: ReadonlySet<string>, nameOf: (mk: MapMarker) => string): MapMarker[]`
  - `categoryLabels.ts` : `catLabel(key: CatKey): string`, `catShort(key: CatKey): string`

- [ ] **Step 1 : Écrire les tests des catégories**

Créer `apps/web/src/lib/map/categories.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import markersJson from "@palworld-companion/game-data/markers.json";
import { CATEGORIES, CATEGORY_ORDER, categoryOf, countsByCategory } from "./categories";
import type { MapMarker } from "./markerController";

const markers = markersJson as MapMarker[];

describe("catégories", () => {
	it("couvre tous les marqueurs sans en inventer", () => {
		const total = CATEGORY_ORDER.filter((k) => !CATEGORIES[k].future && k !== "spawn").reduce(
			(sum, k) => sum + markers.filter((mk) => categoryOf(mk) === k).length,
			0
		);
		expect(total).toBe(markers.length);
	});

	it("annonce les volumes attendus", () => {
		const n = (k: string) => markers.filter((mk) => categoryOf(mk) === k).length;
		expect(n("relic")).toBe(138);
		expect(n("alpha")).toBe(83);
		expect(n("boss")).toBe(36);
		expect(n("tower")).toBe(8);
		expect(n("watchtower")).toBe(20);
		expect(n("ft")).toBe(129);
	});

	it("marque ressources comme future et sans données", () => {
		expect(CATEGORIES.resource.future).toBe(true);
		expect(markers.some((mk) => categoryOf(mk) === "resource")).toBe(false);
	});

	it("n'ouvre l'affinage par élément qu'aux alphas", () => {
		expect(CATEGORIES.alpha.refine).toBe("level+element");
		expect(CATEGORIES.boss.refine).toBe("level");
		expect(CATEGORIES.relic.refine).toBe("none");
		expect(CATEGORIES.ft.refine).toBe("none");
	});

	it("compte mine et group par catégorie", () => {
		const sample = markers.filter((mk) => categoryOf(mk) === "relic").slice(0, 3);
		const mine = new Set([sample[0].id, sample[1].id]);
		const group = { [sample[2].id]: [{ id: "u", username: "u", avatarUrl: null }] };
		const counts = countsByCategory(markers, mine, group);
		expect(counts.relic.mine).toBe(2);
		expect(counts.relic.group).toBe(1);
		expect(counts.relic.total).toBe(138);
		expect(counts.alpha.mine).toBe(0);
	});
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `pnpm --filter web test src/lib/map/categories.test.ts`
Expected: FAIL — `Failed to resolve import "./categories"`.

- [ ] **Step 3 : Écrire `categories.ts`**

```ts
// Registre des catégories de la carte : métadonnées visuelles et capacités.
// Module pur — aucune i18n ici (voir categoryLabels.ts), aucun DOM : c'est ce
// qui le rend testable et réutilisable par query.ts.
import type { GroupUser } from "$lib/types";
import type { MapMarker } from "./markerController";

export type CatKey =
  | "relic"
  | "alpha"
  | "boss"
  | "tower"
  | "watchtower"
  | "ft"
  | "spawn"
  | "resource";

export type CategoryMeta = {
  /** Couleur de la pastille, du glyphe et de la teinte de ligne. */
  color: string;
  glyph: string;
  /** Cochable individuellement (kind `marker`). */
  trackable: boolean;
  /** Contrôles d'affinage pertinents pour cette catégorie. */
  refine: "none" | "level" | "level+element";
  /** Catégorie sans données : visible, grisée, désactivée. */
  future: boolean;
};

/** Ordre du rail. Ajouter une catégorie = ajouter une entrée ici. */
export const CATEGORY_ORDER: CatKey[] = [
  "relic",
  "alpha",
  "boss",
  "tower",
  "watchtower",
  "ft",
  "resource",
  "spawn",
];

export const CATEGORIES: Record<CatKey, CategoryMeta> = {
  relic: { color: "var(--el-leaf)", glyph: "✦", trackable: true, refine: "none", future: false },
  alpha: { color: "var(--el-fire)", glyph: "▲", trackable: true, refine: "level+element", future: false },
  boss: { color: "var(--el-dark)", glyph: "☠", trackable: true, refine: "level", future: false },
  tower: { color: "var(--el-electricity)", glyph: "⌂", trackable: true, refine: "none", future: false },
  watchtower: { color: "var(--el-ice)", glyph: "⌖", trackable: true, refine: "none", future: false },
  ft: { color: "var(--accent)", glyph: "◆", trackable: true, refine: "none", future: false },
  // Aucune donnée : spawners World Partition, cf. docs/decisions.md.
  resource: { color: "var(--el-earth)", glyph: "◈", trackable: false, refine: "none", future: true },
  // Pseudo-catégorie : des zones, pas des marqueurs. Pilotée par SpawnPicker.
  spawn: { color: "var(--accent)", glyph: "◍", trackable: false, refine: "none", future: false },
};

/** Catégories réellement présentes dans markers.json. */
export const MARKER_CATEGORIES = CATEGORY_ORDER.filter(
  (k) => !CATEGORIES[k].future && k !== "spawn",
);

/** `type` de markers.json EST la clé de catégorie : la classification se fait
 *  dans le pipeline (transform/markers.lib.ts), pas ici. */
export function categoryOf(mk: MapMarker): CatKey {
  return mk.type;
}

export type CatCount = { total: number; mine: number; group: number };

export function countsByCategory(
  markers: MapMarker[],
  mine: ReadonlySet<string>,
  group: Record<string, GroupUser[]>,
): Record<CatKey, CatCount> {
  const out = Object.fromEntries(
    CATEGORY_ORDER.map((k) => [k, { total: 0, mine: 0, group: 0 }]),
  ) as Record<CatKey, CatCount>;
  for (const mk of markers) {
    const c = out[categoryOf(mk)];
    if (!c) continue;
    c.total++;
    if (mine.has(mk.id)) c.mine++;
    if (group[mk.id]?.length) c.group++;
  }
  return out;
}
```

- [ ] **Step 4 : Lancer pour vérifier le succès**

Run: `pnpm --filter web test src/lib/map/categories.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5 : Écrire les tests de la requête**

Créer `apps/web/src/lib/map/query.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { defaultQuery, runQuery, type Query } from "./query";
import type { MapMarker } from "./markerController";

const MARKERS: MapMarker[] = [
	{ id: "r1", type: "relic", px: 0, py: 0 },
	{ id: "r2", type: "relic", px: 0, py: 0 },
	{ id: "a1", type: "alpha", px: 0, py: 0, meta: { palId: "Anubis", level: 47 } },
	{ id: "a2", type: "alpha", px: 0, py: 0, meta: { palId: "Chillet", level: 11 } },
	{ id: "b1", type: "boss", px: 0, py: 0, meta: { level: 30 } },
	{ id: "t1", type: "tower", px: 0, py: 0, nameId: "FTPoint45" },
	{ id: "f1", type: "ft", px: 0, py: 0, nameId: "FTPoint1" }
];

const NAMES: Record<string, string> = {
	r1: "Effigie 001",
	r2: "Effigie 002",
	a1: "Anubis",
	a2: "Chillet",
	b1: "Believer CrossBow",
	t1: "Tour du Syndicat de Rayne",
	f1: "Volcan Noir – Flanc"
};
const nameOf = (mk: MapMarker) => NAMES[mk.id] ?? mk.id;
const ELEMENTS: Record<string, string> = { Anubis: "Earth", Chillet: "Ice" };
const q = (over: Partial<Query> = {}): Query => ({ ...defaultQuery(), ...over });
const ids = (list: MapMarker[]) => list.map((mk) => mk.id);

describe("runQuery", () => {
	it("ne renvoie que la catégorie sélectionnée", () => {
		expect(ids(runQuery(MARKERS, q({ selected: "relic" }), new Set(), nameOf))).toEqual(["r1", "r2"]);
		expect(ids(runQuery(MARKERS, q({ selected: "tower" }), new Set(), nameOf))).toEqual(["t1"]);
	});

	it("filtre par niveau minimum", () => {
		const out = runQuery(MARKERS, q({ selected: "alpha", levelMin: 40 }), new Set(), nameOf);
		expect(ids(out)).toEqual(["a1"]);
	});

	it("ignore le niveau pour une catégorie sans niveau", () => {
		const out = runQuery(MARKERS, q({ selected: "relic", levelMin: 70 }), new Set(), nameOf);
		expect(ids(out)).toEqual(["r1", "r2"]);
	});

	it("filtre par élément via elementOf", () => {
		const out = runQuery(
			MARKERS,
			q({ selected: "alpha", element: "Ice" }),
			new Set(),
			nameOf,
			(mk) => (mk.meta?.palId ? ELEMENTS[mk.meta.palId] : undefined)
		);
		expect(ids(out)).toEqual(["a2"]);
	});

	it("masque ce qui est suivi", () => {
		const out = runQuery(MARKERS, q({ selected: "relic", hideTracked: true }), new Set(["r1"]), nameOf);
		expect(ids(out)).toEqual(["r2"]);
	});

	it("cherche sans casse ni accents", () => {
		expect(ids(runQuery(MARKERS, q({ selected: "alpha", search: "ANUB" }), new Set(), nameOf))).toEqual(["a1"]);
		expect(ids(runQuery(MARKERS, q({ selected: "ft", search: "volcan noir" }), new Set(), nameOf))).toEqual(["f1"]);
		expect(ids(runQuery(MARKERS, q({ selected: "ft", search: "flanc" }), new Set(), nameOf))).toEqual(["f1"]);
	});

	it("rend une liste vide pour une catégorie future", () => {
		expect(runQuery(MARKERS, q({ selected: "resource" }), new Set(), nameOf)).toEqual([]);
	});

	it("rend une liste vide pour la pseudo-catégorie spawn", () => {
		expect(runQuery(MARKERS, q({ selected: "spawn" }), new Set(), nameOf)).toEqual([]);
	});

	it("combine les critères", () => {
		const out = runQuery(
			MARKERS,
			q({ selected: "alpha", levelMin: 10, search: "chill", hideTracked: true }),
			new Set(["a1"]),
			nameOf
		);
		expect(ids(out)).toEqual(["a2"]);
	});
});

describe("visibleMarkers", () => {
	it("ne garde que les catégories visibles et applique hideTracked aux suivis", async () => {
		const { visibleMarkers } = await import("./query");
		const out = visibleMarkers(MARKERS, q({ visible: ["relic", "tower"], hideTracked: true }), new Set(["r1"]));
		expect(ids(out)).toEqual(["r2", "t1"]);
	});
});

describe("defaultQuery", () => {
	it("part sur les catégories de progression, pas sur les 414 marqueurs", () => {
		const d = defaultQuery();
		expect(d.selected).toBe("relic");
		expect(d.visible).toEqual(["relic", "alpha", "boss", "tower"]);
		expect(d.levelMin).toBe(1);
		expect(d.hideTracked).toBe(false);
	});
});
```

- [ ] **Step 6 : Lancer pour vérifier l'échec**

Run: `pnpm --filter web test src/lib/map/query.test.ts`
Expected: FAIL — `Failed to resolve import "./query"`.

- [ ] **Step 7 : Écrire `query.ts`**

```ts
// Filtrage de la carte. Deux sorties distinctes et volontairement séparées :
//  · runQuery       -> la LISTE (une seule catégorie, celle qui est sélectionnée)
//  · visibleMarkers -> la CARTE (toutes les catégories visibles)
// Module pur : ni DOM, ni i18n, ni Svelte.
import { CATEGORIES, categoryOf, type CatKey } from "./categories";
import type { MapMarker } from "./markerController";

export type Query = {
  /** Catégorie au premier plan : liste + contrôles d'affinage. */
  selected: CatKey;
  /** Catégories dessinées sur la carte. */
  visible: CatKey[];
  levelMin: number;
  element: string;
  hideTracked: boolean;
  search: string;
};

export function defaultQuery(): Query {
  return {
    selected: "relic",
    // Les quatre catégories de progression : afficher les 414 marqueurs d'entrée
    // de jeu noierait la carte.
    visible: ["relic", "alpha", "boss", "tower"],
    levelMin: 1,
    element: "",
    hideTracked: false,
    search: "",
  };
}

/** Repli sans accents ni casse, pour que « volcan noir » trouve « Volcan Noir ». */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Lignes de la liste : la catégorie sélectionnée, affinée. */
export function runQuery(
  markers: MapMarker[],
  q: Query,
  mine: ReadonlySet<string>,
  nameOf: (mk: MapMarker) => string,
  elementOf?: (mk: MapMarker) => string | undefined,
): MapMarker[] {
  const meta = CATEGORIES[q.selected];
  if (!meta || meta.future || q.selected === "spawn") return [];
  const needle = q.search.trim() ? norm(q.search.trim()) : "";
  const wantsLevel = meta.refine !== "none";
  const wantsElement = meta.refine === "level+element" && !!q.element;
  return markers.filter((mk) => {
    if (categoryOf(mk) !== q.selected) return false;
    if (q.hideTracked && mine.has(mk.id)) return false;
    if (wantsLevel && q.levelMin > 1 && (mk.meta?.level ?? 0) < q.levelMin) return false;
    if (wantsElement && elementOf?.(mk) !== q.element) return false;
    if (needle && !norm(nameOf(mk)).includes(needle)) return false;
    return true;
  });
}

/** Marqueurs à dessiner : toutes les catégories visibles. `hideTracked` s'y
 *  applique aussi, sinon « masquer les faits » ne masquerait que la liste. */
export function visibleMarkers(
  markers: MapMarker[],
  q: Query,
  mine: ReadonlySet<string>,
): MapMarker[] {
  const visible = new Set(q.visible);
  return markers.filter((mk) => {
    if (!visible.has(categoryOf(mk))) return false;
    if (q.hideTracked && mine.has(mk.id)) return false;
    return true;
  });
}
```

- [ ] **Step 8 : Lancer pour vérifier le succès**

Run: `pnpm --filter web test src/lib/map/query.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 9 : Écrire `categoryLabels.ts`**

```ts
// Libellés i18n des catégories, séparés de categories.ts pour que les modules
// purs (et leurs tests) n'aient pas à charger le runtime Paraglide.
import { m } from "$lib/paraglide/messages";
import type { CatKey } from "./categories";

export function catLabel(key: CatKey): string {
  switch (key) {
    case "relic":
      return m.map_cat_relic();
    case "alpha":
      return m.map_cat_alpha();
    case "boss":
      return m.map_cat_boss();
    case "tower":
      return m.map_cat_tower();
    case "watchtower":
      return m.map_cat_watchtower();
    case "ft":
      return m.map_cat_ft();
    case "resource":
      return m.map_cat_resource();
    case "spawn":
      return m.map_cat_spawn();
  }
}

export function catShort(key: CatKey): string {
  switch (key) {
    case "relic":
      return m.map_cat_relic_short();
    case "alpha":
      return m.map_cat_alpha_short();
    case "boss":
      return m.map_cat_boss_short();
    case "tower":
      return m.map_cat_tower_short();
    case "watchtower":
      return m.map_cat_watchtower_short();
    case "ft":
      return m.map_cat_ft_short();
    case "resource":
      return m.map_cat_resource_short();
    case "spawn":
      return m.map_cat_spawn_short();
  }
}
```

Ces seize clés sont créées à l'étape suivante — `pnpm check` échouera jusque-là.

- [ ] **Step 10 : Ajouter les clés de catégories**

Dans `apps/web/messages/fr.json`, après `"map_title"` :

```json
  "map_cat_relic": "Effigies de Lifmunk",
  "map_cat_relic_short": "Effigies",
  "map_cat_alpha": "Alpha (Pal)",
  "map_cat_alpha_short": "Alpha",
  "map_cat_boss": "Boss humains",
  "map_cat_boss_short": "Boss PNJ",
  "map_cat_tower": "Tours de boss",
  "map_cat_tower_short": "Tours",
  "map_cat_watchtower": "Tours d'observation",
  "map_cat_watchtower_short": "Observation",
  "map_cat_ft": "Voyage rapide",
  "map_cat_ft_short": "Voyage",
  "map_cat_resource": "Ressources",
  "map_cat_resource_short": "Ressources",
  "map_cat_spawn": "Zones de spawn",
  "map_cat_spawn_short": "Spawn",
```

Dans `apps/web/messages/en.json`, aux mêmes emplacements :

```json
  "map_cat_relic": "Lifmunk Effigies",
  "map_cat_relic_short": "Effigies",
  "map_cat_alpha": "Alpha (Pal)",
  "map_cat_alpha_short": "Alpha",
  "map_cat_boss": "Human bosses",
  "map_cat_boss_short": "NPC bosses",
  "map_cat_tower": "Boss towers",
  "map_cat_tower_short": "Towers",
  "map_cat_watchtower": "Watchtowers",
  "map_cat_watchtower_short": "Watchtowers",
  "map_cat_ft": "Fast travel",
  "map_cat_ft_short": "Travel",
  "map_cat_resource": "Resources",
  "map_cat_resource_short": "Resources",
  "map_cat_spawn": "Spawn areas",
  "map_cat_spawn_short": "Spawn",
```

- [ ] **Step 11 : Vérifier**

Run: `pnpm --filter web check && pnpm --filter web test src/lib/map/`
Expected: 0 erreur, tous les tests de `lib/map/` passent.

- [ ] **Step 12 : Commit**

```bash
git add apps/web/src/lib/map/categories.ts apps/web/src/lib/map/categories.test.ts \
        apps/web/src/lib/map/query.ts apps/web/src/lib/map/query.test.ts \
        apps/web/src/lib/map/categoryLabels.ts \
        apps/web/messages/fr.json apps/web/messages/en.json
git commit -m "feat(carte): modules purs de catégories et de requête"
```

---

### Task 5 : État de la carte v3 + partage par lien

**Contexte :** `MapState` persiste aujourd'hui `map-filters-v2`. Le nouveau modèle a d'autres champs : on passe en v3 (un v2 restauré tel quel laisserait `selected`/`visible` absents). Le partage sérialise l'état en querystring ; l'URL gagne à l'ouverture, puis les modifications repartent en localStorage — pas une entrée d'historique par case cochée.

**Files:**
- Modify: `apps/web/src/lib/map/mapState.svelte.ts` (réécriture)
- Create: `apps/web/src/lib/map/shareUrl.ts`
- Create: `apps/web/src/lib/map/shareUrl.test.ts`

**Interfaces:**
- Consumes: `Query`, `defaultQuery` (Task 4), `CatKey`, `CATEGORIES` (Task 4), `SpawnPhase` (`./spawnLayer`).
- Produces:
  - `shareUrl.ts` : `toSearchParams(q: Query, spawn: SpawnState): URLSearchParams`, `fromSearchParams(params: URLSearchParams): { query: Partial<Query>; spawn: Partial<SpawnState> } | null`, `type SpawnState = { spawnPal: string | null; spawnPhase: SpawnPhase }`
  - `mapState.svelte.ts` : `class MapState { query: Query; spawn: SpawnState; restore(url?: URL): void; persist(): void; shareHref(base: URL): string }`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `apps/web/src/lib/map/shareUrl.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { defaultQuery } from "./query";
import { fromSearchParams, toSearchParams } from "./shareUrl";

const spawn = { spawnPal: null, spawnPhase: "day" as const };

describe("toSearchParams", () => {
	it("n'écrit que ce qui diffère des défauts", () => {
		const p = toSearchParams(defaultQuery(), spawn);
		expect(p.toString()).toBe("");
	});

	it("sérialise catégories, affinage et recherche", () => {
		const p = toSearchParams(
			{ ...defaultQuery(), selected: "alpha", visible: ["alpha", "tower"], levelMin: 40, element: "Fire", hideTracked: true, search: "anub" },
			{ spawnPal: "Anubis", spawnPhase: "night" }
		);
		expect(p.get("sel")).toBe("alpha");
		expect(p.get("vis")).toBe("alpha,tower");
		expect(p.get("lvl")).toBe("40");
		expect(p.get("el")).toBe("Fire");
		expect(p.get("todo")).toBe("1");
		expect(p.get("q")).toBe("anub");
		expect(p.get("pal")).toBe("Anubis");
		expect(p.get("phase")).toBe("night");
	});
});

describe("fromSearchParams", () => {
	it("renvoie null sans paramètre de filtre", () => {
		expect(fromSearchParams(new URLSearchParams(""))).toBeNull();
		expect(fromSearchParams(new URLSearchParams("focus=relic_x"))).toBeNull();
	});

	it("fait l'aller-retour", () => {
		const q = { ...defaultQuery(), selected: "boss" as const, visible: ["boss"] as const, levelMin: 25, hideTracked: true };
		const parsed = fromSearchParams(toSearchParams({ ...q, visible: [...q.visible] }, spawn));
		expect(parsed?.query.selected).toBe("boss");
		expect(parsed?.query.visible).toEqual(["boss"]);
		expect(parsed?.query.levelMin).toBe(25);
		expect(parsed?.query.hideTracked).toBe(true);
	});

	it("ignore une catégorie inconnue", () => {
		const parsed = fromSearchParams(new URLSearchParams("vis=alpha,licorne&sel=licorne"));
		expect(parsed?.query.visible).toEqual(["alpha"]);
		expect(parsed?.query.selected).toBeUndefined();
	});

	it("borne le niveau", () => {
		expect(fromSearchParams(new URLSearchParams("lvl=0"))?.query.levelMin).toBe(1);
		expect(fromSearchParams(new URLSearchParams("lvl=999"))?.query.levelMin).toBe(70);
		expect(fromSearchParams(new URLSearchParams("lvl=abc"))?.query.levelMin).toBeUndefined();
	});

	it("ignore une phase invalide", () => {
		expect(fromSearchParams(new URLSearchParams("phase=midi"))?.spawn.spawnPhase).toBeUndefined();
		expect(fromSearchParams(new URLSearchParams("phase=night"))?.spawn.spawnPhase).toBe("night");
	});
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `pnpm --filter web test src/lib/map/shareUrl.test.ts`
Expected: FAIL — `Failed to resolve import "./shareUrl"`.

- [ ] **Step 3 : Écrire `shareUrl.ts`**

```ts
// Sérialisation de l'état de filtres dans l'URL, pour partager une vue.
// Seuls les écarts aux défauts sont écrits : un lien reste court et lisible.
import { CATEGORIES, type CatKey } from "./categories";
import { defaultQuery, type Query } from "./query";
import type { SpawnPhase } from "./spawnLayer";

export type SpawnState = { spawnPal: string | null; spawnPhase: SpawnPhase };

const LEVEL_MIN = 1;
const LEVEL_MAX = 70;

function isCatKey(v: string): v is CatKey {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, v);
}

export function toSearchParams(q: Query, spawn: SpawnState): URLSearchParams {
  const d = defaultQuery();
  const p = new URLSearchParams();
  if (q.selected !== d.selected) p.set("sel", q.selected);
  if (q.visible.join(",") !== d.visible.join(",")) p.set("vis", q.visible.join(","));
  if (q.levelMin !== d.levelMin) p.set("lvl", String(q.levelMin));
  if (q.element) p.set("el", q.element);
  if (q.hideTracked) p.set("todo", "1");
  if (q.search.trim()) p.set("q", q.search.trim());
  if (spawn.spawnPal) {
    p.set("pal", spawn.spawnPal);
    p.set("phase", spawn.spawnPhase);
  }
  return p;
}

/** `null` si l'URL ne porte aucun filtre : l'appelant garde alors localStorage.
 *  Un `?focus=` seul ne compte pas — c'est un lien de marqueur, pas de vue. */
export function fromSearchParams(
  params: URLSearchParams,
): { query: Partial<Query>; spawn: Partial<SpawnState> } | null {
  const KEYS = ["sel", "vis", "lvl", "el", "todo", "q", "pal", "phase"];
  if (!KEYS.some((k) => params.has(k))) return null;

  const query: Partial<Query> = {};
  const spawn: Partial<SpawnState> = {};

  const sel = params.get("sel");
  if (sel && isCatKey(sel)) query.selected = sel;

  const vis = params.get("vis");
  if (vis !== null) query.visible = vis.split(",").filter(isCatKey);

  const lvl = params.get("lvl");
  if (lvl !== null && /^\d+$/.test(lvl)) {
    query.levelMin = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Number(lvl)));
  }

  const el = params.get("el");
  if (el) query.element = el;

  if (params.get("todo") === "1") query.hideTracked = true;

  const q = params.get("q");
  if (q) query.search = q;

  const pal = params.get("pal");
  if (pal) spawn.spawnPal = pal;

  const phase = params.get("phase");
  if (phase === "day" || phase === "night") spawn.spawnPhase = phase;

  return { query, spawn };
}
```

- [ ] **Step 4 : Lancer pour vérifier le succès**

Run: `pnpm --filter web test src/lib/map/shareUrl.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5 : Réécrire `mapState.svelte.ts`**

```ts
// État de la carte, persisté en localStorage. v3 : le modèle passe de trois
// cases à cocher à une catégorie sélectionnée + un ensemble de catégories
// visibles - un état v2 restauré tel quel laisserait ces champs absents.
import { defaultQuery, type Query } from "./query";
import { fromSearchParams, toSearchParams, type SpawnState } from "./shareUrl";
import type { SpawnPhase } from "./spawnLayer";

const STORAGE_KEY = "map-filters-v3";

export class MapState {
  query = $state<Query>(defaultQuery());
  spawn = $state<SpawnState>({ spawnPal: null, spawnPhase: "day" });

  /** Restaure depuis l'URL si elle porte des filtres, sinon depuis localStorage.
   *  L'URL gagne : un lien partagé doit montrer la vue qu'il décrit. */
  restore(url?: URL): void {
    const shared = url ? fromSearchParams(url.searchParams) : null;
    if (shared) {
      this.query = { ...defaultQuery(), ...shared.query };
      this.spawn = { spawnPal: null, spawnPhase: "day", ...shared.spawn };
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { query?: Partial<Query>; spawn?: Partial<SpawnState> };
      this.query = { ...defaultQuery(), ...parsed.query };
      this.spawn = { spawnPal: null, spawnPhase: "day", ...parsed.spawn };
    } catch {
      /* localStorage indisponible : défauts */
    }
  }

  persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ query: this.query, spawn: this.spawn }));
    } catch {
      /* ignore */
    }
  }

  /** Lien absolu reproduisant la vue courante. */
  shareHref(base: URL): string {
    const url = new URL(base.pathname, base.origin);
    url.search = toSearchParams(this.query, this.spawn).toString();
    return url.toString();
  }

  setPhase(phase: SpawnPhase): void {
    this.spawn.spawnPhase = phase;
    this.persist();
  }
}
```

- [ ] **Step 6 : Vérifier la compilation**

Run: `pnpm --filter web check`
Expected: erreurs UNIQUEMENT dans `routes/s/[slug]/map/+page.svelte` et `lib/map/FilterPanel.svelte` (anciens champs `filters.relic`, `filters.hideChecked`…). Elles disparaissent en Task 7. Noter les fichiers signalés.

- [ ] **Step 7 : Commit**

```bash
git add apps/web/src/lib/map/mapState.svelte.ts apps/web/src/lib/map/shareUrl.ts apps/web/src/lib/map/shareUrl.test.ts
git commit -m "feat(carte): état v3 (catégorie sélectionnée + visibles) et lien partageable"
```

---

### Task 6 : Composants de la barre latérale

**Contexte :** six composants, un rôle chacun. Aucun ne connaît Leaflet ni le store de progression : ils reçoivent des props et émettent des événements. Le style reprend les jetons de `app.css` — surfaces, bordures, pas d'ombres.

**Files:**
- Create: `apps/web/src/lib/map/sidebar/CategoryRail.svelte`
- Create: `apps/web/src/lib/map/sidebar/CategoryHeader.svelte`
- Create: `apps/web/src/lib/map/sidebar/RefineControls.svelte`
- Create: `apps/web/src/lib/map/sidebar/ResultList.svelte`
- Create: `apps/web/src/lib/map/sidebar/SpawnPicker.svelte`
- Create: `apps/web/src/lib/map/sidebar/MapSidebar.svelte`
- Create: `apps/web/src/lib/map/sidebar/ResultList.test.ts`
- Delete: `apps/web/src/lib/map/FilterPanel.svelte`
- Delete: `apps/web/src/lib/map/SpawnPanel.svelte`

**Interfaces:**
- Consumes: `CatKey`, `CATEGORIES`, `CATEGORY_ORDER`, `countsByCategory`, `CatCount` (Task 4) ; `catLabel`, `catShort` (Task 4) ; `Query` (Task 4) ; `MapMarker` (Task 2) ; `spawnCounts`, `hasSpawns` (`$lib/game/spawns`) ; `palIcon` (`$lib/game/icons`) ; `gameName` (`$lib/game/names`).
- Produces (props de `MapSidebar`) :

```ts
type MapSidebarProps = {
  markers: MapMarker[];
  query: Query;
  spawn: { spawnPal: string | null; spawnPhase: SpawnPhase };
  counts: Record<CatKey, CatCount>;
  /** Lignes de la catégorie sélectionnée, déjà filtrées par runQuery. */
  rows: MapMarker[];
  mine: ReadonlySet<string>;
  group: Record<string, GroupUser[]>;
  /** null en mode invité : masque tout affichage « groupe ». */
  guest: boolean;
  nameOf: (mk: MapMarker) => string;
  elementOf: (mk: MapMarker) => string | undefined;
  onchange: () => void;
  onfocus: (mk: MapMarker) => void;
  ontoggle: (mk: MapMarker) => void;
  onspawn: (palId: string | null) => void;
  onphase: (phase: SpawnPhase) => void;
  onshare: () => void;
};
```

- [ ] **Step 1 : Écrire le test de la liste**

Créer `apps/web/src/lib/map/sidebar/ResultList.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { rowMeta } from "./ResultList.svelte";
import type { MapMarker } from "$lib/map/markerController";

const alpha: MapMarker = { id: "a", type: "alpha", px: 0, py: 0, meta: { palId: "Anubis", level: 47 } };
const relic: MapMarker = { id: "r", type: "relic", px: 0, py: 0 };

describe("rowMeta", () => {
	it("compose élément et coéquipiers", () => {
		expect(rowMeta(alpha, "Terre", 2)).toBe("Terre · 2 coéquipiers");
	});

	it("accorde le singulier", () => {
		expect(rowMeta(alpha, "Terre", 1)).toBe("Terre · 1 coéquipier");
	});

	it("omet ce qui manque", () => {
		expect(rowMeta(alpha, "Terre", 0)).toBe("Terre");
		expect(rowMeta(relic, undefined, 0)).toBe("");
		expect(rowMeta(relic, undefined, 3)).toBe("3 coéquipiers");
	});
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `pnpm --filter web test src/lib/map/sidebar/ResultList.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Écrire `ResultList.svelte`**

```svelte
<script lang="ts" module>
	import { m } from '$lib/paraglide/messages';
	import type { MapMarker } from '$lib/map/markerController';

	/** Ligne de métadonnées : élément puis coéquipiers, pluriel accordé.
	 *  Exporté depuis un bloc `module` pour être testable sans DOM.
	 *  Paraglide n'a pas de pluriel implicite dans ce projet : deux clés
	 *  explicites, le choix se fait ici. */
	export function rowMeta(
		_mk: MapMarker,
		elementLabel: string | undefined,
		groupCount: number
	): string {
		const team =
			groupCount === 0
				? null
				: groupCount === 1
					? m.map_group_member_one()
					: m.map_group_member_many({ count: groupCount });
		return [elementLabel || null, team].filter(Boolean).join(' · ');
	}
</script>

<script lang="ts">
	import { CATEGORIES, categoryOf } from '$lib/map/categories';
	import { palIcon } from '$lib/game/icons';
	import type { GroupUser } from '$lib/types';

	let {
		rows,
		mine,
		group,
		trackable,
		nameOf,
		elementOf,
		elementLabelOf,
		onfocus,
		ontoggle
	}: {
		rows: MapMarker[];
		mine: ReadonlySet<string>;
		group: Record<string, GroupUser[]>;
		trackable: boolean;
		nameOf: (mk: MapMarker) => string;
		elementOf: (mk: MapMarker) => string | undefined;
		elementLabelOf: (element: string | undefined) => string | undefined;
		onfocus: (mk: MapMarker) => void;
		ontoggle: (mk: MapMarker) => void;
	} = $props();

	function tint(mk: MapMarker): string {
		const el = elementOf(mk);
		return el ? `var(--el-${el.toLowerCase()})` : CATEGORIES[categoryOf(mk)].color;
	}
</script>

<ul class="res">
	{#each rows as mk (mk.id)}
		{@const done = mine.has(mk.id)}
		<li style="--c:{tint(mk)}" class:done>
			<button class="row" onclick={() => onfocus(mk)}>
				<span class="por">
					{#if mk.meta?.palId && palIcon(mk.meta.palId)}
						<img src={palIcon(mk.meta.palId)} alt="" width="28" height="28" />
					{:else}
						<span class="pg" aria-hidden="true">{CATEGORIES[categoryOf(mk)].glyph}</span>
					{/if}
				</span>
				<span class="txt">
					<b>{nameOf(mk)}</b>
					{@const meta = rowMeta(mk, elementLabelOf(elementOf(mk)), group[mk.id]?.length ?? 0)}
					{#if meta}<span class="meta tnum">{meta}</span>{/if}
				</span>
				{#if mk.meta?.level}<span class="lvb tnum">{mk.meta.level}</span>{/if}
			</button>
			{#if trackable}
				<input
					type="checkbox"
					checked={done}
					aria-label="{m.map_done()} — {nameOf(mk)}"
					onchange={() => ontoggle(mk)}
				/>
			{/if}
		</li>
	{:else}
		<li class="empty">{m.map_no_results()}</li>
	{/each}
</ul>

<style>
	.res {
		flex: 1;
		min-height: 0;
		overflow: auto;
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 5px;
		border-radius: var(--r-md);
		background: linear-gradient(90deg, color-mix(in srgb, var(--c) 13%, transparent), transparent 62%);
		border-left: 2px solid var(--c);
	}
	li.done {
		filter: grayscale(0.85);
		opacity: 0.55;
	}
	.empty {
		display: block;
		padding: 18px 8px;
		color: var(--text-4);
		font-size: 12px;
		background: none;
		border: none;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 9px;
		flex: 1;
		min-width: 0;
		min-height: 34px;
		background: none;
		border: none;
		padding: 5px 7px;
		text-align: left;
	}
	.row:hover {
		background: color-mix(in srgb, var(--c) 8%, transparent);
	}
	.por {
		flex: none;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--surface-3);
		border: 1px solid var(--border);
	}
	.pg {
		font-size: 13px;
		color: var(--c);
	}
	.txt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.txt b {
		font-size: 13px;
		color: var(--text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		font-size: 10px;
		color: var(--text-3);
	}
	/* Badge accordé à la teinte de la ligne : en --accent, il entrait en
	   concurrence avec l'élément sur chaque ligne. */
	.lvb {
		flex: none;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-1);
		background: color-mix(in srgb, var(--c) 30%, var(--surface-3));
		border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
		border-radius: 999px;
		padding: 0 7px;
	}
</style>
```

- [ ] **Step 4 : Ajouter les clés i18n utilisées par la liste**

Dans `apps/web/messages/fr.json` :

```json
  "map_group_member_one": "1 coéquipier",
  "map_group_member_many": "{count} coéquipiers",
  "map_no_results": "Rien ne correspond à ces filtres.",
  "map_done": "Fait",
  "map_results_one": "1 cible",
  "map_results_many": "{count} cibles",
```

dans `en.json` :

```json
  "map_group_member_one": "1 teammate",
  "map_group_member_many": "{count} teammates",
  "map_no_results": "Nothing matches these filters.",
  "map_done": "Done",
  "map_results_one": "1 target",
  "map_results_many": "{count} targets",
```

- [ ] **Step 5 : Lancer le test de la liste**

Run: `pnpm --filter web test src/lib/map/sidebar/ResultList.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6 : Écrire `CategoryRail.svelte`**

```svelte
<script lang="ts">
	// Rail de catégories : SÉLECTION (clic) et VISIBILITÉ (barre oblique) sont
	// deux notions distinctes - cf. spec. La visibilité se règle dans l'en-tête.
	import { CATEGORIES, CATEGORY_ORDER, type CatCount, type CatKey } from '$lib/map/categories';
	import { catLabel } from '$lib/map/categoryLabels';
	import { m } from '$lib/paraglide/messages';
	import { palIcon } from '$lib/game/icons';
	import { gameName } from '$lib/game/names';

	let {
		selected,
		visible,
		counts,
		spawnPal,
		thumbOf,
		onselect
	}: {
		selected: CatKey;
		visible: CatKey[];
		counts: Record<CatKey, CatCount>;
		spawnPal: string | null;
		/** Portrait d'aperçu d'une catégorie, si elle en a un. */
		thumbOf: (key: CatKey) => string | undefined;
		onselect: (key: CatKey) => void;
	} = $props();

	const shown = $derived(new Set(visible));
</script>

<nav class="rail" aria-label={m.map_categories()}>
	{#each CATEGORY_ORDER as key (key)}
		{@const meta = CATEGORIES[key]}
		{#if key !== 'spawn'}
			{@const c = counts[key]}
			<button
				class="tile"
				class:active={selected === key}
				class:hidden={!shown.has(key)}
				class:future={meta.future}
				disabled={meta.future}
				style="--c:{meta.color}"
				aria-current={selected === key}
				aria-label="{catLabel(key)} — {meta.future
					? m.map_cat_soon()
					: m.map_counter_of({ count: c.mine, total: c.total })}"
				onclick={() => onselect(key)}
			>
				{#if thumbOf(key)}
					<img src={thumbOf(key)} alt="" width="22" height="22" />
				{:else}
					<span class="gl" aria-hidden="true">{meta.glyph}</span>
				{/if}
				<span class="tnum n">{meta.future ? '—' : c.total}</span>
				{#if !shown.has(key) && !meta.future}<span class="off" aria-hidden="true"></span>{/if}
			</button>
		{/if}
	{/each}

	<button
		class="tile spawnt"
		class:active={selected === 'spawn'}
		aria-current={selected === 'spawn'}
		aria-label={spawnPal ? `${m.map_cat_spawn()} — ${gameName(`pal:${spawnPal}`)}` : m.map_cat_spawn()}
		onclick={() => onselect('spawn')}
	>
		{#if spawnPal && palIcon(spawnPal)}
			<img src={palIcon(spawnPal)} alt="" width="22" height="22" />
		{:else}
			<span class="gl" aria-hidden="true">{CATEGORIES.spawn.glyph}</span>
		{/if}
		<span class="tnum n">{m.map_cat_spawn_short()}</span>
	</button>
</nav>

<style>
	.rail {
		flex: none;
		width: 56px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 7px;
		overflow: auto;
		background: var(--bg);
		border-right: 1px solid var(--border);
		scrollbar-width: none;
	}
	.tile {
		position: relative;
		display: grid;
		place-items: center;
		gap: 1px;
		min-height: 44px;
		padding: 5px 0 3px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--r-md);
		color: var(--text-3);
	}
	.tile:hover {
		background: var(--surface-2);
	}
	.tile.active {
		background: linear-gradient(180deg, color-mix(in srgb, var(--c) 22%, transparent), transparent);
		border-color: color-mix(in srgb, var(--c) 50%, transparent);
		color: var(--c);
	}
	.tile.hidden img,
	.tile.hidden .gl {
		opacity: 0.3;
	}
	.tile.future {
		opacity: 0.3;
	}
	.gl {
		font-size: 15px;
		line-height: 1;
		color: var(--c);
	}
	img {
		border-radius: 50%;
		background: var(--surface-3);
	}
	.n {
		font-size: 9px;
		color: var(--text-4);
	}
	/* Barre oblique : catégorie masquée sur la carte. */
	.off {
		position: absolute;
		inset: 6px 8px;
		border-top: 1.5px solid var(--text-3);
		transform: rotate(-35deg);
	}
	.spawnt {
		margin-top: auto;
		border: 1px dashed var(--border-strong);
	}
</style>
```

- [ ] **Step 7 : Écrire `CategoryHeader.svelte`**

```svelte
<script lang="ts">
	// En-tête : anneau de progression de la catégorie sélectionnée, compteurs,
	// interrupteur de visibilité, copie du lien.
	import { CATEGORIES, type CatCount, type CatKey } from '$lib/map/categories';
	import { catLabel, catShort } from '$lib/map/categoryLabels';
	import { m } from '$lib/paraglide/messages';

	let {
		category,
		count,
		visible,
		guest,
		onvisibility,
		onshare
	}: {
		category: CatKey;
		count: CatCount;
		visible: boolean;
		guest: boolean;
		onvisibility: () => void;
		onshare: () => void;
	} = $props();

	const meta = $derived(CATEGORIES[category]);
	const pct = $derived(count.total ? Math.round((count.mine / count.total) * 100) : 0);
</script>

<header class="hero">
	<div class="ring" style="--p:{pct};--c:{meta.color}" role="img" aria-label={m.map_counter_of({ count: count.mine, total: count.total })}>
		<!-- Disque intérieur plutôt qu'un mask : un mask découperait aussi le chiffre. -->
		<span class="tnum">{pct}<i>%</i></span>
	</div>
	<div class="htxt">
		<p class="kicker" title={catLabel(category)}>{catShort(category)}</p>
		<p class="hnum tnum">{count.mine} <i>/ {count.total}</i></p>
		{#if !guest}
			<p class="hsub tnum">{m.map_group_found({ count: count.group })}</p>
		{/if}
	</div>
	<div class="hact">
		<button class="share" aria-label={m.map_copy_link()} onclick={onshare}>⧉</button>
		{#if !meta.future}
			<label class="eye">
				<input type="checkbox" checked={visible} onchange={onvisibility} />
				<span>{m.map_on_map()}</span>
			</label>
		{/if}
	</div>
</header>

<style>
	.hero {
		position: relative;
		flex: none;
		display: flex;
		align-items: center;
		gap: 11px;
		overflow: hidden;
		padding: 11px 12px;
		border-radius: var(--r-md);
		border: 1px solid var(--border-strong);
		background: radial-gradient(120% 130% at 30% -40%, hsl(222 30% 17%), var(--surface-1) 68%);
	}
	.hero::before {
		content: '';
		position: absolute;
		top: -110px;
		left: 30%;
		width: 220px;
		height: 180px;
		background: radial-gradient(closest-side, hsl(199 90% 55% / 0.2), transparent);
		pointer-events: none;
	}
	.ring {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: conic-gradient(var(--c) calc(var(--p) * 1%), hsl(220 30% 90% / 0.08) 0);
	}
	.ring::after {
		content: '';
		position: absolute;
		inset: 5px;
		border-radius: 50%;
		background: var(--surface-1);
	}
	.ring span {
		position: relative;
		z-index: 1;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-1);
	}
	.ring i {
		font-style: normal;
		font-size: 8px;
		color: var(--text-3);
	}
	.htxt {
		flex: 1;
		min-width: 0;
	}
	.kicker {
		margin: 0;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--accent);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hnum {
		margin: 1px 0 0;
		font-family: var(--font-display);
		font-size: 17px;
		color: var(--text-1);
	}
	.hnum i {
		font-style: normal;
		font-size: 12px;
		color: var(--text-3);
	}
	.hsub {
		margin: 1px 0 0;
		font-size: 10px;
		color: var(--text-3);
	}
	.hact {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
	}
	.share {
		background: none;
		border: none;
		color: var(--text-3);
		padding: 2px 4px;
	}
	.eye {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		color: var(--text-3);
	}
</style>
```

- [ ] **Step 8 : Écrire `RefineControls.svelte`**

```svelte
<script lang="ts">
	// Affinage : niveau minimum, et éléments quand la catégorie les porte.
	import { m } from '$lib/paraglide/messages';
	import { ELEMENT_LABELS, type Locale } from '$lib/search/tokens';
	import { getLocale } from '$lib/paraglide/runtime';

	let {
		mode,
		levelMin,
		element,
		onlevel,
		onelement
	}: {
		mode: 'level' | 'level+element';
		levelMin: number;
		element: string;
		onlevel: (v: number) => void;
		onelement: (v: string) => void;
	} = $props();

	const locale = getLocale() as Locale;
	const ELEMENTS = Object.keys(ELEMENT_LABELS);
</script>

<div class="refine">
	<label class="lvl">
		{m.map_level_min()} <b class="tnum">{levelMin}+</b>
		<input
			type="range"
			min="1"
			max="70"
			value={levelMin}
			oninput={(e) => onlevel(Number(e.currentTarget.value))}
		/>
	</label>
	{#if mode === 'level+element'}
		<div class="els">
			{#each ELEMENTS as el (el)}
				<button
					class="el"
					class:on={element === el}
					style="--c:var(--el-{el.toLowerCase()})"
					aria-label={ELEMENT_LABELS[el][locale]}
					aria-pressed={element === el}
					onclick={() => onelement(element === el ? '' : el)}
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.refine {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.lvl {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-3);
	}
	.lvl input {
		flex: 1;
	}
	.els {
		display: flex;
		gap: 5px;
	}
	.el {
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid transparent;
		background: color-mix(in srgb, var(--c) 35%, transparent);
	}
	.el.on {
		background: var(--c);
		border-color: var(--text-1);
	}
</style>
```

- [ ] **Step 9 : Écrire `SpawnPicker.svelte`**

```svelte
<script lang="ts">
	// Zones de spawn : un Pal à la fois (cf. spec), avec segment jour / nuit.
	import { m } from '$lib/paraglide/messages';
	import { palIcon } from '$lib/game/icons';
	import { gameName } from '$lib/game/names';
	import { spawnCounts, hasSpawns } from '$lib/game/spawns';
	import type { SpawnPhase } from '$lib/map/spawnLayer';

	let {
		palId,
		phase,
		search,
		onsearch,
		onpal,
		onphase
	}: {
		palId: string | null;
		phase: SpawnPhase;
		search: string;
		onsearch: (v: string) => void;
		onpal: (palId: string | null) => void;
		onphase: (phase: SpawnPhase) => void;
	} = $props();

	const counts = $derived(palId ? spawnCounts[palId] : undefined);

	/** Pals ayant des zones, filtrés par la recherche. Liste construite une fois. */
	const ALL = Object.keys(spawnCounts)
		.filter((id) => hasSpawns(spawnCounts[id]))
		.map((id) => ({ id, name: gameName(`pal:${id}`) }))
		.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

	const matches = $derived(
		search.trim()
			? ALL.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 40)
			: ALL.slice(0, 40)
	);
</script>

{#if palId && counts}
	<div class="current">
		{#if palIcon(palId)}<img src={palIcon(palId)} alt="" width="34" height="34" />{/if}
		<span class="nm">{gameName(`pal:${palId}`)}</span>
		<span class="tnum n">{m.map_spawn_zones({ count: phase === 'day' ? counts.day : counts.night })}</span>
		<button class="x" aria-label={m.map_spawn_clear()} onclick={() => onpal(null)}>×</button>
	</div>
	<div class="seg">
		<button class:on={phase === 'day'} onclick={() => onphase('day')}>☀ {m.map_spawn_day()}</button>
		<button class:on={phase === 'night'} onclick={() => onphase('night')}>☾ {m.map_spawn_night()}</button>
	</div>
{/if}

<input
	type="search"
	class="find"
	placeholder={m.map_spawn_search()}
	value={search}
	oninput={(e) => onsearch(e.currentTarget.value)}
/>

<ul class="pals">
	{#each matches as p (p.id)}
		<li>
			<button class="prow" class:on={p.id === palId} onclick={() => onpal(p.id)}>
				{#if palIcon(p.id)}<img src={palIcon(p.id)} alt="" width="24" height="24" />{/if}
				<span class="pn">{p.name}</span>
				<span class="tnum pc">{spawnCounts[p.id].day + spawnCounts[p.id].night}</span>
			</button>
		</li>
	{:else}
		<li class="empty">{m.map_no_results()}</li>
	{/each}
</ul>

<style>
	.current {
		flex: none;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 8px 10px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-2);
	}
	.nm {
		flex: 1;
		min-width: 0;
		font-size: 13px;
		color: var(--text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.n {
		font-size: 11px;
		color: var(--text-3);
	}
	.x {
		background: none;
		border: none;
		color: var(--text-3);
		padding: 0 4px;
	}
	.seg {
		flex: none;
		display: flex;
		gap: 6px;
	}
	.seg button {
		flex: 1;
		min-height: 34px;
		font-size: 12px;
		color: var(--text-3);
	}
	.seg .on {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}
	.find {
		flex: none;
	}
	.pals {
		flex: 1;
		min-height: 0;
		overflow: auto;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.prow {
		display: flex;
		align-items: center;
		gap: 9px;
		width: 100%;
		min-height: 34px;
		background: none;
		border: none;
		padding: 4px 6px;
		border-radius: var(--r-sm);
		text-align: left;
	}
	.prow:hover {
		background: var(--surface-2);
	}
	.prow.on {
		background: var(--accent-soft);
		box-shadow: inset 2px 0 0 var(--accent);
	}
	.pn {
		flex: 1;
		min-width: 0;
		font-size: 13px;
		color: var(--text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pc {
		font-size: 10px;
		color: var(--text-4);
	}
	.empty {
		padding: 18px 8px;
		color: var(--text-4);
		font-size: 12px;
	}
</style>
```

- [ ] **Step 10 : Écrire `MapSidebar.svelte`**

```svelte
<script lang="ts">
	// Ossature de la barre latérale : rail + panneau. Ne connaît ni Leaflet ni
	// le store de progression - tout passe par des props et des rappels.
	import { CATEGORIES, type CatCount, type CatKey } from '$lib/map/categories';
	import { catShort } from '$lib/map/categoryLabels';
	import { m } from '$lib/paraglide/messages';
	import { ELEMENT_LABELS, type Locale } from '$lib/search/tokens';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { MapMarker } from '$lib/map/markerController';
	import type { Query } from '$lib/map/query';
	import type { SpawnPhase } from '$lib/map/spawnLayer';
	import type { GroupUser } from '$lib/types';
	import CategoryRail from './CategoryRail.svelte';
	import CategoryHeader from './CategoryHeader.svelte';
	import RefineControls from './RefineControls.svelte';
	import ResultList from './ResultList.svelte';
	import SpawnPicker from './SpawnPicker.svelte';

	let {
		query,
		spawn,
		counts,
		rows,
		mine,
		group,
		guest,
		nameOf,
		elementOf,
		thumbOf,
		onchange,
		onfocus,
		ontoggle,
		onspawn,
		onphase,
		onshare
	}: {
		query: Query;
		spawn: { spawnPal: string | null; spawnPhase: SpawnPhase };
		counts: Record<CatKey, CatCount>;
		rows: MapMarker[];
		mine: ReadonlySet<string>;
		group: Record<string, GroupUser[]>;
		guest: boolean;
		nameOf: (mk: MapMarker) => string;
		elementOf: (mk: MapMarker) => string | undefined;
		thumbOf: (key: CatKey) => string | undefined;
		onchange: () => void;
		onfocus: (mk: MapMarker) => void;
		ontoggle: (mk: MapMarker) => void;
		onspawn: (palId: string | null) => void;
		onphase: (phase: SpawnPhase) => void;
		onshare: () => void;
	} = $props();

	const locale = getLocale() as Locale;
	const meta = $derived(CATEGORIES[query.selected]);
	const isSpawn = $derived(query.selected === 'spawn');
	const elementLabelOf = (el: string | undefined) => (el ? ELEMENT_LABELS[el]?.[locale] : undefined);

	function select(key: CatKey) {
		query.selected = key;
		// La recherche est propre à la catégorie : la garder en changeant de
		// catégorie donnerait une liste vide sans raison visible.
		query.search = '';
		onchange();
	}
	function toggleVisibility() {
		const next = new Set(query.visible);
		next.has(query.selected) ? next.delete(query.selected) : next.add(query.selected);
		query.visible = [...next];
		onchange();
	}
</script>

<aside class="sb">
	<div class="handle" aria-hidden="true"></div>
	<div class="cols">
		<CategoryRail
			selected={query.selected}
			visible={query.visible}
			{counts}
			spawnPal={spawn.spawnPal}
			{thumbOf}
			onselect={select}
		/>

		<section class="panel">
			{#if isSpawn}
				<header class="spawnhead">
					<h2>{m.map_cat_spawn()}</h2>
					<button class="share" aria-label={m.map_copy_link()} onclick={onshare}>⧉</button>
				</header>
				<SpawnPicker
					palId={spawn.spawnPal}
					phase={spawn.spawnPhase}
					search={query.search}
					onsearch={(v) => {
						query.search = v;
						onchange();
					}}
					onpal={onspawn}
					{onphase}
				/>
			{:else}
				<CategoryHeader
					category={query.selected}
					count={counts[query.selected]}
					visible={query.visible.includes(query.selected)}
					{guest}
					onvisibility={toggleVisibility}
					{onshare}
				/>

				<input
					type="search"
					placeholder={m.map_search_in({ category: catShort(query.selected).toLowerCase() })}
					value={query.search}
					aria-label={m.map_search_in({ category: catShort(query.selected).toLowerCase() })}
					oninput={(e) => {
						query.search = e.currentTarget.value;
						onchange();
					}}
				/>

				{#if meta.refine !== 'none'}
					<RefineControls
						mode={meta.refine}
						levelMin={query.levelMin}
						element={query.element}
						onlevel={(v) => {
							query.levelMin = v;
							onchange();
						}}
						onelement={(v) => {
							query.element = v;
							onchange();
						}}
					/>
				{/if}

				<div class="rbar">
					<span class="tnum rc">
						{rows.length === 1 ? m.map_results_one() : m.map_results_many({ count: rows.length })}
					</span>
					{#if meta.trackable}
						<label class="hide">
							<input
								type="checkbox"
								checked={query.hideTracked}
								onchange={(e) => {
									query.hideTracked = e.currentTarget.checked;
									onchange();
								}}
							/>
							{m.map_hide_tracked()}
						</label>
					{/if}
				</div>

				{#if meta.future}
					<p class="soon">{m.map_cat_soon_help()}</p>
				{:else}
					<ResultList
						{rows}
						{mine}
						{group}
						trackable={meta.trackable}
						{nameOf}
						{elementOf}
						{elementLabelOf}
						{onfocus}
						{ontoggle}
					/>
				{/if}
			{/if}
		</section>
	</div>
</aside>

<style>
	.sb {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--surface-1);
		border-right: 1px solid var(--border-strong);
	}
	/* Poignée : visible seulement en feuille (mobile), cf. media query. */
	.handle {
		display: none;
	}
	.cols {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.panel {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 9px;
		padding: 10px 11px;
	}
	.spawnhead {
		flex: none;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.spawnhead h2 {
		margin: 0;
		font-size: 14px;
		color: var(--text-1);
	}
	.share {
		background: none;
		border: none;
		color: var(--text-3);
		padding: 2px 4px;
	}
	.rbar {
		flex: none;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		border-top: 1px solid var(--border);
		padding-top: 7px;
	}
	.rc {
		font-size: 10px;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--text-4);
	}
	.hide {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: var(--text-3);
	}
	.soon {
		margin: 0;
		padding: 18px 8px;
		font-size: 12px;
		color: var(--text-4);
	}
</style>
```

- [ ] **Step 11 : Ajouter les clés i18n restantes de la barre**

`apps/web/messages/fr.json` :

```json
  "map_categories": "Catégories",
  "map_counter_of": "{count} sur {total}",
  "map_group_found": "{count} trouvés par le groupe",
  "map_on_map": "Carte",
  "map_copy_link": "Copier le lien de cette vue",
  "map_link_copied": "Lien copié",
  "map_search_in": "Chercher dans {category}…",
  "map_spawn_search": "Chercher un Pal…",
  "map_level_min": "Niveau",
  "map_hide_tracked": "masquer les faits",
  "map_cat_soon": "bientôt",
  "map_cat_soon_help": "Pas encore de données pour cette catégorie.",
```

`apps/web/messages/en.json` :

```json
  "map_categories": "Categories",
  "map_counter_of": "{count} of {total}",
  "map_group_found": "{count} found by the group",
  "map_on_map": "Map",
  "map_copy_link": "Copy link to this view",
  "map_link_copied": "Link copied",
  "map_search_in": "Search in {category}…",
  "map_spawn_search": "Search a Pal…",
  "map_level_min": "Level",
  "map_hide_tracked": "hide done",
  "map_cat_soon": "soon",
  "map_cat_soon_help": "No data for this category yet.",
```

- [ ] **Step 12 : Supprimer les anciens panneaux**

```bash
git rm apps/web/src/lib/map/FilterPanel.svelte apps/web/src/lib/map/SpawnPanel.svelte
```

- [ ] **Step 13 : Vérifier**

Run: `pnpm --filter web check`
Expected: erreurs UNIQUEMENT dans `routes/s/[slug]/map/+page.svelte` (il importe encore les panneaux supprimés). Task 7 les résout.

Run: `pnpm --filter web test src/lib/map/`
Expected: PASS.

- [ ] **Step 14 : Commit**

```bash
git add apps/web/src/lib/map/sidebar apps/web/messages/fr.json apps/web/messages/en.json
git commit -m "feat(carte): composants de la barre latérale (rail, en-tête, affinage, liste, spawn)"
```

---

### Task 7 : Câbler la barre à la page carte

**Contexte :** la page devient l'unique endroit qui connaît à la fois Svelte et Leaflet. Elle dérive `rows` et `visible`, passe les rappels, et conserve les deux liens profonds existants.

**Files:**
- Modify: `apps/web/src/routes/s/[slug]/map/+page.svelte` (réécriture du script et du gabarit)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: rien pour d'autres tâches.

- [ ] **Step 1 : Réécrire le script de la page**

Remplacer l'intégralité du bloc `<script>` de `apps/web/src/routes/s/[slug]/map/+page.svelte` par :

```svelte
<script lang="ts">
	import { mount, unmount } from 'svelte';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import type * as LType from 'leaflet';
	import markersJson from '@palworld-companion/game-data/markers.json';
	import palsJson from '@palworld-companion/game-data/pals.json';
	import { spawnCounts, defaultPhase } from '$lib/game/spawns';
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import { ProgressStore } from '$lib/game/progress.svelte';
	import LeafletMap from '$lib/map/LeafletMap.svelte';
	import MarkerPopup from '$lib/map/MarkerPopup.svelte';
	import MapSidebar from '$lib/map/sidebar/MapSidebar.svelte';
	import { MapState } from '$lib/map/mapState.svelte';
	import { MarkerController, type MapMarker } from '$lib/map/markerController';
	import { SpawnLayer, type SpawnPhase } from '$lib/map/spawnLayer';
	import { categoryOf, countsByCategory, type CatKey } from '$lib/map/categories';
	import { runQuery, visibleMarkers } from '$lib/map/query';
	import { isGuestContext } from '$lib/nav';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();

	const markers = markersJson as MapMarker[];
	// Tous les marqueurs sont cochables : sert de garde-fou aux ids en
	// localStorage après une régénération de game-data.
	const MARKER_IDS = new Set(markers.map((mk) => mk.id));

	const guest = $derived(data.mode === 'guest');
	const store = new ProgressStore();
	const mapState = new MapState();
	let markerController: MarkerController | undefined = $state();
	let spawnLayer: SpawnLayer | undefined = $state();
	let copied = $state(false);

	const pals = palsJson as Array<{ id: string; elements: string[]; nocturnal?: boolean }>;
	const elementByPal = new Map(pals.map((p) => [p.id, p.elements[0]]));
	const nocturnal = new Set(pals.filter((p) => p.nocturnal).map((p) => p.id));

	/** Nom affiché d'un marqueur, par catégorie. Les boss humains n'ont ni palId
	 *  (le sentinelle « None » est retiré par le pipeline) ni entrée L10N : leur
	 *  nom est dérivé du SpawnerID. */
	function nameOf(mk: MapMarker): string {
		if (mk.meta?.palId) return gameName(`pal:${mk.meta.palId}`);
		if (mk.nameId) return gameName(`ft:${mk.nameId}`);
		if (mk.type === 'boss') return mk.id.replace(/^alpha_(?:BOSS_)?/i, '').replaceAll('_', ' ');
		return m.map_relic_name();
	}
	const elementOf = (mk: MapMarker) =>
		mk.meta?.palId ? elementByPal.get(mk.meta.palId) : undefined;

	/** Portrait d'aperçu d'une catégorie pour le rail (le premier disponible). */
	function thumbOf(key: CatKey): string | undefined {
		if (key !== 'alpha') return undefined;
		const first = markers.find((mk) => categoryOf(mk) === 'alpha' && mk.meta?.palId);
		return first?.meta?.palId ? palIcon(first.meta.palId) : undefined;
	}

	$effect(() => {
		mapState.restore(page.url);
		store.init('marker', page.params.slug!, data.progress.mine, data.progress.group, MARKER_IDS);
		store.startSync();
		return () => {
			store.stopSync();
			markerController?.destroy();
			spawnLayer?.destroy();
		};
	});

	const counts = $derived(countsByCategory(markers, store.mine, store.group));
	const rows = $derived(runQuery(markers, mapState.query, store.mine, nameOf, elementOf));
	const visible = $derived(visibleMarkers(markers, mapState.query, store.mine));

	// Pont popup : montage d'un composant Svelte dans la popup Leaflet.
	let leafletRef: typeof LType | undefined;
	let mapRef: LType.Map | undefined;

	function onMarkerClick(marker: MapMarker, lm: LType.Marker) {
		if (!leafletRef || !mapRef) return;
		const target = document.createElement('div');
		const instance = mount(MarkerPopup, { target, props: { marker, store } });
		const popup = leafletRef
			.popup({ closeButton: true, offset: [0, -8], className: 'pal-popup' })
			.setLatLng(lm.getLatLng())
			.setContent(target);
		popup.on('remove', () => unmount(instance));
		popup.openOn(mapRef);
	}

	function onMapReady(
		leaflet: typeof LType,
		map: LType.Map,
		toLatLng: (px: number, py: number) => LType.LatLng
	) {
		leafletRef = leaflet;
		mapRef = map;
		markerController = new MarkerController(leaflet, map, toLatLng, onMarkerClick);
		spawnLayer = new SpawnLayer(leaflet, map, toLatLng);
	}

	// Svelte -> Leaflet : re-sync sur tout changement de filtre/progression.
	$effect(() => {
		markerController?.sync(visible, store.mine);
	});

	// Svelte -> Leaflet : zones de spawn du Pal sélectionné.
	$effect(() => {
		spawnLayer?.setPal(mapState.spawn.spawnPal, mapState.spawn.spawnPhase);
	});

	/** Centre la carte sur un marqueur et ouvre sa popup. Rend la catégorie
	 *  visible au besoin : cliquer une ligne dont les épingles sont masquées
	 *  ne doit pas donner une carte vide. */
	function focusMarker(mk: MapMarker) {
		const cat = categoryOf(mk);
		if (!mapState.query.visible.includes(cat)) {
			mapState.query.visible = [...mapState.query.visible, cat];
			mapState.persist();
		}
		// Après le flush des effets, le sync a (re)créé le marqueur.
		setTimeout(() => {
			const lm = markerController?.get(mk.id);
			if (!lm || !mapRef) return;
			mapRef.setView(lm.getLatLng(), 4);
			onMarkerClick(mk, lm);
		}, 0);
	}

	/** `phase` forcée : uniquement pour relayer un lien partagé. Sinon la phase
	 *  est déduite (un Pal nocturne n'a souvent rien à montrer de jour). */
	function selectSpawnPal(palId: string | null, phase?: SpawnPhase) {
		mapState.spawn.spawnPal = palId;
		if (palId) {
			mapState.spawn.spawnPhase = phase ?? defaultPhase(spawnCounts[palId], nocturnal.has(palId));
		}
		mapState.persist();
		if (!palId) return;
		void spawnLayer?.setPal(palId, mapState.spawn.spawnPhase).then(() => {
			const b = spawnLayer?.bounds();
			if (b && mapRef) mapRef.fitBounds(b.pad(0.15));
		});
	}

	async function share() {
		const href = mapState.shareHref(page.url);
		try {
			await navigator.clipboard.writeText(href);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Presse-papiers refusé : l'URL devient l'adresse courante, copiable
			// depuis la barre du navigateur.
			history.replaceState(history.state, '', href);
		}
	}

	// Zones depuis la fiche d'un Pal : /map?pal=<palId>.
	// `zonedPal` est un `let` nu, PAS un $state : l'effet l'écrit, et le rendre
	// réactif créerait une auto-dépendance - « Effacer » le remettrait à null,
	// l'effet se relancerait avec ?pal= toujours dans l'URL, et les zones
	// reviendraient aussitôt.
	let zonedPal: string | null = null;
	$effect(() => {
		const palId = page.url.searchParams.get('pal');
		if (!spawnLayer) return;
		if (!palId) {
			zonedPal = null;
			return;
		}
		if (palId === zonedPal || !spawnCounts[palId]) return;
		zonedPal = palId;
		mapState.query.selected = 'spawn';
		// `?phase=` n'est lu que s'il est valide : un lien partagé ne porte que
		// `?pal=&phase=` quand le reste de la vue est aux défauts, et
		// `fromSearchParams` l'ignore alors (pal seul ne décrit pas une vue).
		// Sans ce relais, la phase choisie par l'expéditeur serait perdue.
		const shared = page.url.searchParams.get('phase');
		selectSpawnPal(palId, shared === 'day' || shared === 'night' ? shared : undefined);
	});

	// Focus depuis la palette de recherche : /map?focus=<markerId>.
	let focusedId: string | null = null;
	$effect(() => {
		const id = page.url.searchParams.get('focus');
		if (!id) {
			focusedId = null;
			return;
		}
		if (!markerController || id === focusedId) return;
		const mk = markers.find((x) => x.id === id);
		if (!mk) return;
		focusedId = id;
		// La catégorie du marqueur passe au premier plan, et « masquer les faits »
		// est levé s'il est déjà suivi - sinon la cible resterait invisible.
		mapState.query.selected = categoryOf(mk);
		if (mapState.query.hideTracked && store.mine.has(id)) mapState.query.hideTracked = false;
		mapState.persist();
		focusMarker(mk);
	});
</script>
```

- [ ] **Step 2 : Réécrire le gabarit**

Remplacer le bloc entre `<Seo … />` et `<style>` par :

```svelte
<Seo
	title={m.map_title()}
	description={m.seo_map_desc()}
	path="/map"
	indexable={isGuestContext()}
/>

<div class="map-wrap">
	<div class="sidebar">
		<MapSidebar
			query={mapState.query}
			spawn={mapState.spawn}
			{counts}
			{rows}
			mine={store.mine}
			group={store.group}
			{guest}
			{nameOf}
			{elementOf}
			{thumbOf}
			onchange={() => mapState.persist()}
			onfocus={focusMarker}
			ontoggle={(mk) => store.toggle(mk.id)}
			onspawn={selectSpawnPal}
			onphase={(p: SpawnPhase) => mapState.setPhase(p)}
			onshare={share}
		/>
	</div>
	<div class="canvas">
		<LeafletMap onready={onMapReady} />
	</div>
	{#if copied}
		<p class="toast" role="status">{m.map_link_copied()}</p>
	{/if}
</div>
```

- [ ] **Step 3 : Adapter le style de la page**

Remplacer la règle `.map-wrap` et ajouter les nouvelles (garder tous les blocs `:global(...)` existants) :

```css
	.map-wrap {
		display: flex;
		flex: 1;
		min-height: 420px;
		position: relative;
	}
	.sidebar {
		flex: none;
		width: 340px;
		min-height: 0;
	}
	.canvas {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.toast {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 600;
		margin: 0;
		padding: 8px 14px;
		font-size: 12px;
		color: var(--text-1);
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: 999px;
	}
```

- [ ] **Step 4 : Vérifier la compilation et les tests**

Run: `pnpm --filter web check`
Expected: 0 erreur, 0 avertissement.

Run: `pnpm --filter web test`
Expected: tous les tests passent.

- [ ] **Step 5 : Vérifier dans le navigateur**

Run: `pnpm --filter web dev`
Ouvrir `http://localhost:5173/paldex` (mode invité) puis la carte, et vérifier point par point :

1. Le rail montre 7 tuiles + la tuile spawn ; « Ressources » est grisée.
2. Cliquer « Alpha » : l'en-tête affiche `x / 83`, le curseur de niveau et les pastilles d'élément apparaissent.
3. Cliquer « Effigies » : plus de curseur ni de pastilles.
4. Régler « Niveau 40+ » sur Alpha : la liste se réduit, la carte ne change pas (le niveau n'affine que la liste).
5. Décocher « Carte » sur Alpha : les épingles alpha disparaissent, la tuile porte une barre oblique, la liste reste.
6. Cliquer une ligne : la carte centre le marqueur et ouvre la popup.
7. Cocher une ligne : elle grise, la même coche apparaît dans la popup.
8. Cocher « masquer les faits » : la ligne disparaît de la liste ET son épingle de la carte.
9. Tuile spawn → chercher « Anubis » → cliquer : les zones se dessinent, la vue se recadre, le segment Jour/Nuit fonctionne.
10. `⧉` : le toast « Lien copié » apparaît ; coller l'URL dans un onglet neuf restitue exactement la vue.
11. Depuis une fiche de Pal, « Voir les zones » (`?pal=`) sélectionne la catégorie spawn et dessine les zones.
12. Depuis la palette de recherche, choisir une tour : la carte centre la tour et la catégorie « Tours » passe au premier plan.

- [ ] **Step 6 : Commit**

```bash
git add "apps/web/src/routes/s/[slug]/map/+page.svelte"
git commit -m "feat(carte): la page carte utilise la nouvelle barre latérale"
```

---

### Task 8 : Feuille glissante mobile + accessibilité

**Contexte :** sous 900 px, la barre devient une feuille ancrée en bas à trois positions. Le rail passe à l'horizontale dans la feuille — un rail vertical y mangerait la largeur utile et ne laisserait que deux lignes de résultats.

**Files:**
- Modify: `apps/web/src/lib/map/sidebar/MapSidebar.svelte`
- Modify: `apps/web/src/lib/map/sidebar/CategoryRail.svelte`
- Modify: `apps/web/src/lib/map/sidebar/CategoryHeader.svelte`
- Modify: `apps/web/src/routes/s/[slug]/map/+page.svelte`

**Interfaces:**
- Consumes: composants de la Task 6.
- Produces: `MapSidebar` accepte `sheet: boolean` et `stop: 'collapsed' | 'half' | 'full'` + `onstop: (s) => void`.

- [ ] **Step 1 : Ajouter l'état de feuille à `MapSidebar`**

Dans le bloc de props, ajouter :

```ts
		sheet = false,
		stop = 'half',
		onstop
	}: {
		// … props existantes …
		/** Rendu en feuille glissante (mobile). */
		sheet?: boolean;
		stop?: 'collapsed' | 'half' | 'full';
		onstop?: (stop: 'collapsed' | 'half' | 'full') => void;
```

Remplacer l'élément racine et la poignée :

```svelte
<aside class="sb" class:sheet>
	{#if sheet}
		<button
			class="handle"
			aria-label={m.map_sheet_toggle()}
			aria-expanded={stop !== 'collapsed'}
			onclick={() => onstop?.(stop === 'full' ? 'collapsed' : stop === 'half' ? 'full' : 'half')}
		>
			<span class="grip" aria-hidden="true"></span>
			{#if stop === 'collapsed'}
				<span class="peek tnum">
					{catShort(query.selected)} · {counts[query.selected].mine}/{counts[query.selected].total}
				</span>
			{/if}
		</button>
	{/if}
```

et, dans le style, remplacer `.handle { display: none; }` par :

```css
	.sheet {
		border-right: none;
		border-top: 1px solid var(--border-strong);
		border-radius: var(--r-lg) var(--r-lg) 0 0;
		overflow: hidden;
	}
	.handle {
		display: none;
	}
	.sheet .handle {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 100%;
		min-height: 32px;
		padding: 8px 0 4px;
		background: none;
		border: none;
		border-radius: 0;
	}
	.grip {
		width: 40px;
		height: 4px;
		border-radius: 999px;
		background: var(--text-4);
	}
	.peek {
		font-size: 11px;
		color: var(--text-2);
	}
	/* Feuille : le rail passe à l'horizontale, sinon il mange la largeur utile. */
	.sheet .cols {
		flex-direction: column;
	}
```

- [ ] **Step 2 : Rendre le rail horizontal en feuille**

Dans `CategoryRail.svelte`, ajouter une prop `horizontal = false` :

```ts
	let {
		selected,
		visible,
		counts,
		spawnPal,
		thumbOf,
		onselect,
		horizontal = false
	}: {
		// … props existantes …
		horizontal?: boolean;
	} = $props();
```

Appliquer la classe sur l'élément : `<nav class="rail" class:horizontal aria-label={m.map_categories()}>` et ajouter au style :

```css
	.horizontal {
		flex-direction: row;
		width: auto;
		gap: 6px;
		padding: 8px 10px;
		border-right: none;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
	}
	.horizontal .tile {
		flex: none;
		width: 48px;
	}
	.horizontal .spawnt {
		margin-top: 0;
		margin-left: auto;
	}
```

Dans `MapSidebar.svelte`, passer `horizontal={sheet}` à `<CategoryRail … />`.

- [ ] **Step 3 : Replier l'en-tête en feuille**

Dans `CategoryHeader.svelte`, ajouter la prop `compact = false`, poser `class:compact` sur `<header class="hero">`, et ajouter :

```css
	.compact {
		padding: 8px 10px;
		gap: 9px;
	}
	.compact .ring {
		width: 38px;
		height: 38px;
	}
	.compact .ring::after {
		inset: 4px;
	}
	.compact .hsub {
		display: none;
	}
	.compact .hact {
		flex-direction: row;
		align-items: center;
		gap: 10px;
	}
```

Dans `MapSidebar.svelte`, passer `compact={sheet}` à `<CategoryHeader … />`.

- [ ] **Step 4 : Piloter la feuille depuis la page**

Dans `apps/web/src/routes/s/[slug]/map/+page.svelte`, ajouter au script :

```ts
	// Feuille glissante sous 900 px : la carte est un second écran pendant la
	// partie, la barre ne peut pas y voler la moitié de l'écran.
	let narrow = $state(false);
	let sheetStop = $state<'collapsed' | 'half' | 'full'>('half');
	$effect(() => {
		const mq = window.matchMedia('(max-width: 900px)');
		const apply = () => (narrow = mq.matches);
		apply();
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	});
```

Passer les props :

```svelte
		<MapSidebar
			…
			sheet={narrow}
			stop={sheetStop}
			onstop={(s) => (sheetStop = s)}
		/>
```

et remplacer les règles de mise en page par :

```css
	.map-wrap {
		display: flex;
		flex: 1;
		min-height: 420px;
		position: relative;
	}
	.sidebar {
		flex: none;
		width: 340px;
		min-height: 0;
	}
	.canvas {
		position: relative;
		flex: 1;
		min-width: 0;
	}

	@media (max-width: 900px) {
		.map-wrap {
			display: block;
		}
		.canvas {
			position: absolute;
			inset: 0;
		}
		.sidebar {
			position: absolute;
			inset: auto 0 0 0;
			width: 100%;
			z-index: 500;
			transition: height 220ms cubic-bezier(0.23, 1, 0.32, 1);
			/* Barre home iOS */
			padding-bottom: env(safe-area-inset-bottom, 0px);
		}
		.sidebar.collapsed {
			height: 64px;
		}
		.sidebar.half {
			height: 58%;
		}
		.sidebar.full {
			height: 92%;
		}
	}
```

et appliquer l'état sur le conteneur : `<div class="sidebar" class:collapsed={narrow && sheetStop === 'collapsed'} class:half={narrow && sheetStop === 'half'} class:full={narrow && sheetStop === 'full'}>`.

- [ ] **Step 5 : Ajouter la clé i18n de la poignée**

`fr.json` : `"map_sheet_toggle": "Déplier ou replier le panneau",`
`en.json` : `"map_sheet_toggle": "Expand or collapse the panel",`

- [ ] **Step 5 bis : Étendre la coche de la popup à toutes les catégories**

`MarkerPopup.svelte` n'offre sa coche que pour les effigies : un joueur qui clique
l'épingle d'un boss n'a aucun moyen de le marquer vaincu, alors que la barre
latérale le permet. Incohérence introduite par l'élargissement du kind `marker`
(Task 3) ; à corriger avant la mise en service.

Dans `apps/web/src/lib/map/MarkerPopup.svelte`, remplacer la condition de la
coche par la capacité déclarée de la catégorie, et sortir le bloc du branchement
`relic` pour qu'il s'applique à toutes les catégories cochables :

```svelte
<script lang="ts">
	// … imports existants …
	import { CATEGORIES, categoryOf } from './categories';

	// … props existantes …
	const trackable = $derived(CATEGORIES[categoryOf(marker)].trackable);
</script>
```

puis, dans le gabarit, après les branches de titre/coordonnées et avant la
fermeture de `.popup` :

```svelte
	{#if trackable}
		<button
			class="sphere"
			class:on={checked}
			onclick={() => store.toggle(marker.id)}
			aria-pressed={checked}
		>
			<span class="ball" aria-hidden="true"></span>
			{m.map_found()}
		</button>
		<GroupAvatars users={store.group[marker.id] ?? []} />
	{/if}
```

en retirant le bouton et les avatars de la branche `relic`, qui les portait
jusqu'ici. Les six catégories réelles étant toutes `trackable: true`, la coche
apparaît partout ; la condition documente néanmoins l'intention et couvre une
future catégorie non cochable.

Vérifier au navigateur : cliquer une épingle de boss, cocher, constater que la
ligne correspondante de la barre latérale grise, et qu'un rechargement conserve
l'état.

- [ ] **Step 6 : Renommer les clés i18n devenues obsolètes**

`map_filter_relic`, `map_filter_alpha`, `map_filter_ft` et `map_hide_checked` sont remplacées par `map_cat_*` et `map_hide_tracked`.

```bash
grep -rn "map_filter_relic\|map_filter_alpha\|map_filter_ft\|map_hide_checked" apps/web/src
```

Remplacer chaque appel restant par son équivalent `map_cat_*` (dont celui laissé en Task 2 Step 11 dans `MarkerPopup.svelte` : `m.map_filter_ft()` → `m.map_cat_ft()`), puis supprimer les quatre clés de `fr.json` et `en.json`. Même opération pour `home_member_relics` si `grep` ne renvoie plus d'appelant.

- [ ] **Step 7 : Vérifier**

Run: `pnpm --filter web check && pnpm --filter web test`
Expected: 0 erreur, tous les tests passent.

Run: `pnpm --filter web dev` puis, dans les outils de développement, émuler un iPhone (390 × 844) :

1. La barre est une feuille en bas, à mi-hauteur ; la carte occupe tout l'écran derrière.
2. Le rail est une bande horizontale défilante en haut de la feuille.
3. Toucher la poignée : moitié → plein → replié → moitié. Replié, la poignée affiche « Effigies · 12/138 ».
4. Les tuiles du rail et les lignes font au moins 44 px de haut.
5. Aucun défilement horizontal de la page.

- [ ] **Step 8 : Commit**

```bash
git add apps/web/src/lib/map/sidebar "apps/web/src/routes/s/[slug]/map/+page.svelte" \
        apps/web/src/lib/map/MarkerPopup.svelte apps/web/messages/fr.json apps/web/messages/en.json
git commit -m "feat(carte): feuille glissante mobile et nettoyage des clés i18n"
```

---

### Task 9 : Journal de décisions et vérification finale

**Files:**
- Modify: `docs/decisions.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Consigner les décisions**

Ajouter en tête de `docs/decisions.md` (le registre est chronologique, entrées les plus récentes en haut de section ou à la suite selon la convention du fichier — respecter l'ordre existant) :

> **Correction post-implémentation (revue de branche complète, 2026-07-26) :**
> le texte ci-dessous est celui réellement ajouté par le Task 1 initial, et son
> « Constat » sur les 33 ids dupliqués était **faux** : ce ne sont pas 33
> spawners à deux emplacements distincts, mais 33 doublons **exacts**
> (`DT_BossSpawnerLoactionData` contient chaque boss PNJ deux fois). L'entrée
> a depuis été corrigée dans `docs/decisions.md` — voir « Catégories de
> marqueurs et ids uniques » là-bas pour la version à jour. Conservé ici tel
> quel pour l'historique du plan, pas comme référence exacte.

```markdown
## 2026-07-26 - Catégories de marqueurs et ids uniques

**Constat** : `markers.json` mélangeait deux populations sous `alpha` (83
spawners de Pals avec `palId`, 69 boss humains à `palId: "None"`) et cachait les
tours dans les points de voyage rapide - les 8 arènes de boss sont des `ft` dont
le `nameId` est connu (`FTPoint45`, `Boss_Forest`, `SkyIsland_BOSS`, `FTPoint3`,
`FTPoint9`, `FTPoint20`, `FTPoint67`, `FTPoint76`), et 20 autres sont des tours
d'observation (`WatchTower_*`). Par ailleurs 33 `SpawnerID` occupaient deux
emplacements : autant d'ids dupliqués, donc **33 marqueurs jamais affichés**
(`MarkerController` indexe par id) et un `each_key_duplicate` sur toute liste
Svelte keyée par id.
**Décisions** : (a) la classification vit dans le pipeline
(`transform/markers.lib.ts`), `type` prend six valeurs : `relic`, `alpha`,
`boss`, `tower`, `watchtower`, `ft` ; (b) les ids dupliqués reçoivent un suffixe
`_2`, `_3` — déterministe (tri avant affectation) et idempotent ; (c) comme les
DataTables du jeu ne sont pas dans le dépôt, un script
`pnpm --filter @palworld-companion/pipeline markers:normalize` répare le fichier
commité sans réextraction ; (d) `verify.ts` échoue désormais sur un id dupliqué.
**Conséquence** : aucune migration de base — les 33 ids réaffectés sont tous des
boss PNJ, jamais cochés, absents de la table `progress`.

## 2026-07-26 - Tous les marqueurs cochables

**Constat** : seules les effigies étaient cochables (`REGISTRY.marker` limité aux
ids `relic_*`), or la barre latérale répond à « que me reste-t-il ? » pour les
alphas, les boss et les tours.
**Décision** : élargir le kind `marker` existant à tous les ids de
`markers.json` plutôt que créer un kind par catégorie. Pas de migration, pas de
changement de schéma, les lignes `relic_*` restent valides, les deux fusions
d'import (pipeline + revendication de GUID) restent inchangées, un seul
`ProgressStore` et un seul aller-retour d'API. Les compteurs par catégorie se
dérivent côté client (`countsByCategory`).
**Conséquence** : la tuile carte du tableau de bord porte sur l'ensemble des
marqueurs (414, après correction du dédoublonnage — 447 dans le texte
original de cette section) et non plus sur les seules effigies. L'auto-remplissage depuis
les saves (`FastTravelPointUnlockFlag`, `NormalBossDefeatFlag`,
`TowerBossDefeatFlag`) reste à faire : le format de clé des drapeaux de boss n'est
pas vérifié.

## 2026-07-26 - Ce qu'une URL de carte a le droit d'écraser

**Constat** : `/map?pal=<palId>` est un lien profond existant, généré depuis
chaque fiche de Pal, et il préserve les filtres de l'utilisateur. En faisant de
`pal` une clé de filtre parmi d'autres, la restauration depuis l'URL remettait
toute la vue (catégories, niveau, élément, « masquer les faits », recherche) aux
valeurs par défaut au simple clic sur « voir les zones ». Symétriquement, tester
la *présence* des clés plutôt que leur validité laissait `?sel=` ou
`?sel=licorne` écraser les préférences enregistrées.
**Décision** : deux familles de clés. Les **clés de vue** (`sel`, `vis`, `lvl`,
`el`, `todo`, `q`) décrivent une vue et seules elles autorisent l'URL à primer
sur localStorage ; `pal` et `phase` n'en décrivent pas une. `fromSearchParams`
rend `null` tant qu'aucune clé de vue n'a **validé** — la présence ne suffit pas.
**Conséquence** : un lien ne portant que `?pal=&phase=` est ignoré par la
restauration ; l'effet `?pal=` de la page relaie alors la phase partagée
lui-même. Le payload localStorage est validé champ par champ au même titre que
l'URL (un `visible` stocké en chaîne empoisonnait l'état et faisait lever
`.join(",")`).
```

- [ ] **Step 2 : Documenter la commande de normalisation**

Dans `CLAUDE.md`, section « Commands », après la ligne `pipeline verify` :

```sh
pnpm --filter @palworld-companion/pipeline markers:normalize   # reclasse markers.json + ids uniques (sans réextraction)
```

Et dans la section « Conventions worth knowing », ajouter :

```markdown
- Les catégories de la carte sont portées par `type` dans `markers.json`
  (`relic`, `alpha`, `boss`, `tower`, `watchtower`, `ft`) et classées dans
  `packages/pipeline/src/transform/markers.lib.ts` — jamais côté web. Les ids
  doivent rester uniques : `MarkerController` indexe par id et toute liste
  Svelte keyée dessus casse sur un doublon.
```

- [ ] **Step 3 : Vérification finale complète**

```bash
pnpm --filter web check
pnpm --filter web test
pnpm --filter @palworld-companion/pipeline test
pnpm --filter @palworld-companion/pipeline verify
pnpm --filter web build
```
Expected: les cinq commandes réussissent.

Vérifier qu'aucune référence morte ne subsiste :

```bash
grep -rn "FilterPanel\|SpawnPanel\|map-filters-v2\|hideChecked" apps/web/src || echo "aucune référence morte"
```
Expected: `aucune référence morte`.

- [ ] **Step 4 : Commit**

```bash
git add docs/decisions.md CLAUDE.md
git commit -m "docs: décisions catégories de marqueurs et cochage étendu"
```

---

## Auto-revue du plan

**Couverture de la spec** — chaque section a sa tâche : découvertes données → T1 ; modèle de catégories → T1 + T4 ; interface retenue → T6 ; sélection/visibilité → T4 (`runQuery` vs `visibleMarkers`) + T6 ; comportements → T6 + T7 ; états → T6 (liste vide, catégorie future, masquée, suivie, invité) ; mobile → T8 ; architecture/découpage → T4 + T6 ; état et persistance → T5 ; suivi de progression → T3 ; pipeline → T1 + T2 ; i18n → T4/T6/T8 ; erreurs → T5 (URL invalide, localStorage) + T7 (presse-papiers) ; tests → T1, T3, T4, T6 ; hors périmètre → T9 (consigné).

**Écarts assumés, décidés en écrivant le plan :**
1. La spec disait `search` dans `Query` sans préciser sa portée : le plan en fait une recherche **par catégorie**, remise à zéro au changement de catégorie (T6, `select()`).
2. La spec ne tranchait pas l'effet de `hideTracked` sur la carte : `visibleMarkers` l'applique aussi, sinon « masquer les faits » ne masquerait que la liste (T4).
3. La tuile carte du tableau de bord passe de « Effigies / 138 » à « Carte / 414 » (447 avant la correction du dédoublonnage du 2026-07-26) — sinon elle mentirait dès la première coche de boss (T3).
4. `defaultQuery().visible` ne contient que les quatre catégories de progression : afficher 414 épingles d'entrée noierait la carte.

**Cohérence des types** — `MapMarker["type"]` (T2) = `CatKey` moins `spawn` et `resource`, ce qui rend `categoryOf` trivial (T4). `Query` est produit en T4 et consommé sans variation en T5/T6/T7. `CatCount` produit en T4, consommé en T6. `SpawnState` produit en T5, consommé en T6/T7. `rowMeta` est exporté d'un bloc `<script module>` — seule manière de tester une fonction de composant Svelte sans DOM.
