import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const saveDir = new URL("../raw/save/", import.meta.url).pathname;
const jsonFile = readdirSync(saveDir).find((f) => f.endsWith(".sav.json"));
if (!jsonFile) throw new Error("Aucun .sav.json dans raw/save/ — refaire la conversion");
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

// Corrélation : les flags d'effigies référencent-ils des GUIDs qu'on retrouve
// dans le dataset communautaire effigies.json (GUID -> coordonnées) ?
const effigyKey = Object.keys(rd).find((k) => /relic|lifmunk|effig/i.test(k));
if (!effigyKey) {
  console.log("\n✘ Aucune clé effigie/relic dans RecordData — corrélation impossible ici");
} else {
  const raw = (rd as any)[effigyKey]?.value ?? (rd as any)[effigyKey];
  // Formats possibles : tableau de GUIDs, map GUID->bool, ou structure typée
  // { key: guid, value: bool } — on collecte tout ce qui ressemble à un GUID.
  const collected: string[] = [];
  const collect = (node: any): void => {
    if (typeof node === "string" && /^[0-9A-F-]{32,36}$/i.test(node)) collected.push(node);
    else if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === "object") Object.entries(node).forEach(([k, v]) => {
      if (/^[0-9A-F-]{32,36}$/i.test(k)) collected.push(k);
      collect(v);
    });
  };
  collect(raw);
  const norm = (g: string) => g.replaceAll("-", "").toLowerCase();
  const saveIds = new Set(collected.map(norm));

  const effigiesFile = new URL("../raw/community/effigies.json", import.meta.url).pathname;
  const community = JSON.parse(readFileSync(effigiesFile, "utf8"));
  const tableIds = new Set(Object.keys(community).map(norm));
  const overlap = [...saveIds].filter((id) => tableIds.has(id)).length;

  console.log(`\nClé effigies : ${effigyKey}`);
  console.log(`  GUIDs dans la save : ${saveIds.size} | dans effigies.json : ${tableIds.size}`);
  console.log(`  Recouvrement direct : ${overlap}`);
  console.log(
    overlap > 0
      ? "✔ CORRELATION DIRECTE — import carte possible"
      : "✘ Pas de recouvrement direct — corrélation à creuser ou repli manuel",
  );
}
console.log("SPIKE OK — RecordData analysé");
