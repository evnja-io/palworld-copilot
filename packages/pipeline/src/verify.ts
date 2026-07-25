import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR, SPAWNS_OUT } from "./paths.js";
import { SIZE } from "./transform/coord.js";

const load = (p: string) => JSON.parse(readFileSync(join(OUT_DIR, p), "utf8"));
const fail = (msg: string) => {
  console.error(`VERIFY ÉCHEC : ${msg}`);
  process.exit(1);
};

const pals = load("pals.json");
const items = load("items.json");
const recipes = load("recipes.json");
const tech = load("tech.json");
const buildings = load("buildings.json");
const namesEn = load("l10n/names.en.json");
const namesFr = load("l10n/names.fr.json");

// 1. Comptages plancher
if (pals.length < 150) fail(`pals: ${pals.length}`);
if (items.length < 400) fail(`items: ${items.length}`);
if (recipes.length < 200) fail(`recipes: ${recipes.length}`);
if (tech.length < 100) fail(`tech: ${tech.length}`);
if (buildings.length < 100) fail(`buildings: ${buildings.length}`);
const markers = load("markers.json");
if (markers.length < 400) fail(`markers: ${markers.length}`);

// Zones de spawn : couverture, ids connus, coordonnées dans la texture.
const spawnsIndex = load("spawns-index.json") as Record<string, { day: number; night: number }>;
const spawnPalIds = Object.keys(spawnsIndex);
// Plancher à 200 : l'export réel en donne 249. Un seuil à 100 ne détecterait
// pas une régression qui perdrait la moitié des données.
if (spawnPalIds.length < 200) fail(`spawns: ${spawnPalIds.length} Pals`);
const palIdSet = new Set((pals as Array<{ id: string }>).map((p) => p.id));
for (const id of spawnPalIds) {
  if (!palIdSet.has(id)) fail(`spawns: id inconnu dans pals.json (${id})`);
  const c = spawnsIndex[id];
  if (c.day + c.night === 0) fail(`spawns: entrée vide (${id})`);
}
// Contrôle exhaustif : un échantillon d'un seul Pal laisserait passer toute
// régression de projection qui n'affecte pas le premier du tri.
for (const id of spawnPalIds) {
  const data = JSON.parse(readFileSync(join(SPAWNS_OUT, `${id}.json`), "utf8")) as {
    r: number;
    day: number[][];
    night: number[][];
  };
  if (!(data.r > 0)) fail(`spawns: rayon invalide (${id})`);
  if (data.day.length !== spawnsIndex[id].day || data.night.length !== spawnsIndex[id].night)
    fail(`spawns: index et fichier divergent (${id})`);
  for (const [px, py] of [...data.day, ...data.night]) {
    if (px < 0 || px > SIZE || py < 0 || py > SIZE) fail(`spawns: point hors texture (${id})`);
  }
}

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

// 2. Couverture L10N (5% de noms manquants tolérés)
for (const [label, list, key] of [
  ["pals", pals, (e: any) => `pal:${e.id}`],
  ["items", items, (e: any) => `item:${e.id}`],
  ["tech", tech, (e: any) => `tech:${e.nameId}`],
  ["buildings", buildings, (e: any) => `building:${e.mapObjectId}`],
] as const) {
  for (const [locale, names] of [["en", namesEn], ["fr", namesFr]] as const) {
    const missing = list.filter((e: any) => !names[key(e)]).length;
    if (missing > list.length * 0.05) fail(`${label}: ${missing} noms ${locale} manquants`);
  }
}

// 3. Intégrité référentielle (avertissements, non bloquant sous 2%)
const itemIds = new Set(items.map((i: any) => i.id));
let orphans = 0;
for (const r of recipes)
  for (const mat of r.materials)
    if (!itemIds.has(mat.id)) {
      orphans++;
      console.warn(`  réf orpheline : recette ${r.id} -> ${mat.id}`);
    }
if (orphans > recipes.length * 0.02) fail(`${orphans} matériaux orphelins`);

// 4. Stabilité des IDs vs la version committée (HEAD)
const keyField: Record<string, string> = {
  "pals.json": "id", "items.json": "id", "recipes.json": "id",
  "tech.json": "id", "buildings.json": "id", "markers.json": "id",
};
for (const file of Object.keys(keyField)) {
  let committed: any[] = [];
  try {
    committed = JSON.parse(
      execSync(`git show HEAD:packages/game-data/${file}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }),
    );
  } catch {
    continue; // premier run : rien de committé
  }
  const now = new Set(load(file).map((e: any) => e[keyField[file]]));
  const remap = existsSync(join(OUT_DIR, "id-remap.json")) ? load("id-remap.json") : {};
  const lost = committed
    .map((e: any) => e[keyField[file]])
    .filter((id: string) => !now.has(id) && !(id in remap));
  if (lost.length > 0 && process.env.ALLOW_ID_REMOVALS === "1") {
    console.warn(`  ${file}: ${lost.length} IDs retirés (ALLOW_ID_REMOVALS=1 - assumé)`);
  } else if (lost.length > 0) {
    fail(`${file}: IDs disparus sans id-remap.json : ${lost.slice(0, 5).join(", ")}…`);
  }
}
console.log("VERIFY OK");
