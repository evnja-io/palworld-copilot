// Zones de spawn par Pal, depuis DT_PaldexDistributionData.
// Deux sorties : un fichier par Pal sous static/ (chargé à la demande par la
// carte, ~4 Ko chacun) et un index de comptages dans game-data (importé
// statiquement par la fiche Pal, qui n'a besoin que de savoir s'il y a
// quelque chose à montrer).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadDataTableRows, writeGameData } from "../lib.js";
import { OUT_DIR, SPAWNS_OUT } from "../paths.js";
import { buildSpawns, type DistributionRow } from "./spawns.lib.js";

const palIds = (
  JSON.parse(readFileSync(join(OUT_DIR, "pals.json"), "utf8")) as Array<{ id: string }>
).map((p) => p.id);

const rows = loadDataTableRows(/DT_PaldexDistributionData(_Common)?\.json$/) as Record<
  string,
  DistributionRow
>;

const { spawns, unresolved, treeSkipped } = buildSpawns(rows, palIds);

// Réécriture complète : un Pal disparu d'une version du jeu ne doit pas
// laisser un fichier orphelin servi par static/.
rmSync(SPAWNS_OUT, { recursive: true, force: true });
mkdirSync(SPAWNS_OUT, { recursive: true });

const index: Record<string, { day: number; night: number }> = {};
for (const [palId, data] of Object.entries(spawns)) {
  writeFileSync(join(SPAWNS_OUT, `${palId}.json`), JSON.stringify(data) + "\n");
  index[palId] = { day: data.day.length, night: data.night.length };
}
writeGameData("spawns-index.json", index);

const total = Object.values(index).reduce((s, c) => s + c.day + c.night, 0);
if (Object.keys(index).length < 200) {
  throw new Error(`zones de spawn : seulement ${Object.keys(index).length} Pals couverts`);
}
if (unresolved.length > 0) {
  console.log(`  (${unresolved.length} clés non résolues : ${unresolved.slice(0, 5).join(", ")}…)`);
}
console.log(`  (${treeSkipped} points de l'Arbre-Monde exclus - carte séparée, hors v1)`);
console.log(`spawns OK (${Object.keys(index).length} Pals, ${total} zones)`);
