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

// Domaines attendus pour le spike (recherche par nom de fichier, insensible à la casse).
// Effigies/coffres/voyage rapide : PAS des exports FModel (acteurs de level) -
// vérifiés séparément ci-dessous via le dataset communautaire (cf. runbook).
const expect: Record<string, RegExp> = {
  "pals (paramètres monstres)": /monsterparameter/i,
  "items": /itemdatatable/i,
  "recettes de craft": /itemrecipe/i,
  "arbre technologique": /technologyrecipeunlock/i,
  "constructions": /buildobject/i,
  "boss Alpha (positions)": /bossspawnerloaction/i,
  "bornes de la carte": /worldmapuidata/i,
  "L10N EN": /\/en\//i,
  "L10N FR": /\/fr\//i,
  "carte (texture)": /worldmap/i,
};
let missing = 0;
for (const [label, re] of Object.entries(expect)) {
  const hit = files.find((f) => re.test(f));
  console.log(hit ? `✔ ${label}` : `✘ MANQUANT : ${label}`);
  if (!hit) missing++;
}

// Dataset communautaire (effigies) : packages/pipeline/raw/community/effigies.json
const communityEffigies = new URL("../raw/community/effigies.json", import.meta.url).pathname;
try {
  statSync(communityEffigies);
  console.log("✔ effigies (dataset communautaire save-pal)");
} catch {
  console.log("✘ MANQUANT : effigies (raw/community/effigies.json - cf. runbook)");
  missing++;
}
if (missing > 0) {
  console.error(`\n${missing} domaine(s) manquant(s) - compléter les exports FModel.`);
  process.exit(1);
}
console.log("\nSPIKE OK - inventaire complet");
