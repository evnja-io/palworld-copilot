# Phase 0 — Spike d'extraction : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Particularité de ce plan** : plusieurs tâches contiennent des étapes marquées
> **USER ACTION** (FModel est un outil GUI Windows ; les fichiers du serveur de jeu
> ne sont accessibles qu'à l'utilisateur). L'agent prépare tout, l'utilisateur
> exécute ces étapes, l'agent vérifie les résultats. L'exécution inline
> (superpowers:executing-plans) est recommandée pour ce plan précis.

**Goal:** Prouver, avant d'écrire le moindre code applicatif, que chaque domaine de données (Pals, items, recettes, tech, POI carte, L10N FR/EN, saves serveur) est extractible et exploitable, et trancher les deux inconnues bloquantes (sémantique des coffres, corrélation GUIDs de save ↔ IDs dataminés).

**Architecture:** Workspace pnpm minimal avec un seul package `packages/pipeline` contenant des scripts de spike jetables (tsx). Les exports FModel bruts vont dans `packages/pipeline/raw/` (gitignoré). Les conclusions vont dans `docs/` (committées) : runbook d'extraction reproductible + registre de décisions.

**Tech Stack:** Node 22, pnpm 11, TypeScript + tsx (scripts), FModel (Windows, GUI), palworld-save-tools (CLI Python, spike uniquement), zlib/GVAS (lecture seule).

## Global Constraints

- Périmètre spec : `docs/superpowers/specs/2026-07-21-palworld-companion-design.md`
- Node 22 / pnpm 11 (versions présentes sur la machine, vérifiées)
- Jeu installé : `/mnt/c/Program Files (x86)/Steam/steamapps/common/Palworld/` (pak 38 Go)
- Exports FModel côté Windows dans `C:\PalExports` → visibles sous `/mnt/c/PalExports`
- `packages/pipeline/raw/**` et `packages/pipeline/out/**` ne sont **jamais** committés
- Les scripts de spike vivent dans `packages/pipeline/spike/` — code jetable, pas de TDD,
  mais chaque script se termine par des assertions imprimant `SPIKE OK` ou échouant bruyamment
- Aucune dépendance au-delà de : `tsx`, `typescript`, `@types/node` (spike Python isolé dans un venv)
- Langue des documents produits : français (docs internes au projet)

---

### Task 1: Workspace pnpm minimal + package pipeline

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `.gitignore`
- Create: `packages/pipeline/package.json`
- Create: `packages/pipeline/tsconfig.json`
- Create: `packages/pipeline/spike/smoke.ts`

**Interfaces:**
- Consumes: rien (racine du projet, seuls `docs/` et `.agents/` existent)
- Produces: workspace installable ; commande `pnpm --filter pipeline spike:smoke`
  que les tâches suivantes déclinent (`spike:pals`, `spike:coords`, …)

- [ ] **Step 1: Créer les fichiers du workspace**

`pnpm-workspace.yaml` :
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`package.json` :
```json
{
  "name": "palworld-companion",
  "private": true,
  "packageManager": "pnpm@11.3.0",
  "engines": { "node": ">=22" }
}
```

`.gitignore` :
```gitignore
node_modules/
packages/pipeline/raw/
packages/pipeline/out/
.env
.env.*
!.env.example
.vercel/
.svelte-kit/
__pycache__/
.venv/
```

`packages/pipeline/package.json` :
```json
{
  "name": "@palworld-companion/pipeline",
  "private": true,
  "type": "module",
  "scripts": {
    "spike:smoke": "tsx spike/smoke.ts"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

`packages/pipeline/tsconfig.json` :
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["spike", "src"]
}
```

`packages/pipeline/spike/smoke.ts` :
```ts
import { existsSync } from "node:fs";

const pakDir = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Palworld/Pal/Content/Paks";
if (!existsSync(pakDir)) {
  console.error(`ECHEC : dossier Paks introuvable : ${pakDir}`);
  process.exit(1);
}
console.log("SPIKE OK — workspace opérationnel, jeu localisé");
```

- [ ] **Step 2: Installer et vérifier**

Run: `pnpm install && pnpm --filter @palworld-companion/pipeline spike:smoke`
Expected: se termine par `SPIKE OK — workspace opérationnel, jeu localisé`

- [ ] **Step 3: Commit**

```bash
git add pnpm-workspace.yaml package.json .gitignore packages/pipeline pnpm-lock.yaml
git commit -m "chore: workspace pnpm + package pipeline (spike Phase 0)"
```

---

### Task 2: Runbook d'extraction FModel (première version)

**Files:**
- Create: `docs/extraction-runbook.md`

**Interfaces:**
- Consumes: rien
- Produces: procédure que l'utilisateur suit en Task 3 ; sera corrigée en Task 8
  avec les chemins d'assets réellement constatés

- [ ] **Step 1: Rédiger le runbook**

`docs/extraction-runbook.md` :
```markdown
# Runbook d'extraction — FModel (Windows)

Statut : v0 (Phase 0). Les chemins d'assets exacts seront confirmés pendant le
spike et corrigés ici.

## Installation (une fois)

1. Installer le runtime « .NET Desktop Runtime 8 » si absent.
2. Télécharger FModel : https://fmodel.app → dézipper, lancer `FModel.exe`.
3. Au premier lancement, ajouter le jeu : Directory selector →
   `C:\Program Files (x86)\Steam\steamapps\common\Palworld`.
4. Settings → General : UE Versions = `GAME_UE5_1`.
5. Récupérer sur https://github.com/elliotks/Palworld-FModel :
   - le fichier `.usmap` (mappings) → Settings → Advanced → Mappings file path ;
   - la clé AES → Directory → AES Keys → coller la clé principale.
6. Créer `C:\PalExports`. Settings → General → Output Directory = `C:\PalExports`.
7. Charger l'archive : onglet Archives → double-clic sur `Pal-Windows.pak`.
   ⚠️ Le pak fait 38 Go : la première indexation prend plusieurs minutes.

## Exporter une DataTable en JSON

Naviguer dans l'arborescence (onglet Folders) → clic droit sur l'asset →
**Save Properties (.json)**. Le JSON atterrit sous
`C:\PalExports\Exports\Pal\Content\...` en miroir du chemin d'asset.

## Exporter une texture en PNG

Clic droit sur l'asset texture → **Save Texture (.png)**.

## Où chercher (à confirmer pendant le spike)

- DataTables : `Pal/Content/Pal/DataTable/` (sous-dossiers par domaine).
  Croiser avec les noms d'assets cités dans le code de
  https://github.com/oMaN-Rod/palworld-save-pal et
  https://github.com/blaynem/paldex si un nom ne saute pas aux yeux.
- Localisation : `Pal/Content/L10N/en/` et `Pal/Content/L10N/fr/`
  (DataTables de texte : noms de Pals, d'items, descriptions…).
- Carte du monde : `Pal/Content/Pal/Texture/UI/Map/T_WorldMap`.
  Chercher aussi les textures des îles DLC (Sakurajima, Feybreak) dans le même
  voisinage — noter leurs chemins exacts ici.

## Rapatrier vers WSL

Rien à copier : le dépôt lit directement `/mnt/c/PalExports`. Les scripts du
projet pointent dessus via la variable d'environnement `RAW_DIR`
(défaut : `/mnt/c/PalExports/Exports`).

## À chaque mise à jour du jeu

1. Steam met à jour le pak → relancer FModel, recharger l'archive.
2. Refaire les exports listés ci-dessus (mêmes assets).
3. Côté WSL : relancer le pipeline (voir README du package pipeline, Phase 2).
```

- [ ] **Step 2: Commit**

```bash
git add docs/extraction-runbook.md
git commit -m "docs: runbook d'extraction FModel v0"
```

---

### Task 3: Exports FModel (USER ACTION) + inventaire vérifié

**Files:**
- Create: `packages/pipeline/spike/inventory.ts`
- Modify: `packages/pipeline/package.json` (ajout du script `spike:inventory`)

**Interfaces:**
- Consumes: runbook Task 2
- Produces: exports JSON/PNG sous `/mnt/c/PalExports/Exports/**`, consommés par
  les Tasks 4–7 ; `spike/inventory.ts` qui liste ce qui est présent/manquant

- [ ] **Step 1: Écrire le script d'inventaire**

`packages/pipeline/spike/inventory.ts` :
```ts
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAW_DIR = process.env.RAW_DIR ?? "/mnt/c/PalExports/Exports";

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

const files = walk(RAW_DIR);
const json = files.filter((f) => f.endsWith(".json"));
const png = files.filter((f) => f.endsWith(".png"));

console.log(`Fichiers exportés sous ${RAW_DIR} : ${files.length}`);
console.log(`  JSON : ${json.length}`);
for (const f of json) console.log(`    ${f.replace(RAW_DIR + "/", "")}`);
console.log(`  PNG  : ${png.length}`);
for (const f of png) console.log(`    ${f.replace(RAW_DIR + "/", "")}`);

// Domaines attendus pour le spike (recherche par nom de fichier, insensible à la casse)
const expect: Record<string, RegExp> = {
  "pals (paramètres monstres)": /monsterparameter/i,
  "items": /itemdata|itemname/i,
  "recettes ou technologies": /recipe|technology/i,
  "L10N EN": /\/en\//i,
  "L10N FR": /\/fr\//i,
  "carte (texture)": /worldmap/i,
  "POI (effigies/lifmunk ou relic)": /lifmunk|relic|effig/i,
};
let missing = 0;
for (const [label, re] of Object.entries(expect)) {
  const hit = files.find((f) => re.test(f));
  console.log(hit ? `✔ ${label}` : `✘ MANQUANT : ${label}`);
  if (!hit) missing++;
}
if (missing > 0) {
  console.error(`\n${missing} domaine(s) manquant(s) — compléter les exports FModel.`);
  process.exit(1);
}
console.log("\nSPIKE OK — inventaire complet");
```

Ajouter dans `packages/pipeline/package.json`, bloc `scripts` :
```json
    "spike:inventory": "tsx spike/inventory.ts"
```

- [ ] **Step 2: USER ACTION — exporter depuis FModel (côté Windows)**

Suivre le runbook (`docs/extraction-runbook.md`). Exporter en JSON (« Save
Properties ») au minimum :

1. La table des paramètres de Pals (chercher `MonsterParameter` dans
   `Pal/Content/Pal/DataTable/`).
2. Une table d'items (chercher `ItemData`) et sa table de noms L10N.
3. Une table de recettes ou de technologies (chercher `Recipe` / `Technology`).
4. Les DataTables L10N de noms : au minimum noms de Pals et noms d'items,
   dans `L10N/en/...` **et** `L10N/fr/...`.
5. Toute table évoquant les effigies/POI (chercher `Lifmunk`, `Relic`, `Effig`
   — croiser avec les noms d'assets du code de palworld-save-pal si introuvable).
6. Toute table évoquant les coffres (`TreasureBox`, `Chest`) — pour Task 6.
7. En PNG : `T_WorldMap` (+ noter les chemins des cartes DLC s'ils se présentent).

- [ ] **Step 3: Vérifier l'inventaire**

Run: `pnpm --filter @palworld-companion/pipeline spike:inventory`
Expected: liste des exports puis `SPIKE OK — inventaire complet`.
Si `✘ MANQUANT` : retourner dans FModel, compléter, relancer.

- [ ] **Step 4: Commit (script seul — les exports restent hors git)**

```bash
git add packages/pipeline/spike/inventory.ts packages/pipeline/package.json
git commit -m "feat(spike): inventaire des exports FModel"
```

---

### Task 4: Spike Pals + jointure L10N FR/EN

**Files:**
- Create: `packages/pipeline/spike/lib.ts`
- Create: `packages/pipeline/spike/pals.ts`
- Modify: `packages/pipeline/package.json` (script `spike:pals`)

**Interfaces:**
- Consumes: exports Task 3 (`RAW_DIR`)
- Produces: `spike/lib.ts` avec `loadDataTableRows(pathHint: RegExp): Record<string, any>`
  et `findExport(pathHint: RegExp): string` — réutilisés par les Tasks 5, 6, 7

- [ ] **Step 1: Écrire le helper de lecture des exports FModel**

`packages/pipeline/spike/lib.ts` :
```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const RAW_DIR = process.env.RAW_DIR ?? "/mnt/c/PalExports/Exports";

export function walk(dir: string, acc: string[] = []): string[] {
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

export function findExport(pathHint: RegExp): string {
  const hit = walk(RAW_DIR).find((f) => f.endsWith(".json") && pathHint.test(f));
  if (!hit) throw new Error(`Aucun export JSON ne matche ${pathHint}`);
  return hit;
}

/** Un export FModel « Save Properties » d'une DataTable est un tableau d'objets ;
 *  celui de type DataTable porte une clé Rows { rowName: {props} }. */
export function loadDataTableRows(pathHint: RegExp): Record<string, any> {
  const file = findExport(pathHint);
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  const dt = arr.find((o) => o && typeof o === "object" && "Rows" in o);
  if (!dt) throw new Error(`Pas de clé Rows dans ${file} — pas une DataTable ?`);
  console.log(`  source : ${file}`);
  return dt.Rows;
}
```

- [ ] **Step 2: Écrire le spike Pals**

`packages/pipeline/spike/pals.ts` :
```ts
import { loadDataTableRows } from "./lib.js";

console.log("== Table des Pals ==");
const pals = loadDataTableRows(/monsterparameter/i);
const ids = Object.keys(pals);
console.log(`  lignes : ${ids.length}`);

console.log("== L10N noms de Pals ==");
const namesEn = loadDataTableRows(/\/en\/.*(pal.*name|name.*pal)/i);
const namesFr = loadDataTableRows(/\/fr\/.*(pal.*name|name.*pal)/i);

// Les IDs des tables L10N sont typiquement préfixés (ex. PAL_NAME_<id>) :
// on cherche la jointure par inclusion, et on l'affiche pour la documenter.
const sample = ids.filter((id) => !/^boss_/i.test(id)).slice(0, 5);
let joined = 0;
for (const id of sample) {
  const en = Object.entries(namesEn).find(([k]) => k.toLowerCase().includes(id.toLowerCase()));
  const fr = Object.entries(namesFr).find(([k]) => k.toLowerCase().includes(id.toLowerCase()));
  const text = (row: any) =>
    row?.TextData?.LocalizedString ?? row?.LocalizedString ?? JSON.stringify(row).slice(0, 80);
  console.log(`  ${id}: EN=${en ? text(en[1]) : "??"} | FR=${fr ? text(fr[1]) : "??"}`);
  if (en && fr) joined++;
}

if (ids.length < 150) throw new Error(`Trop peu de Pals (${ids.length}) — mauvaise table ?`);
if (joined < 3) throw new Error(`Jointure L10N trop faible (${joined}/5) — clés à documenter`);
console.log("SPIKE OK — pals + L10N FR/EN joignables");
```

Ajouter dans `scripts` : `"spike:pals": "tsx spike/pals.ts"`.

- [ ] **Step 3: Exécuter**

Run: `pnpm --filter @palworld-companion/pipeline spike:pals`
Expected: 5 lignes `<id>: EN=... | FR=...` puis `SPIKE OK`.
Si échec de jointure : noter le format réel des clés L10N (l'agent inspecte les
JSON et adapte le script — c'est le but du spike), consigner le format constaté
dans `docs/decisions.md` en Task 8.

- [ ] **Step 4: Commit**

```bash
git add packages/pipeline/spike/lib.ts packages/pipeline/spike/pals.ts packages/pipeline/package.json
git commit -m "feat(spike): lecture DataTables + jointure L10N validées sur les Pals"
```

---

### Task 5: Spike coordonnées — 5 effigies sur la carte

**Files:**
- Create: `packages/pipeline/spike/coords.ts`
- Modify: `packages/pipeline/package.json` (script `spike:coords`)

**Interfaces:**
- Consumes: `loadDataTableRows` (Task 4), export POI effigies (Task 3)
- Produces: constantes de transformation validées, reprises telles quelles par le
  pipeline de la Phase 2 (`transform/coords.ts`)

- [ ] **Step 1: Écrire le spike**

`packages/pipeline/spike/coords.ts` :
```ts
import { loadDataTableRows } from "./lib.js";

/** Transformation documentée (github.com/palworldlol/palworld-coord, MIT ;
 *  recoupée par palworld.wiki.gg/wiki/Maps) — île principale uniquement. */
export function worldToMap(worldX: number, worldY: number): [number, number] {
  const mapX = (worldY - 158000) / 459;
  const mapY = (worldX + 123888) / 459;
  return [Math.round(mapX * 10) / 10, Math.round(mapY * 10) / 10];
}

console.log("== POI effigies ==");
const rows = loadDataTableRows(/lifmunk|relic|effig/i);
const entries = Object.entries(rows).slice(0, 5);
if (entries.length < 5) throw new Error("Moins de 5 effigies dans la table");

for (const [rowName, row] of entries) {
  // Les coordonnées monde sont typiquement dans row.Location {X,Y,Z} ou des
  // champs plats X/Y — afficher le brut si la structure diffère, puis adapter.
  const loc = (row as any).Location ?? row;
  const wx = Number(loc.X ?? loc.x);
  const wy = Number(loc.Y ?? loc.y);
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) {
    console.log(`  ${rowName}: structure inattendue → ${JSON.stringify(row).slice(0, 200)}`);
    throw new Error("Champ de coordonnées à identifier — inspecter le JSON exporté");
  }
  const [mx, my] = worldToMap(wx, wy);
  console.log(`  ${rowName}: monde(${wx}, ${wy}) → carte(${mx}, ${my})`);
}
console.log("\nComparer manuellement ces 5 positions avec palworld.wiki.gg (carte");
console.log("des effigies). Tolérance ±5 unités carte. Verdict humain requis.");
console.log("SPIKE OK — transformation appliquée (validation visuelle à consigner)");
```

Ajouter dans `scripts` : `"spike:coords": "tsx spike/coords.ts"`.

- [ ] **Step 2: Exécuter puis valider visuellement (USER ACTION)**

Run: `pnpm --filter @palworld-companion/pipeline spike:coords`
Expected: 5 lignes `monde(...) → carte(...)` puis `SPIKE OK`.
USER ACTION : comparer avec la carte des effigies du wiki
(https://palworld.wiki.gg) — confirmer que les 5 positions collent (±5).
Le verdict (OK / écart constaté) est consigné en Task 8.

- [ ] **Step 3: Commit**

```bash
git add packages/pipeline/spike/coords.ts packages/pipeline/package.json
git commit -m "feat(spike): transformation coordonnées monde -> carte sur 5 effigies"
```

---

### Task 6: Décision coffres (fixes vs spawners)

**Files:**
- Create: `docs/decisions.md`
- Create: `packages/pipeline/spike/chests.ts`
- Modify: `packages/pipeline/package.json` (script `spike:chests`)

**Interfaces:**
- Consumes: `loadDataTableRows` (Task 4), export coffres (Task 3)
- Produces: décision consignée dans `docs/decisions.md`, qui fixe le modèle de
  marqueur « coffre » (ou son report) pour les Phases 2 et 6

- [ ] **Step 1: Écrire le spike d'inspection**

`packages/pipeline/spike/chests.ts` :
```ts
import { loadDataTableRows } from "./lib.js";

console.log("== Table des coffres ==");
const rows = loadDataTableRows(/treasurebox|chest/i);
const entries = Object.entries(rows);
console.log(`  lignes : ${entries.length}`);
for (const [rowName, row] of entries.slice(0, 3)) {
  console.log(`  ${rowName}: ${JSON.stringify(row).slice(0, 400)}`);
}
console.log("\nQuestions auxquelles répondre en lisant la structure ci-dessus :");
console.log("1. Les lignes portent-elles des coordonnées fixes (Location/X/Y) ?");
console.log("2. Ou décrivent-elles des règles de spawn (zone, taux, respawn) ?");
console.log("3. Les coffres 'uniques' (récompense fixe) sont-ils distinguables ?");
console.log("SPIKE OK — matière à décision collectée");
```

Ajouter dans `scripts` : `"spike:chests": "tsx spike/chests.ts"`.

- [ ] **Step 2: Exécuter et trancher**

Run: `pnpm --filter @palworld-companion/pipeline spike:chests`
Expected: structure des 3 premières lignes affichée, `SPIKE OK`.
L'agent analyse la structure et propose la décision (a/b/c du spec) ;
l'utilisateur tranche.

- [ ] **Step 3: Consigner la décision**

`docs/decisions.md` (créer avec cette entrée, compléter en Task 8) :
```markdown
# Registre de décisions

## 2026-07-XX — Coffres sur la carte

**Constat** : [structure observée : coordonnées fixes | spawners avec zone/taux]
**Décision** : [a) coffres fixes uniquement | b) « spots de spawn » cochables |
c) reportés hors v1]
**Conséquence** : [modèle de marqueur retenu pour transform/markers.ts en Phase 2]
```
Remplacer les crochets par le constat et la décision réels avant de committer.

- [ ] **Step 4: Commit**

```bash
git add docs/decisions.md packages/pipeline/spike/chests.ts packages/pipeline/package.json
git commit -m "docs: décision coffres (spike Phase 0)"
```

---

### Task 7: Spike save serveur — RecordData et corrélation GUIDs

**Files:**
- Create: `packages/pipeline/spike/record-data.ts`
- Modify: `packages/pipeline/package.json` (script `spike:save`)

**Interfaces:**
- Consumes: une vraie `Players/<GUID>.sav` du serveur (USER ACTION) ;
  export POI effigies (Task 3) via `loadDataTableRows`
- Produces: verdict de corrélation GUIDs ↔ IDs dataminés (conditionne l'import
  carte de la Phase 7) ; liste des clés `RecordData` réelles (conditionne le
  parseur TS de la Phase 5)

- [ ] **Step 1: USER ACTION — rapatrier une save**

Copier depuis le serveur dédié **un** fichier `Players/<GUID>.sav` (le tien)
vers `packages/pipeline/raw/save/` (créer le dossier). Ne PAS copier `Level.sav`.

- [ ] **Step 2: Convertir la save en JSON avec l'outil de référence**

Le spike utilise l'outil Python de référence (le parseur TS maison viendra en
Phase 5, guidé par ce que ce spike révèle) :

```bash
cd packages/pipeline
python3 -m venv .venv && .venv/bin/pip install palworld-save-tools
.venv/bin/palworld-save-tools raw/save/*.sav   # produit <fichier>.sav.json à côté
```

Expected: un fichier `raw/save/<GUID>.sav.json` existe.
(Si le nom exact de l'entry point CLI diffère selon la version installée,
`.venv/bin/pip show -f palworld-save-tools` liste les scripts disponibles.)

- [ ] **Step 3: Écrire le script d'analyse de RecordData**

`packages/pipeline/spike/record-data.ts` :
```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadDataTableRows } from "./lib.js";

const saveDir = new URL("../raw/save/", import.meta.url).pathname;
const jsonFile = readdirSync(saveDir).find((f) => f.endsWith(".sav.json"));
if (!jsonFile) throw new Error("Aucun .sav.json dans raw/save/ — refaire Step 2");
const save = JSON.parse(readFileSync(join(saveDir, jsonFile), "utf8"));

// RecordData vit sous properties.SaveData.value.RecordData.value (structure
// palworld-save-tools) ; on cherche défensivement toute clé RecordData.
function findRecordData(node: any): any {
  if (!node || typeof node !== "object") return null;
  if (node.RecordData) return node.RecordData.value ?? node.RecordData;
  for (const v of Object.values(node)) {
    const hit = findRecordData(v);
    if (hit) return hit;
  }
  return null;
}
const rd = findRecordData(save);
if (!rd) throw new Error("RecordData introuvable dans la save");

console.log("== Clés de RecordData ==");
for (const [key, val] of Object.entries(rd as Record<string, any>)) {
  const inner = (val as any)?.value ?? val;
  const size = Array.isArray(inner)
    ? inner.length
    : inner && typeof inner === "object"
      ? Object.keys(inner).length
      : 1;
  console.log(`  ${key} (${size} entrées)`);
}

// Corrélation : les flags d'effigies référencent-ils des IDs qu'on retrouve
// dans la DataTable dataminée ?
const effigyKey = Object.keys(rd).find((k) => /relic|lifmunk|effig/i.test(k));
if (!effigyKey) {
  console.log("\n✘ Aucune clé effigie/relic dans RecordData — corrélation impossible ici");
} else {
  const flags = (rd as any)[effigyKey]?.value ?? (rd as any)[effigyKey];
  const saveIds = new Set(
    (Array.isArray(flags) ? flags : Object.keys(flags ?? {})).map((x: any) =>
      String(x?.key ?? x?.id ?? x).toLowerCase(),
    ),
  );
  const tableIds = new Set(Object.keys(loadDataTableRows(/lifmunk|relic|effig/i)).map((k) => k.toLowerCase()));
  const overlap = [...saveIds].filter((id) => tableIds.has(id)).length;
  console.log(`\nClé effigies : ${effigyKey}`);
  console.log(`  IDs dans la save : ${saveIds.size} | dans la DataTable : ${tableIds.size}`);
  console.log(`  Recouvrement direct : ${overlap}`);
  console.log(
    overlap > 0
      ? "✔ CORRELATION DIRECTE — import carte possible"
      : "✘ Pas de recouvrement direct — corrélation à creuser (GUIDs de level ?) ou repli manuel",
  );
}
console.log("SPIKE OK — RecordData analysé");
```

Ajouter dans `scripts` : `"spike:save": "tsx spike/record-data.ts"`.

- [ ] **Step 4: Exécuter**

Run: `pnpm --filter @palworld-companion/pipeline spike:save`
Expected: liste des clés `RecordData` (attendues d'après palworld-save-pal :
déblocages Paldex, technos, effigies, voyages rapides, boss — noms exacts à
constater) puis `SPIKE OK`. Le verdict de corrélation (✔/✘) est consigné en Task 8.

- [ ] **Step 5: Commit**

```bash
git add packages/pipeline/spike/record-data.ts packages/pipeline/package.json
git commit -m "feat(spike): analyse RecordData d'une save serveur + test de corrélation"
```

---

### Task 8: Synthèse — runbook corrigé, décisions consignées, GO/NO-GO

**Files:**
- Modify: `docs/extraction-runbook.md` (chemins d'assets réels constatés)
- Modify: `docs/decisions.md` (toutes les conclusions du spike)

**Interfaces:**
- Consumes: résultats des Tasks 3–7
- Produces: les entrées de `docs/decisions.md` qui paramètrent les plans des
  Phases 2 (transforms), 5 (parseur de save) et 6–7 (carte)

- [ ] **Step 1: Corriger le runbook**

Remplacer dans `docs/extraction-runbook.md` la section « Où chercher (à
confirmer pendant le spike) » par la liste **exacte** des assets exportés
(chemin complet FModel de chaque DataTable, des tables L10N et des textures de
carte, y compris DLC si repérées), telle que constatée en Tasks 3–7.

- [ ] **Step 2: Compléter le registre de décisions**

Ajouter à `docs/decisions.md` une entrée par conclusion, chacune avec le
constat factuel et sa conséquence sur les phases suivantes :

```markdown
## 2026-07-XX — Format des clés L10N
**Constat** : [format réel, ex. PAL_NAME_<PalID>]
**Conséquence** : règle de jointure pour transform/l10n.ts (Phase 2).

## 2026-07-XX — Validation coordonnées effigies
**Constat** : [5/5 positions confirmées sur le wiki | écarts constatés]
**Conséquence** : constantes worldToMap reprises telles quelles (Phase 2) [ou à recalibrer].

## 2026-07-XX — Corrélation save ↔ données dataminées
**Constat** : [clés RecordData observées ; recouvrement effigies : N]
**Conséquence** : périmètre de l'import de save — Phase 5 (pals/technos) [et
Phase 7 carte si corrélation ✔, sinon repli cochage manuel].
```

- [ ] **Step 3: Vérification de sortie de phase**

Run: `pnpm --filter @palworld-companion/pipeline spike:inventory && pnpm --filter @palworld-companion/pipeline spike:pals && pnpm --filter @palworld-companion/pipeline spike:coords && pnpm --filter @palworld-companion/pipeline spike:chests && pnpm --filter @palworld-companion/pipeline spike:save`
Expected: les cinq scripts se terminent par `SPIKE OK`.

Critères de sortie du spec tous couverts : (a) DataTables exploitables ✔Task 4,
(b) L10N FR/EN joignables ✔Task 4, (c) icônes — couvertes par l'inventaire des
exports si présentes, sinon consignées comme point ouvert dans decisions.md,
(d) carte + 5 effigies validées ✔Tasks 3/5, (e) décision coffres ✔Task 6,
(f) spike save ✔Task 7.

- [ ] **Step 4: Commit final de phase**

```bash
git add docs/extraction-runbook.md docs/decisions.md
git commit -m "docs: conclusions du spike Phase 0 — runbook corrigé, décisions consignées"
```
