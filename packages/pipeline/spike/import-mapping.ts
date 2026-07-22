import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const saveDir = new URL("../raw/save/", import.meta.url).pathname;
const jsonFile = readdirSync(saveDir).find((f) => f.endsWith(".sav.json"));
if (!jsonFile) throw new Error("Aucun .sav.json — relancer la conversion (runbook)");
const save = JSON.parse(readFileSync(join(saveDir, jsonFile), "utf8"));
const sd = save.properties.SaveData.value;
const rd = sd.RecordData.value;

const palIdsLower = new Map<string, string>(
  JSON.parse(readFileSync(new URL("../../game-data/pals.json", import.meta.url).pathname, "utf8")).map(
    (p: any) => [p.id.toLowerCase(), p.id],
  ),
);
const techIdsLower = new Map<string, string>(
  JSON.parse(readFileSync(new URL("../../game-data/tech.json", import.meta.url).pathname, "utf8")).map(
    (t: any) => [t.id.toLowerCase(), t.id],
  ),
);

// Structure exacte à constater : imprimer un échantillon brut de chaque clé.
const paldeck = rd.PaldeckUnlockFlag?.value ?? rd.PaldeckUnlockFlag;
console.log("PaldeckUnlockFlag brut:", JSON.stringify(paldeck).slice(0, 300));
const techs = sd.UnlockedRecipeTechnologyNames?.value ?? sd.UnlockedRecipeTechnologyNames;
console.log("UnlockedRecipeTechnologyNames brut:", JSON.stringify(techs).slice(0, 300));

// RÈGLE D'EXTRACTION — PalDeck (à recopier telle quelle en Task 3) :
// `RecordData.value.PaldeckUnlockFlag` est une MapProperty sérialisée par
// palworld-save-tools sous la forme :
//   { key_type: "NameProperty", value_type: "BoolProperty", ...,
//     value: [{ key: string, value: boolean }, ...] }
// Chaque `key` est le nom interne de l'espèce (ex. "PinkCat", "Sheepball",
// variantes "BOSS_..."/"_Ice" incluses). On ne garde que value===true (les
// entrées observées sont toutes true — le flag n'existe que si débloqué —
// mais on filtre quand même par défensivité). Ces noms internes ne matchent
// PAS toujours la casse exacte de pals.json (ex. save "Sheepball" vs dataset
// "SheepBall") : la comparaison doit se faire en case-insensitive.
const palEntries: string[] = paldeck
  .filter((entry: { key: string; value: boolean }) => entry.value === true)
  .map((entry: { key: string; value: boolean }) => entry.key);

// RÈGLE D'EXTRACTION — Technologies (à recopier telle quelle en Task 3) :
// `SaveData.value.UnlockedRecipeTechnologyNames` est une ArrayProperty
// sérialisée sous la forme :
//   { array_type: "NameProperty", id: null, value: { values: string[] } }
// Chaque élément de `value.values` est directement le row name de tech.json
// (ex. "Workbench"). Comparaison en case-insensitive également (ex. save
// "PalBox" vs dataset "PALBOX").
const techEntries: string[] = techs.values;

const palRecognized = palEntries.filter((id) => palIdsLower.has(id.toLowerCase()));
const palUnrecognized = palEntries.filter((id) => !palIdsLower.has(id.toLowerCase()));
const techRecognized = techEntries.filter((id) => techIdsLower.has(id.toLowerCase()));
const techUnrecognized = techEntries.filter((id) => !techIdsLower.has(id.toLowerCase()));

console.log(
  `pals: ${palRecognized.length}/${palEntries.length} reconnus (case-insensitive) ; ` +
    `techs: ${techRecognized.length}/${techEntries.length} reconnus (case-insensitive)`,
);
if (palUnrecognized.length > 0) {
  console.log(`  pals non reconnus (${palUnrecognized.length}):`, palUnrecognized);
}
if (techUnrecognized.length > 0) {
  console.log(`  techs non reconnus (${techUnrecognized.length}):`, techUnrecognized);
}
console.log("SPIKE OK");
