# Phase 2 — Pipeline encyclopédie : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Une tâche (icônes) contient une étape **USER ACTION** (export de textures via
> FModel). Le reste est automatisable. Exécution inline recommandée.
>
> **Règle propre à cette phase** : les noms de champs des DataTables ne sont
> vérifiés qu'en partie. Chaque transform (a) inspecte d'abord une ligne réelle,
> (b) utilise le helper `pick()` avec des candidats de noms, (c) échoue
> bruyamment via `must()` si rien ne matche. Tout écart constaté entre le plan
> et la réalité des données est consigné dans `docs/decisions.md` au moment où
> il est rencontré — pas à la fin.

**Goal:** Transformer les exports FModel en artefacts JSON committés dans `packages/game-data` (pals, items, recettes, technologies, constructions, breeding, noms/descriptions FR-EN, icônes webp, index de recherche), verrouillés par `verify.ts` (comptages, intégrité référentielle, stabilité des IDs) — le socle de données des Phases 3 et 4.

**Architecture:** `packages/pipeline/src/` = lib partagée (promue du spike) + un module de transform par domaine + orchestrateur `all.ts` (transforms → index → verify → data-version). Sortie JSON déterministe (clés triées) pour des diffs git propres. `packages/game-data` = package workspace n'exportant que du JSON, consommé par `apps/web` en import statique. Icônes converties en webp dans `apps/web/static/icons/`.

**Tech Stack:** tsx/TypeScript (pipeline existant), sharp (icônes), vitest (tests sur données réelles, skippés si RAW_DIR absent).

## Global Constraints

- Spec : `docs/superpowers/specs/2026-07-21-palworld-companion-design.md` ; décisions Phase 0 : `docs/decisions.md` (jointure L10N `<PREFIXE>_<id>` → `TextData.LocalizedString`, fusion des variantes `_Common`, `SpawnerID` comme ID stable)
- `RAW_DIR` = `/mnt/c/PalExports/Exports` (défaut, surchargeable par env)
- IDs d'entités = row names des DataTables, préfixés par domaine dans les fichiers partagés : `pal:<id>`, `item:<id>`, `tech:<id>`, `building:<id>`, `skill:<id>`
- JSON de sortie : clés d'objets triées, tableaux dans un ordre déterministe (tri par id) — un re-run sans changement de données = diff git vide
- `packages/game-data/**` committé ; `packages/pipeline/raw/**` et `out/**` jamais
- Breeding v1 = données brutes (CombiRank, MaleProbability, combos uniques) — le calcul des paires se fera côté app (décision spec : combos simples)
- Icônes : webp 128×128, `apps/web/static/icons/{pals,items,tech,buildings}/<id>.webp`
- Aucune nouvelle dépendance au-delà de `sharp`
- **Report assumé** : les skills des Pals (actifs/passifs/partenaire — tables
  Waza/PassiveSkill) ne sont PAS extraits dans cette phase ; le plan de la
  Phase 3 (Paldex) les ajoutera au pipeline une fois le besoin de la fiche
  précisé. Les noms de skills FR/EN sont déjà couverts par le transform L10N.
- Branche : `feature/phase-2-pipeline-encyclopedie`

---

### Task 1: Lib pipeline promue + package game-data + orchestrateur squelette

**Files:**
- Create: `packages/pipeline/src/lib.ts` (promotion de `spike/lib.ts` + helpers)
- Create: `packages/pipeline/src/paths.ts`
- Create: `packages/pipeline/src/all.ts` (squelette, complété au fil des tâches)
- Create: `packages/game-data/package.json`
- Create: `packages/game-data/.gitkeep-l10n` (dossier l10n/)
- Modify: `packages/pipeline/package.json` (scripts `all`, `verify`)
- Test: `packages/pipeline/src/lib.test.ts`

**Interfaces:**
- Consumes: `spike/lib.ts` (Phase 0)
- Produces: `loadDataTableRows(hint)`, `findExports(hint)`, `pick(row, ...names)`,
  `must(v, msg)`, `writeGameData(relPath, data)` (JSON déterministe),
  `OUT_DIR` = chemin absolu de `packages/game-data` — utilisés par toutes les tâches

- [ ] **Step 1: Écrire la lib**

`packages/pipeline/src/paths.ts` :
```ts
import { fileURLToPath } from "node:url";

export const RAW_DIR = process.env.RAW_DIR ?? "/mnt/c/PalExports/Exports";
export const OUT_DIR = fileURLToPath(new URL("../../game-data/", import.meta.url));
export const ICONS_OUT = fileURLToPath(new URL("../../../apps/web/static/icons/", import.meta.url));
```

`packages/pipeline/src/lib.ts` :
```ts
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { OUT_DIR, RAW_DIR } from "./paths.js";

const SCAN_ROOTS = ["Pal/Content/Pal/DataTable", "Pal/Content/L10N", "Pal/Content/Pal/Texture", "Pal/Content/Others"];

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

let cached: string[] | null = null;
export function allExports(): string[] {
  cached ??= SCAN_ROOTS.flatMap((r) => walk(join(RAW_DIR, r)));
  return cached;
}

export function findExports(hint: RegExp): string[] {
  return allExports().filter((f) => hint.test(f));
}

/** Fusionne les Rows de tous les fichiers JSON matchant (variantes _Common). */
export function loadDataTableRows(hint: RegExp): Record<string, any> {
  const files = findExports(hint).filter((f) => f.endsWith(".json"));
  if (files.length === 0) throw new Error(`Aucun export ne matche ${hint}`);
  const merged: Record<string, any> = {};
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const dt = arr.find((o) => o && typeof o === "object" && "Rows" in o);
    if (dt) Object.assign(merged, dt.Rows);
  }
  if (Object.keys(merged).length === 0) throw new Error(`Rows vides pour ${hint}`);
  return merged;
}

/** Premier champ présent parmi les candidats (les noms varient entre versions). */
export function pick<T = any>(row: Record<string, any>, ...names: string[]): T | undefined {
  for (const n of names) if (n in row) return row[n];
  return undefined;
}

export function must<T>(v: T | undefined | null, msg: string): T {
  if (v === undefined || v === null) throw new Error(`Champ manquant : ${msg}`);
  return v;
}

/** Ex. "EPalElementType::Fire" -> "Fire" ; laisse intact sinon. */
export function enumName(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.includes("::") ? v.split("::").pop() : v;
}

function sortDeep(v: any): any {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]));
  }
  return v;
}

/** Écriture déterministe (clés triées) pour des diffs git propres. */
export function writeGameData(relPath: string, data: unknown): void {
  const p = join(OUT_DIR, relPath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(sortDeep(data), null, 1) + "\n");
  console.log(`  écrit : game-data/${relPath}`);
}

/** Texte L10N : clés <PREFIXE>_<id> -> TextData.LocalizedString (décision Phase 0). */
export function l10nMap(hint: RegExp, prefix: string): Record<string, string> {
  const rows = loadDataTableRows(hint);
  const out: Record<string, string> = {};
  for (const [key, row] of Object.entries(rows)) {
    const text = (row as any)?.TextData?.LocalizedString;
    if (typeof text === "string" && key.startsWith(prefix)) out[key.slice(prefix.length)] = text;
  }
  return out;
}
```

`packages/game-data/package.json` :
```json
{
  "name": "@palworld-companion/game-data",
  "private": true,
  "type": "module",
  "exports": {
    "./*.json": "./*.json",
    "./l10n/*.json": "./l10n/*.json"
  }
}
```

`packages/pipeline/src/all.ts` (squelette — chaque tâche décommente sa ligne) :
```ts
// Orchestrateur : transforms -> index -> verify -> data-version.
// Chaque étape est un module autonome ; l'ordre importe (verify en dernier).
// await import("./transform/l10n.js");
// await import("./transform/pals.js");
// await import("./transform/items.js");
// await import("./transform/tech.js");
// await import("./transform/buildings.js");
// await import("./search-index.js");
// await import("./verify.js");
// await import("./data-version.js");
console.log("PIPELINE OK");
```

Scripts dans `packages/pipeline/package.json` :
```json
    "all": "tsx src/all.ts",
    "verify": "tsx src/verify.ts"
```

- [ ] **Step 2: Test de la lib (sur données réelles, skip si absentes)**

`packages/pipeline/src/lib.test.ts` :
```ts
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enumName, l10nMap, loadDataTableRows, pick } from "./lib.js";
import { RAW_DIR } from "./paths.js";

describe.skipIf(!existsSync(RAW_DIR))("lib (exports réels)", () => {
  it("fusionne les variantes _Common", () => {
    const rows = loadDataTableRows(/DT_PalMonsterParameter/);
    expect(Object.keys(rows).length).toBeGreaterThan(700);
  });
  it("l10nMap applique la décision Phase 0", () => {
    const names = l10nMap(/\/en\/.*DT_PalNameText/, "PAL_NAME_");
    expect(Object.keys(names).length).toBeGreaterThan(250);
    expect(names["Anubis"]).toBe("Anubis");
  });
});

describe("helpers purs", () => {
  it("pick prend le premier champ présent", () => {
    expect(pick({ B: 2 }, "A", "B")).toBe(2);
    expect(pick({}, "A")).toBeUndefined();
  });
  it("enumName déballe les enums UE", () => {
    expect(enumName("EPalElementType::Fire")).toBe("Fire");
    expect(enumName("Fire")).toBe("Fire");
  });
});
```

Installer vitest côté pipeline :
```bash
pnpm --filter @palworld-companion/pipeline add -D vitest
```

- [ ] **Step 3: Exécuter**

Run: `pnpm --filter @palworld-companion/pipeline exec vitest run && pnpm --filter @palworld-companion/pipeline all`
Expected: tests PASS, `PIPELINE OK`.

- [ ] **Step 4: Commit**

```bash
git add packages/pipeline packages/game-data pnpm-lock.yaml
git commit -m "feat(pipeline): lib promue du spike + package game-data + orchestrateur"
```

---

### Task 2: Transform L10N — noms et descriptions FR/EN namespacés

**Files:**
- Create: `packages/pipeline/src/transform/l10n.ts`
- Modify: `packages/pipeline/src/all.ts` (décommenter la ligne l10n)

**Interfaces:**
- Consumes: `l10nMap`, `writeGameData` (Task 1)
- Produces: `game-data/l10n/names.{fr,en}.json` et `descriptions.{fr,en}.json`,
  clés namespacées `pal:<id>` / `item:<id>` / `tech:<id>` / `building:<id>` /
  `skill:<id>` — consommés par l'app (helper `gameName`) et par `verify.ts`

- [ ] **Step 1: Écrire le transform**

`packages/pipeline/src/transform/l10n.ts` :
```ts
import { l10nMap, writeGameData } from "../lib.js";

// (préfixe L10N constaté Phase 0, namespace de sortie, table)
const NAME_SOURCES: Array<[RegExp, string, string]> = [
  [/DT_PalNameText/, "PAL_NAME_", "pal:"],
  [/DT_ItemNameText/, "ITEM_NAME_", "item:"],
  [/DT_SkillNameText/, "ACTION_SKILL_", "skill:"],          // préfixe à vérifier à l'inspection
  [/DT_TechnologyNameText/, "TECHNOLOGY_NAME_", "tech:"],   // idem
  [/DT_MapObjectNameText/, "MAPOBJECT_NAME_", "building:"], // idem
];
const DESC_SOURCES: Array<[RegExp, string, string]> = [
  [/DT_ItemDescriptionText/, "ITEM_DESC_", "item:"],
  [/DT_PalLongDescriptionText/, "PAL_LONG_DESC_", "pal:"],
  [/DT_TechnologyDescText/, "TECHNOLOGY_DESC_", "tech:"],
];

for (const locale of ["en", "fr"] as const) {
  const names: Record<string, string> = {};
  const descs: Record<string, string> = {};
  for (const [table, l10nPrefix, ns] of NAME_SOURCES) {
    const hint = new RegExp(`/${locale}/.*${table.source}`);
    for (const [id, text] of Object.entries(l10nMap(hint, l10nPrefix))) names[ns + id] = text;
  }
  for (const [table, l10nPrefix, ns] of DESC_SOURCES) {
    const hint = new RegExp(`/${locale}/.*${table.source}`);
    try {
      for (const [id, text] of Object.entries(l10nMap(hint, l10nPrefix))) descs[ns + id] = text;
    } catch {
      console.warn(`  (description absente pour ${table} en ${locale} — toléré)`);
    }
  }
  if (Object.keys(names).length < 800) throw new Error(`Trop peu de noms ${locale}`);
  writeGameData(`l10n/names.${locale}.json`, names);
  writeGameData(`l10n/descriptions.${locale}.json`, descs);
}
console.log("l10n OK");
```

- [ ] **Step 2: Inspecter les préfixes réels marqués « à vérifier »**

Run (pour chaque table marquée) :
```bash
node -e "
const d = require('/mnt/c/PalExports/Exports/Pal/Content/L10N/en/Pal/DataTable/Text/DT_SkillNameText_Common.json');
const rows = d.find ? d.find(o=>o.Rows).Rows : d.Rows;
console.log(Object.keys(rows).slice(0, 6));
"
```
Ajuster les préfixes dans `NAME_SOURCES` d'après la sortie (idem tech,
building). Consigner les préfixes réels dans `docs/decisions.md`.

- [ ] **Step 3: Exécuter et committer**

Décommenter `l10n` dans `all.ts`, puis :
Run: `pnpm --filter @palworld-companion/pipeline all`
Expected: 4 fichiers écrits, comptage > 800 noms par locale, `PIPELINE OK`.

```bash
git add packages/pipeline packages/game-data docs/decisions.md
git commit -m "feat(pipeline): l10n FR/EN namespacé (noms + descriptions)"
```

---

### Task 3: Transform Pals — paramètres, drops, breeding

**Files:**
- Create: `packages/pipeline/src/transform/pals.ts`
- Modify: `packages/pipeline/src/all.ts`

**Interfaces:**
- Consumes: lib (Task 1)
- Produces: `game-data/pals.json` (tableau trié par id) :
  `{ id, zukanIndex, zukanSuffix?, elements[], stats{hp,melee,shot,defense,support,craftSpeed},
  work{<type>: rang}, rarity, size, price, combiRank, maleProbability,
  drops[{itemId, min, max, rate}], nocturnal? }` ;
  `game-data/breeding.json` : `{ uniqueCombos: [{parentA, parentB, child}] }`

- [ ] **Step 1: Inspecter une ligne réelle**

```bash
node -e "
const d = require('/mnt/c/PalExports/Exports/Pal/Content/Pal/DataTable/Character/DT_PalMonsterParameter_Common.json');
const rows = d.find(o=>o.Rows).Rows;
console.log(JSON.stringify(rows['Anubis'], null, 1).slice(0, 2500));
"
```
Noter les noms exacts des champs (éléments, stats, WorkSuitability_*,
CombiRank…) et ajuster les candidats `pick()` ci-dessous si besoin.

- [ ] **Step 2: Écrire le transform**

`packages/pipeline/src/transform/pals.ts` :
```ts
import { enumName, loadDataTableRows, must, pick, writeGameData } from "../lib.js";

const params = loadDataTableRows(/DT_PalMonsterParameter/);
const dropRows = loadDataTableRows(/DT_PalDropItem/);
const nameKeys = new Set(
  Object.keys(loadDataTableRows(/\/en\/.*DT_PalNameText/)).map((k) => k.replace(/^PAL_NAME_/, "")),
);

// Drops indexés par CharacterID (une table à lignes multiples par pal).
const dropsByPal: Record<string, any[]> = {};
for (const row of Object.values(dropRows) as any[]) {
  const cid = pick<string>(row, "CharacterID", "CharacterId", "character_id");
  if (!cid) continue;
  (dropsByPal[cid] ??= []).push(row);
}

const WORK_TYPES = [
  "EmitFlame", "Watering", "Seeding", "GenerateElectricity", "Handcraft",
  "Collection", "Deforest", "Mining", "OilExtraction", "ProductMedicine",
  "Cool", "Transport", "MonsterFarm",
];

const pals = Object.entries(params)
  .filter(([id, row]: [string, any]) => {
    const zukan = pick<number>(row, "ZukanIndex", "zukan_index") ?? -1;
    return zukan > 0 && nameKeys.has(id) && pick(row, "IsPal", "is_pal") !== false;
  })
  .map(([id, row]: [string, any]) => ({
    id,
    zukanIndex: must(pick<number>(row, "ZukanIndex"), `${id}.ZukanIndex`),
    zukanSuffix: pick<string>(row, "ZukanIndexSuffix") || undefined,
    elements: [
      enumName(pick(row, "ElementType1", "Element1")),
      enumName(pick(row, "ElementType2", "Element2")),
    ].filter((e) => e && e !== "None"),
    stats: {
      hp: must(pick<number>(row, "HP", "Hp"), `${id}.HP`),
      melee: pick<number>(row, "MeleeAttack") ?? 0,
      shot: must(pick<number>(row, "ShotAttack"), `${id}.ShotAttack`),
      defense: must(pick<number>(row, "Defense", "Defence"), `${id}.Defense`),
      support: pick<number>(row, "Support") ?? 0,
      craftSpeed: pick<number>(row, "CraftSpeed") ?? 0,
    },
    work: Object.fromEntries(
      WORK_TYPES.map((w) => [w, pick<number>(row, `WorkSuitability_${w}`) ?? 0]).filter(([, v]) => (v as number) > 0),
    ),
    rarity: pick<number>(row, "Rarity") ?? 0,
    size: enumName(pick(row, "Size")),
    price: pick<number>(row, "Price") ?? 0,
    combiRank: must(pick<number>(row, "CombiRank"), `${id}.CombiRank`),
    maleProbability: pick<number>(row, "MaleProbability") ?? 50,
    nocturnal: pick<boolean>(row, "Nocturnal", "IsNocturnal") || undefined,
    drops: (dropsByPal[id] ?? []).flatMap((d: any) => {
      const out = [];
      for (let i = 1; i <= 5; i++) {
        const itemId = pick<string>(d, `ItemId${i}`, `Item${i}Id`, `StaticItemId${i}`);
        if (!itemId || itemId === "None") continue;
        out.push({
          itemId,
          min: pick<number>(d, `Min${i}`, `ItemNum${i}Min`) ?? 1,
          max: pick<number>(d, `Max${i}`, `ItemNum${i}Max`) ?? 1,
          rate: pick<number>(d, `Rate${i}`, `DropRate${i}`) ?? 100,
        });
      }
      return out;
    }),
  }))
  .sort((a, b) => a.zukanIndex - b.zukanIndex || (a.zukanSuffix ?? "").localeCompare(b.zukanSuffix ?? ""));

if (pals.length < 150 || pals.length > 500) throw new Error(`Comptage pals suspect : ${pals.length}`);
writeGameData("pals.json", pals);

// Combos de breeding uniques (exceptions à la règle du CombiRank).
const uniques = Object.values(loadDataTableRows(/DT_PalCombiUnique/)).map((row: any) => ({
  parentA: enumName(must(pick(row, "ParentTribeA", "ParentA"), "combi.ParentA")),
  parentB: enumName(must(pick(row, "ParentTribeB", "ParentB"), "combi.ParentB")),
  child: enumName(must(pick(row, "ChildCharacterID", "Child"), "combi.Child")),
}));
writeGameData("breeding.json", { uniqueCombos: uniques });
console.log(`pals OK (${pals.length} pals, ${uniques.length} combos uniques)`);
```

- [ ] **Step 3: Exécuter (ajuster les candidats pick d'après les erreurs), committer**

Décommenter `pals` dans `all.ts`.
Run: `pnpm --filter @palworld-companion/pipeline all`
Expected: `pals OK (…)`, comptage 150–500. En cas de `Champ manquant`, revenir
au Step 1, corriger le candidat, consigner le nom réel dans `docs/decisions.md`.

```bash
git add packages/pipeline packages/game-data docs/decisions.md
git commit -m "feat(pipeline): transform pals (stats, drops, breeding)"
```

---

### Task 4: Transforms Items + Recettes (intégrité croisée)

**Files:**
- Create: `packages/pipeline/src/transform/items.ts`
- Modify: `packages/pipeline/src/all.ts`

**Interfaces:**
- Consumes: lib (Task 1)
- Produces: `game-data/items.json` :
  `{ id, typeA, typeB, rarity, price, maxStack, weight, sortId }` ;
  `game-data/recipes.json` :
  `{ id, productId, count, workAmount, materials[{id, count}] }` —
  la fiche item « utilisé dans » se calcule côté app par recherche inverse

- [ ] **Step 1: Inspecter une ligne de chaque table**

```bash
node -e "
const it = require('/mnt/c/PalExports/Exports/Pal/Content/Pal/DataTable/Item/DT_ItemDataTable_Common.json');
const rows = it.find(o=>o.Rows).Rows; const k = Object.keys(rows)[5];
console.log(k, JSON.stringify(rows[k], null, 1).slice(0, 1200));
const rc = require('/mnt/c/PalExports/Exports/Pal/Content/Pal/DataTable/Item/DT_ItemRecipeDataTable_Common.json');
const rrows = rc.find(o=>o.Rows).Rows; const rk = Object.keys(rrows)[5];
console.log(rk, JSON.stringify(rrows[rk], null, 1).slice(0, 1200));
"
```

- [ ] **Step 2: Écrire le transform**

`packages/pipeline/src/transform/items.ts` :
```ts
import { enumName, loadDataTableRows, must, pick, writeGameData } from "../lib.js";

const itemRows = loadDataTableRows(/DT_ItemDataTable/);
const items = Object.entries(itemRows)
  .map(([id, row]: [string, any]) => ({
    id,
    typeA: enumName(pick(row, "TypeA", "ItemTypeA")),
    typeB: enumName(pick(row, "TypeB", "ItemTypeB")),
    rarity: pick<number>(row, "Rarity") ?? 0,
    price: pick<number>(row, "Price") ?? 0,
    maxStack: pick<number>(row, "MaxStackCount", "StackCount") ?? 1,
    weight: pick<number>(row, "Weight") ?? 0,
    sortId: pick<number>(row, "SortID", "SortId") ?? 0,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));
if (items.length < 400) throw new Error(`Comptage items suspect : ${items.length}`);
writeGameData("items.json", items);

const itemIds = new Set(items.map((i) => i.id));
const recipeRows = loadDataTableRows(/DT_ItemRecipeDataTable/);
let orphans = 0;
const recipes = Object.entries(recipeRows)
  .map(([id, row]: [string, any]) => {
    const materials = [];
    for (let i = 1; i <= 5; i++) {
      const mid = pick<string>(row, `Material${i}_Id`, `Material${i}Id`);
      const count = pick<number>(row, `Material${i}_Count`, `Material${i}Count`) ?? 0;
      if (mid && mid !== "None" && count > 0) {
        materials.push({ id: mid, count });
        if (!itemIds.has(mid)) orphans++;
      }
    }
    return {
      id,
      productId: must(pick<string>(row, "Product_Id", "ProductId"), `${id}.Product_Id`),
      count: pick<number>(row, "Product_Count", "ProductCount") ?? 1,
      workAmount: pick<number>(row, "WorkAmount") ?? 0,
      materials,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));
if (recipes.length < 200) throw new Error(`Comptage recettes suspect : ${recipes.length}`);
if (orphans > recipes.length * 0.02) throw new Error(`${orphans} matériaux orphelins (réfs vers items inconnus)`);
writeGameData("recipes.json", recipes);
console.log(`items OK (${items.length} items, ${recipes.length} recettes, ${orphans} orphelins tolérés)`);
```

- [ ] **Step 3: Exécuter, committer**

Décommenter `items` dans `all.ts`.
Run: `pnpm --filter @palworld-companion/pipeline all`
Expected: `items OK (…)`. Ajustements → `docs/decisions.md`.

```bash
git add packages/pipeline packages/game-data docs/decisions.md
git commit -m "feat(pipeline): transforms items + recettes avec intégrité croisée"
```

---

### Task 5: Transforms Technologies + Constructions

**Files:**
- Create: `packages/pipeline/src/transform/tech.ts`
- Create: `packages/pipeline/src/transform/buildings.ts`
- Modify: `packages/pipeline/src/all.ts`

**Interfaces:**
- Consumes: lib (Task 1)
- Produces: `game-data/tech.json` :
  `{ id, tier, cost, isBoss, unlocks[] }` (tier = niveau de l'arbre) ;
  `game-data/buildings.json` :
  `{ id, category, materials[{id, count}], techId? }`

- [ ] **Step 1: Inspecter**

```bash
node -e "
const t = require('/mnt/c/PalExports/Exports/Pal/Content/Pal/DataTable/Technology/DT_TechnologyRecipeUnlock_Common.json');
const rows = t.find(o=>o.Rows).Rows; const k = Object.keys(rows)[5];
console.log(k, JSON.stringify(rows[k], null, 1).slice(0, 1200));
const b = require('/mnt/c/PalExports/Exports/Pal/Content/Pal/DataTable/MapObject/Building/DT_BuildObjectDataTable.json');
const brows = b.find(o=>o.Rows).Rows; const bk = Object.keys(brows)[5];
console.log(bk, JSON.stringify(brows[bk], null, 1).slice(0, 1200));
"
```

- [ ] **Step 2: Écrire les transforms**

`packages/pipeline/src/transform/tech.ts` :
```ts
import { loadDataTableRows, must, pick, writeGameData } from "../lib.js";

const rows = loadDataTableRows(/DT_TechnologyRecipeUnlock/);
const tech = Object.entries(rows)
  .map(([id, row]: [string, any]) => {
    const unlocks = ([] as string[]).concat(
      pick<string[]>(row, "UnlockItemRecipeIDs", "UnlockRecipeIds") ?? [],
      pick<string[]>(row, "UnlockBuildObjectIDs", "UnlockBuildObjects") ?? [],
    );
    return {
      id,
      tier: must(pick<number>(row, "Tier", "LevelCap", "RequireLevel"), `${id}.Tier`),
      cost: pick<number>(row, "Cost", "RequireTechnologyPoint") ?? 0,
      isBoss: Boolean(pick(row, "IsBossTechnology", "bIsBossTechnology")),
      unlocks,
    };
  })
  .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));
if (tech.length < 100) throw new Error(`Comptage tech suspect : ${tech.length}`);
writeGameData("tech.json", tech);
console.log(`tech OK (${tech.length})`);
```

`packages/pipeline/src/transform/buildings.ts` :
```ts
import { enumName, loadDataTableRows, pick, writeGameData } from "../lib.js";

const rows = loadDataTableRows(/DT_BuildObjectDataTable/);
const buildings = Object.entries(rows)
  .map(([id, row]: [string, any]) => {
    const materials = [];
    for (let i = 1; i <= 5; i++) {
      const mid = pick<string>(row, `Material${i}_Id`, `Material${i}Id`);
      const count = pick<number>(row, `Material${i}_Count`, `Material${i}Count`) ?? 0;
      if (mid && mid !== "None" && count > 0) materials.push({ id: mid, count });
    }
    return {
      id,
      category: enumName(pick(row, "TypeA", "Category", "BuildObjectCategory")),
      materials,
      techId: pick<string>(row, "TechnologyId", "RequiredTechnology") || undefined,
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));
if (buildings.length < 100) throw new Error(`Comptage constructions suspect : ${buildings.length}`);
writeGameData("buildings.json", buildings);
console.log(`buildings OK (${buildings.length})`);
```

- [ ] **Step 3: Exécuter, committer**

Décommenter `tech` et `buildings` dans `all.ts`.
Run: `pnpm --filter @palworld-companion/pipeline all`
Expected: `tech OK`, `buildings OK`. Ajustements → `docs/decisions.md`.

```bash
git add packages/pipeline packages/game-data docs/decisions.md
git commit -m "feat(pipeline): transforms technologies + constructions"
```

---

### Task 6: Icônes — export (USER ACTION) puis conversion webp

**Files:**
- Create: `packages/pipeline/src/icons.ts`
- Create: `apps/web/static/icons/` (webp générés, committés)
- Create: `packages/game-data/icons.json` (entité → icône disponible)
- Modify: `packages/pipeline/package.json` (script `icons`)
- Modify: `docs/extraction-runbook.md` (section icônes)

**Interfaces:**
- Consumes: `DT_PalCharacterIconDataTable` + `DT_ItemIconDataTable` (mapping
  id → nom de texture), textures PNG exportées
- Produces: `apps/web/static/icons/{pals,items}/<id>.webp` (128×128) +
  `game-data/icons.json` `{ "pal:<id>": true, "item:<id>": true }` — l'app
  teste la présence via ce fichier, jamais par 404

- [ ] **Step 1: USER ACTION — exporter les textures d'icônes**

Dans FModel (clic droit sur chaque **dossier** → Save Folder's Packages
**Textures** (.png)) :
- `Pal/Content/Pal/Texture/PalIcon/Normal` (icônes de Pals)
- `Pal/Content/Others/InventoryItemIcon/Texture` (icônes d'items)
Ajouter ces deux chemins à la section « Liste des assets » du runbook.

- [ ] **Step 2: Écrire la conversion**

```bash
pnpm --filter @palworld-companion/pipeline add sharp
```

`packages/pipeline/src/icons.ts` :
```ts
import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";
import { findExports, loadDataTableRows, pick, writeGameData } from "./lib.js";
import { ICONS_OUT } from "./paths.js";

const pngByName = new Map(
  findExports(/\.png$/).map((f) => [basename(f, ".png").toLowerCase(), f]),
);

async function convert(kind: "pals" | "items", ns: string, tableHint: RegExp, idField: string[]) {
  const rows = loadDataTableRows(tableHint);
  mkdirSync(join(ICONS_OUT, kind), { recursive: true });
  const present: Record<string, boolean> = {};
  let converted = 0;
  for (const [id, row] of Object.entries(rows)) {
    // Le mapping icône est un SoftObjectPath ("...T_xxx_icon_normal.T_xxx...") ;
    // on résout par nom de fichier, insensible à la casse.
    const raw = JSON.stringify(pick(row as any, ...idField) ?? "");
    const m = raw.match(/T_[A-Za-z0-9_]+/);
    const png = m ? pngByName.get(m[0].toLowerCase()) : undefined;
    if (!png) continue;
    await sharp(png).resize(128, 128, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82 }).toFile(join(ICONS_OUT, kind, `${id}.webp`));
    present[ns + id] = true;
    converted++;
  }
  console.log(`  icônes ${kind} : ${converted}/${Object.keys(rows).length}`);
  return present;
}

const pals = await convert("pals", "pal:", /DT_PalCharacterIconDataTable/, ["Icon", "IconTexture", "TextureName"]);
const items = await convert("items", "item:", /DT_ItemIconDataTable/, ["Icon", "IconTexture", "IconName"]);
if (Object.keys(pals).length < 100 || Object.keys(items).length < 300) {
  throw new Error("Trop peu d'icônes converties — vérifier l'export des textures et le champ de mapping");
}
writeGameData("icons.json", { ...pals, ...items });
console.log("icons OK");
```

Script : `"icons": "tsx src/icons.ts"`.

- [ ] **Step 3: Exécuter, committer**

Run: `pnpm --filter @palworld-companion/pipeline icons`
Expected: `icônes pals : ≥100`, `icônes items : ≥300`, `icons OK`.
(Ajuster le champ de mapping d'après une inspection si 0 conversion.)

```bash
git add packages/pipeline packages/game-data apps/web/static/icons docs/extraction-runbook.md pnpm-lock.yaml
git commit -m "feat(pipeline): icônes pals + items en webp 128px"
```

---

### Task 7: Index de recherche + verify + data-version + branchement web

**Files:**
- Create: `packages/pipeline/src/search-index.ts`
- Create: `packages/pipeline/src/verify.ts`
- Create: `packages/pipeline/src/data-version.ts`
- Modify: `packages/pipeline/src/all.ts` (toutes lignes décommentées)
- Modify: `apps/web/package.json` (dépendance workspace game-data)
- Test: `apps/web/src/lib/game-data.test.ts`

**Interfaces:**
- Consumes: tous les artefacts des Tasks 2–6
- Produces: `game-data/search-index.json` `[{ id: "<ns><id>", fr, en }]` ;
  `game-data/data-version.json` `{ extractedAt, pipelineVersion, counts }` ;
  gate `verify.ts` (le pipeline échoue si un ID committé disparaît sans
  `id-remap.json`) ; `apps/web` importe `@palworld-companion/game-data/*.json`

- [ ] **Step 1: Index de recherche**

`packages/pipeline/src/search-index.ts` :
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeGameData } from "./lib.js";
import { OUT_DIR } from "./paths.js";

const load = (p: string) => JSON.parse(readFileSync(join(OUT_DIR, p), "utf8"));
const fr = load("l10n/names.fr.json");
const en = load("l10n/names.en.json");
const index = Object.keys(en)
  .filter((key) => fr[key] || en[key])
  .map((key) => ({ id: key, fr: fr[key] ?? en[key], en: en[key] }))
  .sort((a, b) => a.id.localeCompare(b.id));
writeGameData("search-index.json", index);
console.log(`search-index OK (${index.length} entrées)`);
```

- [ ] **Step 2: Verify (comptages, intégrité, stabilité des IDs)**

`packages/pipeline/src/verify.ts` :
```ts
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR } from "./paths.js";

const load = (p: string) => JSON.parse(readFileSync(join(OUT_DIR, p), "utf8"));
const fail = (msg: string) => { console.error(`VERIFY ÉCHEC : ${msg}`); process.exit(1); };

const pals = load("pals.json"), items = load("items.json"), recipes = load("recipes.json");
const tech = load("tech.json"), buildings = load("buildings.json");
const namesEn = load("l10n/names.en.json"), namesFr = load("l10n/names.fr.json");

// 1. Comptages plancher
if (pals.length < 150) fail(`pals: ${pals.length}`);
if (items.length < 400) fail(`items: ${items.length}`);
if (recipes.length < 200) fail(`recipes: ${recipes.length}`);
if (tech.length < 100) fail(`tech: ${tech.length}`);
if (buildings.length < 100) fail(`buildings: ${buildings.length}`);

// 2. Couverture L10N (noms manquants tolérés à 5%)
for (const [label, list, ns] of [["pals", pals, "pal:"], ["items", items, "item:"]] as const) {
  const missing = list.filter((e: any) => !namesEn[ns + e.id]).length;
  if (missing > list.length * 0.05) fail(`${label}: ${missing} noms EN manquants`);
  const missingFr = list.filter((e: any) => !namesFr[ns + e.id]).length;
  if (missingFr > list.length * 0.05) fail(`${label}: ${missingFr} noms FR manquants`);
}

// 3. Intégrité référentielle
const itemIds = new Set(items.map((i: any) => i.id));
for (const r of recipes) for (const mat of r.materials) {
  if (!itemIds.has(mat.id)) console.warn(`  réf orpheline (tolérée) : recette ${r.id} -> ${mat.id}`);
}

// 4. Stabilité des IDs vs la version committée (HEAD)
for (const file of ["pals.json", "items.json", "recipes.json", "tech.json", "buildings.json"]) {
  let committed: any[] = [];
  try {
    committed = JSON.parse(execSync(`git show HEAD:packages/game-data/${file}`, { encoding: "utf8" }));
  } catch { continue; } // premier run : rien de committé
  const now = new Set(load(file).map((e: any) => e.id));
  const remap = existsSync(join(OUT_DIR, "id-remap.json")) ? load("id-remap.json") : {};
  const lost = committed.map((e: any) => e.id).filter((id: string) => !now.has(id) && !(id in remap));
  if (lost.length > 0) fail(`${file}: IDs disparus sans id-remap.json : ${lost.slice(0, 5).join(", ")}…`);
}
console.log("VERIFY OK");
```

- [ ] **Step 3: data-version + orchestrateur complet**

`packages/pipeline/src/data-version.ts` :
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeGameData } from "./lib.js";
import { OUT_DIR } from "./paths.js";

const count = (p: string) => JSON.parse(readFileSync(join(OUT_DIR, p), "utf8")).length;
writeGameData("data-version.json", {
  extractedAt: new Date().toISOString().slice(0, 10),
  pipelineVersion: 1,
  counts: {
    pals: count("pals.json"), items: count("items.json"), recipes: count("recipes.json"),
    tech: count("tech.json"), buildings: count("buildings.json"),
  },
});
console.log("data-version OK");
```

`packages/pipeline/src/all.ts` final : toutes les lignes d'import décommentées,
dans l'ordre l10n → pals → items → tech → buildings → search-index → verify →
data-version.

- [ ] **Step 4: Brancher game-data dans l'app web**

```bash
pnpm --filter web add @palworld-companion/game-data@workspace:*
```

`apps/web/src/lib/game-data.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import pals from "@palworld-companion/game-data/pals.json";
import namesFr from "@palworld-companion/game-data/l10n/names.fr.json";

describe("game-data importable depuis l'app", () => {
  it("expose les pals avec leurs noms FR", () => {
    expect(pals.length).toBeGreaterThan(150);
    const first = pals[0] as { id: string };
    expect((namesFr as Record<string, string>)[`pal:${first.id}`]).toBeTruthy();
  });
});
```

(Si l'import JSON échoue côté TS : ajouter `"resolveJsonModule": true` dans
`apps/web/tsconfig.json` — SvelteKit l'active normalement déjà.)

- [ ] **Step 5: Double run — vérifier le déterminisme**

Run: `pnpm --filter @palworld-companion/pipeline all && git status --short packages/game-data && pnpm --filter @palworld-companion/pipeline all && git diff --stat packages/game-data`
Expected: premier run écrit tout + `VERIFY OK` ; le second run produit un
`git diff` **vide** sur game-data (hors data-version si la date a changé —
`extractedAt` est tronqué au jour, donc stable dans la journée).

Run: `pnpm --filter web exec vitest run`
Expected: tests web PASS (dont l'import game-data).

- [ ] **Step 6: Commit final de phase**

```bash
git add packages/pipeline packages/game-data apps/web pnpm-lock.yaml
git commit -m "feat(pipeline): index de recherche, verify (IDs stables), data-version, branchement web"
```
