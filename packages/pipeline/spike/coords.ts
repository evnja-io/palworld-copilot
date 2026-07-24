import { readFileSync } from "node:fs";
import { loadDataTableRows } from "./lib.js";

/** Transformation documentée (github.com/palworldlol/palworld-coord, MIT ;
 *  recoupée par palworld.wiki.gg/wiki/Maps) - île principale uniquement. */
export function worldToMap(worldX: number, worldY: number): [number, number] {
  const mapX = (worldY - 158000) / 459;
  const mapY = (worldX + 123888) / 459;
  return [Math.round(mapX * 10) / 10, Math.round(mapY * 10) / 10];
}

console.log("== Effigies (dataset communautaire save-pal, GUID -> monde) ==");
const effigiesFile = new URL("../raw/community/effigies.json", import.meta.url).pathname;
const effigies: Record<string, { x: number; y: number; z: number }> = JSON.parse(
  readFileSync(effigiesFile, "utf8"),
);
const guids = Object.keys(effigies);
console.log(`  effigies : ${guids.length}`);
if (guids.length < 100) throw new Error(`Trop peu d'effigies (${guids.length})`);

let inBounds = 0;
for (const guid of guids) {
  const { x, y } = effigies[guid];
  const [mx, my] = worldToMap(x, y);
  if (mx >= -1000 && mx <= 1000 && my >= -1000 && my <= 1000) inBounds++;
}
console.log(`  dans les bornes carte [-1000,1000] : ${inBounds}/${guids.length}`);

for (const guid of guids.slice(0, 5)) {
  const { x, y } = effigies[guid];
  const [mx, my] = worldToMap(x, y);
  console.log(`  ${guid.slice(0, 8)}…: monde(${x}, ${y}) → carte(${mx}, ${my})`);
}

console.log("\n== Boss Alpha (DT_BossSpawnerLoactionData) ==");
const bosses = loadDataTableRows(/bossspawnerloaction/i);
const bossEntries = Object.entries(bosses).slice(0, 5);
for (const [rowName, row] of bossEntries) {
  const loc = (row as any).Location ?? row;
  const wx = Number(loc.X ?? loc.x);
  const wy = Number(loc.Y ?? loc.y);
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) {
    console.log(`  ${rowName}: structure inattendue → ${JSON.stringify(row).slice(0, 200)}`);
    throw new Error("Champ de coordonnées à identifier - inspecter le JSON exporté");
  }
  const [mx, my] = worldToMap(wx, wy);
  console.log(`  ${rowName}: monde(${wx}, ${wy}) → carte(${mx}, ${my})`);
}

if (inBounds / guids.length < 0.5) {
  throw new Error("Moins de 50% des effigies dans les bornes - transformation ou données à revoir");
}
console.log("\nComparer manuellement 5 positions avec palworld.wiki.gg (effigies) et");
console.log("les niveaux/positions de boss connus. Tolérance ±5. Verdict humain requis.");
console.log("SPIKE OK - transformation appliquée (validation visuelle à consigner)");
