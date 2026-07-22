import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR } from "./paths.js";

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
  "tech.json": "id", "buildings.json": "id",
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
    console.warn(`  ${file}: ${lost.length} IDs retirés (ALLOW_ID_REMOVALS=1 — assumé)`);
  } else if (lost.length > 0) {
    fail(`${file}: IDs disparus sans id-remap.json : ${lost.slice(0, 5).join(", ")}…`);
  }
}
console.log("VERIFY OK");
