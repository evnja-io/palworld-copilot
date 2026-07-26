// Réécrit packages/game-data/markers.json en place : reclassement en catégories
// et unicité des ids. Nécessaire parce que les DataTables du jeu ne sont pas
// dans le dépôt — on ne peut pas relancer le transform pour réparer les données
// déjà commitées. Idempotent : relancer ne produit aucun diff.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR } from "./paths.js";
import { assertMarkerCounts, normalizeMarkers, type Marker } from "./transform/markers.lib.js";
import { writeGameData } from "./lib.js";

const before = JSON.parse(readFileSync(join(OUT_DIR, "markers.json"), "utf8")) as Marker[];
const after = normalizeMarkers(before);
const counts = assertMarkerCounts(after);

const renamed = after.filter((mk, i) => before[i]?.id !== mk.id).length;
writeGameData("markers.json", after);
console.log(
  `markers.json normalisé : ${after.length} marqueurs — ` +
    `${counts.relic} effigies, ${counts.alpha} alphas, ${counts.boss} boss PNJ, ` +
    `${counts.tower} tours, ${counts.watchtower} observation, ${counts.ft} voyage rapide` +
    (renamed ? ` (${renamed} ids réaffectés)` : ""),
);
