# Descriptions actives/passives + socle d'effets — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher la description des compétences actives et passives sur la fiche de Pal, et générer un `passive-effects.json` autoritaire (socle du futur team builder).

**Architecture:** Le pipeline extrait les effets de passifs depuis `DT_PassiveSkill_Main` (ré-exportée, 1905 rows) vers `game-data/passive-effects.json`, et étend `l10n.ts` pour émettre les descriptions `skill:`/`passive:` en résolvant les placeholders `{EffectValueN}` depuis la même table. La fiche de Pal affiche `gameDesc()` en ligne sous chaque nom.

**Tech Stack:** TypeScript, tsx/vitest (pipeline), SvelteKit 5 (web), pnpm monorepo.

## Global Constraints

- Écriture game-data **déterministe** : toujours via `writeGameData()` (clés triées) — jamais de `writeFileSync` direct.
- Fallback L10N existant préservé : `gameName`/`gameDesc` = FR → EN → id. Ne pas y toucher.
- Post-traitement des descriptions **scopé aux namespaces `skill:` et `passive:`** — ne jamais modifier les descriptions `item:`/`pal:`/`tech:` existantes.
- Les transforms lisant `RAW_DIR` (`/mnt/c/PalExports/Exports`) : tests réels gardés par `describe.skipIf(!existsSync(RAW_DIR))` avec `timeout: 120_000` (convention `lib.test.ts`).
- Pas de fichier curé à la main : la donnée d'effets vient exclusivement de `DT_PassiveSkill_Main`.
- Enum UE déballé via `enumName()` existant (`"EPalPassiveSkillEffectType::MaxHP"` → `"MaxHP"`).

---

### Task 1: Helpers texte purs (`stripRichTags`, `resolveEffectPlaceholders`)

**Files:**
- Modify: `packages/pipeline/src/lib.ts` (ajout en fin de fichier)
- Test: `packages/pipeline/src/lib.test.ts` (ajout dans `describe("helpers purs")`)

**Interfaces:**
- Produces:
  - `stripRichTags(s: string): string` — retire toute balise `<…>` en gardant le texte.
  - `resolveEffectPlaceholders(text: string, values: number[]): string` — remplace `{EffectValueN}` (N∈1..4) par `values[N-1]` ; laisse le token intact si la valeur est absente.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `packages/pipeline/src/lib.test.ts`, ajouter dans le bloc `describe("helpers purs", …)` (et importer les deux fonctions depuis `./lib.js`) :

```ts
it("stripRichTags retire les balises en gardant le texte", () => {
  expect(stripRichTags("Hunger <NumRed_13>+10.0%</> faster")).toBe("Hunger +10.0% faster");
  expect(stripRichTags("plain")).toBe("plain");
});
it("resolveEffectPlaceholders substitue les valeurs positionnelles", () => {
  expect(resolveEffectPlaceholders("Defense +{EffectValue1}%", [20])).toBe("Defense +20%");
  expect(resolveEffectPlaceholders("{EffectValue1}/{EffectValue2}", [5, 30])).toBe("5/30");
});
it("resolveEffectPlaceholders laisse le token si la valeur manque", () => {
  expect(resolveEffectPlaceholders("x{EffectValue2}", [5])).toBe("x{EffectValue2}");
});
```

Mettre à jour la ligne d'import existante :

```ts
import { enumName, l10nMap, loadDataTableRows, pick, resolveEffectPlaceholders, stripRichTags } from "./lib.js";
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run: `pnpm --filter @palworld-companion/pipeline test -- lib.test.ts`
Expected: FAIL (`resolveEffectPlaceholders is not exported` / `is not a function`).

- [ ] **Step 3: Implémenter les helpers**

Ajouter en fin de `packages/pipeline/src/lib.ts` :

```ts
/** Retire les balises rich-text du jeu (<NumRed_13>…</>, <Status_Up>…) en gardant le texte. */
export function stripRichTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

/** Remplace {EffectValueN} par values[N-1] ; laisse le token si la valeur est absente. */
export function resolveEffectPlaceholders(text: string, values: number[]): string {
  return text.replace(/\{EffectValue([1-4])\}/g, (token, n) => {
    const v = values[Number(n) - 1];
    return v === undefined ? token : String(v);
  });
}
```

- [ ] **Step 4: Lancer le test → succès**

Run: `pnpm --filter @palworld-companion/pipeline test -- lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/lib.ts packages/pipeline/src/lib.test.ts
git commit -m "feat(pipeline): helpers texte purs (strip rich-text, résolution EffectValue)"
```

---

### Task 2: Parseur de passifs pur (`passive-effects.lib.ts`)

**Files:**
- Create: `packages/pipeline/src/transform/passive-effects.lib.ts`
- Test: `packages/pipeline/src/transform/passive-effects.lib.test.ts`

**Interfaces:**
- Consumes: `enumName` (`../lib.js`), types de row bruts de `DT_PassiveSkill_Main`.
- Produces:
  - `type PassiveEffect = { type: string; value: number; target: string }`
  - `type ParsedPassive = { rank: number; effects: PassiveEffect[]; values: number[] }`
  - `parsePassiveRow(row: Record<string, any>): ParsedPassive`
  - `passiveValuesById(rows: Record<string, any>): Record<string, number[]>` — map `id → [EffectValue1..4]` (pour la résolution des descriptions).

- [ ] **Step 1: Écrire les tests qui échouent**

Create `packages/pipeline/src/transform/passive-effects.lib.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { parsePassiveRow, passiveValuesById } from "./passive-effects.lib.js";

const rowLegend = {
  Rank: 4,
  EffectType1: "EPalPassiveSkillEffectType::ShotAttack", EffectValue1: 20.0, TargetType1: "EPalPassiveSkillEffectTargetType::ToSelf",
  EffectType2: "EPalPassiveSkillEffectType::Defense",    EffectValue2: 20.0, TargetType2: "EPalPassiveSkillEffectTargetType::ToSelf",
  EffectType3: "EPalPassiveSkillEffectType::MoveSpeed",  EffectValue3: 20.0, TargetType3: "EPalPassiveSkillEffectTargetType::ToSelf",
  EffectType4: "EPalPassiveSkillEffectType::no",         EffectValue4: 0.0,  TargetType4: "EPalPassiveSkillEffectTargetType::None",
};

describe("parsePassiveRow", () => {
  it("déballe les effets non vides et déduplique les slots 'no'", () => {
    const p = parsePassiveRow(rowLegend);
    expect(p.rank).toBe(4);
    expect(p.effects).toEqual([
      { type: "ShotAttack", value: 20, target: "ToSelf" },
      { type: "Defense", value: 20, target: "ToSelf" },
      { type: "MoveSpeed", value: 20, target: "ToSelf" },
    ]);
    expect(p.values).toEqual([20, 20, 20, 0]);
  });
});

describe("passiveValuesById", () => {
  it("indexe les valeurs positionnelles par id", () => {
    expect(passiveValuesById({ Legend: rowLegend })).toEqual({ Legend: [20, 20, 20, 0] });
  });
});
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run: `pnpm --filter @palworld-companion/pipeline test -- passive-effects.lib.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter le module pur**

Create `packages/pipeline/src/transform/passive-effects.lib.ts` :

```ts
import { enumName } from "../lib.js";

export type PassiveEffect = { type: string; value: number; target: string };
export type ParsedPassive = { rank: number; effects: PassiveEffect[]; values: number[] };

const SLOTS = [1, 2, 3, 4] as const;

/** Déballe une row PalPassiveSkillDatabaseRow en effets structurés + valeurs positionnelles. */
export function parsePassiveRow(row: Record<string, any>): ParsedPassive {
  const values = SLOTS.map((i) => Number(row[`EffectValue${i}`] ?? 0));
  const effects: PassiveEffect[] = [];
  for (const i of SLOTS) {
    const type = enumName(row[`EffectType${i}`]);
    if (!type || type === "no") continue;
    effects.push({
      type,
      value: Number(row[`EffectValue${i}`] ?? 0),
      target: enumName(row[`TargetType${i}`]) ?? "ToSelf",
    });
  }
  return { rank: Number(row.Rank ?? 0), effects, values };
}

/** Map id -> [EffectValue1..4] pour résoudre les placeholders des descriptions. */
export function passiveValuesById(rows: Record<string, any>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [id, row] of Object.entries(rows)) out[id] = parsePassiveRow(row).values;
  return out;
}
```

- [ ] **Step 4: Lancer le test → succès**

Run: `pnpm --filter @palworld-companion/pipeline test -- passive-effects.lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/transform/passive-effects.lib.ts packages/pipeline/src/transform/passive-effects.lib.test.ts
git commit -m "feat(pipeline): parseur pur des effets de passifs"
```

---

### Task 3: Transform `passive-effects.ts` → `passive-effects.json`

**Files:**
- Create: `packages/pipeline/src/transform/passive-effects.ts`
- Modify: `packages/pipeline/src/all.ts` (enregistrement)
- Test: `packages/pipeline/src/transform/passive-effects.lib.test.ts` (ajout d'un test d'intégration réel)

**Interfaces:**
- Consumes: `loadDataTableRows`, `l10nMap`, `writeGameData` (`../lib.js`) ; `parsePassiveRow` (`./passive-effects.lib.js`).
- Produces: `packages/game-data/passive-effects.json` = `Record<string, { rank: number; effects: PassiveEffect[] }>` (seuls les passifs ayant un nom localisé et ≥1 effet).

- [ ] **Step 1: Écrire un test d'intégration réel qui échoue**

Ajouter à `packages/pipeline/src/transform/passive-effects.lib.test.ts` (le module pur est réutilisé sur données réelles ; garde `skipIf`) :

```ts
import { existsSync } from "node:fs";
import { loadDataTableRows } from "../lib.js";
import { RAW_DIR } from "../paths.js";

describe.skipIf(!existsSync(RAW_DIR))("passifs (exports réels)", () => {
  it("couvre les IDs innés avec les bonnes valeurs", { timeout: 120_000 }, () => {
    const rows = loadDataTableRows(/DT_PassiveSkill_Main/);
    expect(Object.keys(rows).length).toBeGreaterThan(1000);
    const def = parsePassiveRow(rows["Deffence_up2_2"]);
    expect(def.effects[0]).toEqual({ type: "Defense", value: 20, target: "ToSelf" });
    expect(def.values[0]).toBe(20);
  });
});
```

Run: `pnpm --filter @palworld-companion/pipeline test -- passive-effects.lib.test.ts`
Expected: PASS si `RAW_DIR` présent (le module pur existe déjà) — sinon SKIP. Ce test verrouille le contrat de données ; il ne doit pas casser. S'il échoue (valeurs ≠ 20), stopper et investiguer la donnée avant de continuer.

- [ ] **Step 2: Implémenter le transform**

Create `packages/pipeline/src/transform/passive-effects.ts` :

```ts
import { l10nMap, loadDataTableRows, writeGameData } from "../lib.js";
import { parsePassiveRow, type PassiveEffect } from "./passive-effects.lib.js";

const rows = loadDataTableRows(/DT_PassiveSkill_Main/);
// On ne garde que les passifs "réels" (dotés d'un nom localisé) : écarte TestSkill* et internes.
const named = new Set(Object.keys(l10nMap(/\/en\/.*DT_SkillNameText/, "PASSIVE_")));

const out: Record<string, { rank: number; effects: PassiveEffect[] }> = {};
for (const [id, row] of Object.entries(rows)) {
  if (!named.has(id)) continue;
  const { rank, effects } = parsePassiveRow(row as Record<string, any>);
  if (effects.length === 0) continue;
  out[id] = { rank, effects };
}

writeGameData("passive-effects.json", out);
console.log(`passive-effects OK (${Object.keys(out).length} passifs)`);
```

- [ ] **Step 3: Enregistrer dans l'orchestrateur**

Dans `packages/pipeline/src/all.ts`, ajouter la ligne après `skills.js` :

```ts
await import("./transform/skills.js");
await import("./transform/passive-effects.js");
```

- [ ] **Step 4: Générer et vérifier la sortie**

Run: `pnpm --filter @palworld-companion/pipeline exec tsx src/transform/passive-effects.ts`
Expected: log `passive-effects OK (N passifs)` avec N > 100, et `game-data/passive-effects.json` créé.

Run: `python3 -c "import json; d=json.load(open('packages/game-data/passive-effects.json')); print(len(d)); print(d['Legend'])"`
Expected: N > 100 et `{'rank': 4, 'effects': [{'target': 'ToSelf', 'type': 'ShotAttack', 'value': 20}, …]}`.

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/src/transform/passive-effects.ts packages/pipeline/src/all.ts packages/pipeline/src/transform/passive-effects.lib.test.ts packages/game-data/passive-effects.json
git commit -m "feat(pipeline): génère passive-effects.json (socle team builder)"
```

---

### Task 4: Descriptions `skill:`/`passive:` dans `l10n.ts`

**Files:**
- Modify: `packages/pipeline/src/transform/l10n.ts`

**Interfaces:**
- Consumes: `resolveEffectPlaceholders`, `stripRichTags`, `loadDataTableRows` (`../lib.js`) ; `passiveValuesById` (`./passive-effects.lib.js`).
- Produces: clés `skill:*` (~335) et `passive:*` (résolues) dans `game-data/l10n/descriptions.{en,fr}.json`.

- [ ] **Step 1: Étendre `DESC_SOURCES`**

Dans `packages/pipeline/src/transform/l10n.ts`, ajouter deux entrées à `DESC_SOURCES` :

```ts
const DESC_SOURCES: Array<[RegExp, string, string]> = [
  [/DT_ItemDescriptionText/, "ITEM_DESC_", "item:"],
  [/DT_PalLongDescriptionText/, "PAL_LONG_DESC_", "pal:"],
  [/DT_TechnologyDescText/, "DESC_", "tech:"],
  [/DT_SkillDescText/, "ACTION_SKILL_", "skill:"],
  [/DT_SkillDescText/, "PASSIVE_", "passive:"],
];
```

- [ ] **Step 2: Ajouter les imports**

En tête de `l10n.ts`, compléter l'import de `../lib.js` et ajouter le parseur :

```ts
import {
  isL10nPlaceholder, l10nMap, loadDataTableRows, resolveEffectPlaceholders, stripRichTags, writeGameData,
} from "../lib.js";
import { passiveValuesById } from "./passive-effects.lib.js";
```

- [ ] **Step 3: Charger les valeurs d'effet une seule fois**

Juste avant la boucle `for (const locale of ["en", "fr"] as const) {`, ajouter :

```ts
const passiveValues = passiveValuesById(loadDataTableRows(/DT_PassiveSkill_Main/));
```

- [ ] **Step 4: Résoudre placeholders + nettoyer, scopé skill/passive**

Dans la boucle `for locale`, **après** le bloc existant qui résout les templates `<itemName …/>`
des descriptions (la boucle `for (const [key, text] of Object.entries(descs))` se terminant
ligne ~59) et **avant** `writeGameData(...descriptions...)`, insérer :

```ts
// Descriptions actives/passives : résolution des {EffectValueN} + nettoyage rich-text.
// Scopé à skill:/passive: pour ne pas régresser item:/pal:/tech:.
for (const key of Object.keys(descs)) {
  if (key.startsWith("passive:")) {
    const id = key.slice("passive:".length);
    const resolved = stripRichTags(resolveEffectPlaceholders(descs[key], passiveValues[id] ?? []));
    if (/\{EffectValue\d\}/.test(resolved)) {
      delete descs[key]; // valeur d'effet absente -> l'UI retombe sur le nom seul
    } else {
      descs[key] = resolved;
    }
  } else if (key.startsWith("skill:")) {
    descs[key] = stripRichTags(descs[key]);
  }
}
```

- [ ] **Step 5: Générer et vérifier**

Run: `pnpm --filter @palworld-companion/pipeline exec tsx src/transform/l10n.ts`
Expected: log `l10n OK`.

Run:
```bash
python3 -c "
import json
d=json.load(open('packages/game-data/l10n/descriptions.en.json'))
sk=[k for k in d if k.startswith('skill:')]; pa=[k for k in d if k.startswith('passive:')]
print('skill:',len(sk),'passive:',len(pa))
print('Deffence_up2_2 ->', d.get('passive:Deffence_up2_2'))
assert not any('{EffectValue' in d[k] for k in pa), 'placeholder résiduel'
print('OK: aucun placeholder résiduel')
"
```
Expected: `skill:` ~335, `passive:` ~50+, `passive:Deffence_up2_2 -> Defense +20%\r\nImmune to Knockback`, `OK: aucun placeholder résiduel`.

- [ ] **Step 6: Commit**

```bash
git add packages/pipeline/src/transform/l10n.ts packages/game-data/l10n/descriptions.en.json packages/game-data/l10n/descriptions.fr.json
git commit -m "feat(pipeline): descriptions actives + passives (placeholders résolus)"
```

---

### Task 5: Planchers de vérification (`verify.ts`)

**Files:**
- Modify: `packages/pipeline/src/verify.ts`

**Interfaces:**
- Consumes: `passive-effects.json`, `l10n/descriptions.en.json` (via `load()` existant).

- [ ] **Step 1: Ajouter les contrôles**

Dans `packages/pipeline/src/verify.ts`, après le bloc « 1. Comptages plancher » (après la ligne
`if (markers.length < 400) fail(...)`), ajouter :

```ts
// 1b. Descriptions & effets de passifs
const passiveEffects = load("passive-effects.json");
const descsEn = load("l10n/descriptions.en.json");
const nEffects = Object.keys(passiveEffects).length;
if (nEffects < 100) fail(`passive-effects: ${nEffects}`);
const nSkillDesc = Object.keys(descsEn).filter((k: string) => k.startsWith("skill:")).length;
const nPassiveDesc = Object.keys(descsEn).filter((k: string) => k.startsWith("passive:")).length;
if (nSkillDesc < 200) fail(`descriptions skill: ${nSkillDesc}`);
if (nPassiveDesc < 30) fail(`descriptions passive: ${nPassiveDesc}`);
for (const [k, v] of Object.entries(descsEn) as [string, string][])
  if (k.startsWith("passive:") && /\{EffectValue\d\}/.test(v)) fail(`placeholder non résolu: ${k}`);
```

- [ ] **Step 2: Lancer verify (après régénération complète)**

Run: `pnpm --filter @palworld-companion/pipeline all`
Expected: se termine par `VERIFY OK` puis `PIPELINE OK` (les nouveaux planchers passent, `passive-effects.json` et `search-index.json` régénérés de façon cohérente).

- [ ] **Step 3: Commit (game-data régénéré + verify)**

```bash
git add packages/pipeline/src/verify.ts packages/game-data/
git commit -m "chore(pipeline): planchers verify pour descriptions + effets de passifs"
```

---

### Task 6: Affichage des descriptions sur la fiche de Pal

**Files:**
- Modify: `apps/web/src/routes/s/[slug]/paldex/[palId]/+page.svelte`

**Interfaces:**
- Consumes: `gameDesc` (déjà importé ligne 7), clés `passive:<id>` et `skill:<id>` désormais peuplées.

- [ ] **Step 1: Description sous chaque passif**

Remplacer le bloc passifs (l.93-100) par :

```svelte
{#if pal.passives.length}
	<h2>{m.pal_passives()}</h2>
	<ul class="plain">
		{#each pal.passives as p (p)}
			<li>
				<span class="pname">{gameName(`passive:${p}`)}</span>
				{#if gameDesc(`passive:${p}`)}<span class="pdesc">{gameDesc(`passive:${p}`)}</span>{/if}
			</li>
		{/each}
	</ul>
{/if}
```

- [ ] **Step 2: Description sous chaque attaque**

Remplacer le `{#each palMoves …}` (l.119-127) par une li en colonne (ligne de stats + description) :

```svelte
{#each palMoves as mv (mv.skillId)}
	{@const sk = (skills as Record<string, { element?: string; power?: number }>)[mv.skillId]}
	<li>
		<div class="mv-row">
			<span class="mv-level tnum">Niv. {mv.level}</span>
			<span class="mv-name">{gameName(`skill:${mv.skillId}`)}</span>
			{#if sk?.element}<ElementBadge element={sk.element} />{/if}
			{#if sk?.power}<span class="mv-power tnum">{sk.power}</span>{/if}
		</div>
		{#if gameDesc(`skill:${mv.skillId}`)}<span class="pdesc">{gameDesc(`skill:${mv.skillId}`)}</span>{/if}
	</li>
{/each}
```

- [ ] **Step 3: Styles**

Dans le `<style>`, remplacer la règle `.moves li { … }` (l.320-326) par les règles ci-dessous et
ajouter `.plain li` + `.pdesc` (garder `.work li, .plain li { color; font-size }` existant tel quel) :

```css
	.plain li {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.moves li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 13px;
		padding: 4px 0;
	}
	.mv-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pdesc {
		color: var(--text-3);
		font-size: 12px;
		text-wrap: pretty;
	}
```

- [ ] **Step 4: Vérifier types + build**

Run: `pnpm --filter @palworld-companion/web check`
Expected: 0 erreur svelte-check.

Run: `pnpm --filter @palworld-companion/web build`
Expected: build réussi.

- [ ] **Step 5: Vérification visuelle**

Run: `pnpm --filter @palworld-companion/web dev`
Ouvrir une fiche de Pal ayant des passifs innés (ex. un Pal de rareté légendaire / avec `Legend`
ou `Deffence_up2_2`). Confirmer :
- sous chaque **passif** : une ligne de description atténuée (ex. « Defense +20% … ») quand elle existe ;
- sous chaque **attaque** : une ligne de description atténuée sous la ligne niveau/élément/puissance.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/routes/s/\[slug\]/paldex/\[palId\]/+page.svelte
git commit -m "feat(web): descriptions actives et passives sur la fiche de Pal"
```

---

## Self-Review

- **Couverture spec** : extraction effets (T2/T3), descriptions actives (T4), descriptions passives + résolution placeholders (T1/T4), `passive-effects.json` socle (T3), affichage en ligne (T6), planchers/verify (T5). ✅
- **Placeholders de plan** : aucun TODO/TBD ; code complet à chaque step. ✅
- **Cohérence des types** : `parsePassiveRow`/`passiveValuesById`/`PassiveEffect` définis en T2 et consommés à l'identique en T3 (transform) et T4 (l10n) ; `resolveEffectPlaceholders`/`stripRichTags` définis en T1 et consommés en T4. ✅
- **Scoping** : post-traitement descriptions limité à `skill:`/`passive:` (contrainte globale) — pas de régression `item:`/`pal:`/`tech:`. ✅
- **Ordre d'exécution** : `passive-effects.ts` lit `RAW_DIR` (indépendant de l10n) ; `passive-effects.lib.ts` est pur (importé par l10n sans effet de bord). Pas de dépendance de fichier généré entre transforms. ✅
