import { readFileSync } from "node:fs";
import { loadDataTableRows, must, pick, writeGameData } from "../lib.js";

// Transform monde -> coordonnées in-game v1.0 (constantes de
// PalworldSaveTools/palworld_coord, variante « new » : scale 725) ; la
// texture T_WorldMap couvre exactement la plage in-game [-1000, 1000]².
// Les POI hors plage appartiennent à la carte de l'Arbre-Monde (T_TreeMap,
// hors v1 - exclus avec comptage). CALIBRÉ VISUELLEMENT en Task 4.
const SIZE = 8192;
const SCALE = 725;
const TRANSL_X = 375247;
const TRANSL_Y = -18;
const RANGE = 1000;

export function worldToGame(worldX: number, worldY: number): [number, number] {
  return [(worldY - TRANSL_Y) / SCALE, (worldX + TRANSL_X) / SCALE];
}

export function worldToPixel(worldX: number, worldY: number): [number, number] | null {
  const [gx, gy] = worldToGame(worldX, worldY);
  if (Math.abs(gx) > RANGE || Math.abs(gy) > RANGE) return null; // Arbre-Monde
  const px = ((gx + RANGE) / (2 * RANGE)) * SIZE;
  const py = ((RANGE - gy) / (2 * RANGE)) * SIZE;
  return [Math.round(px * 10) / 10, Math.round(py * 10) / 10];
}

type Marker = {
  id: string;
  type: "relic" | "alpha" | "ft";
  px: number;
  py: number;
  nameId?: string;
  meta?: Record<string, unknown>;
};

const markers: Marker[] = [];
const communityDir = new URL("../../raw/community/", import.meta.url).pathname;

// Effigies (dataset save-pal : GUID -> monde) - les seules cochables.
const effigies: Record<string, { x: number; y: number }> = JSON.parse(
  readFileSync(communityDir + "effigies.json", "utf8"),
);
let treeSkipped = 0;
for (const [guid, pos] of Object.entries(effigies)) {
  const pt = worldToPixel(pos.x, pos.y);
  if (!pt) { treeSkipped++; continue; }
  markers.push({ id: `relic_${guid.replaceAll("-", "").toLowerCase()}`, type: "relic", px: pt[0], py: pt[1] });
}

// Boss Alpha (DT_BossSpawnerLoactionData - la faute est dans le nom réel).
const bosses = loadDataTableRows(/DT_BossSpawnerLoactionData/);
for (const row of Object.values(bosses) as any[]) {
  const spawnerId = must(pick<string>(row, "SpawnerID"), "boss.SpawnerID");
  const loc = must(pick<any>(row, "Location"), "boss.Location");
  const characterId = pick<string>(row, "CharacterID") ?? "";
  const pt = worldToPixel(Number(loc.X), Number(loc.Y));
  if (!pt) { treeSkipped++; continue; }
  const [px, py] = pt;
  markers.push({
    id: `alpha_${spawnerId}`,
    type: "alpha",
    px,
    py,
    meta: {
      palId: characterId.replace(/^BOSS_/i, ""),
      level: pick<number>(row, "Level") ?? 0,
    },
  });
}

// Voyage rapide (dataset PalworldSaveTools : GUID -> monde + id de nom).
const ftPoints: Record<string, { x: number; y: number; id: string; localized_name?: string }> =
  JSON.parse(readFileSync(communityDir + "fast_travel_points.json", "utf8"));
for (const [guid, p] of Object.entries(ftPoints)) {
  const pt = worldToPixel(p.x, p.y);
  if (!pt) { treeSkipped++; continue; }
  markers.push({
    id: `ft_${guid.replaceAll("-", "").toLowerCase()}`,
    type: "ft",
    px: pt[0],
    py: pt[1],
    nameId: p.id, // clé de DT_MapRespawnPointInfoText -> l10n "ft:<id>"
  });
}

markers.sort((a, b) => a.id.localeCompare(b.id));
const counts = markers.reduce<Record<string, number>>((acc, mk) => {
  acc[mk.type] = (acc[mk.type] ?? 0) + 1;
  return acc;
}, {});
if (!(counts.relic >= 120 && counts.relic <= 200)) throw new Error(`relics suspects : ${counts.relic}`);
if (!(counts.alpha >= 150 && counts.alpha <= 200)) throw new Error(`alphas suspects : ${counts.alpha}`);
if (!(counts.ft > 50)) throw new Error(`ft suspects : ${counts.ft}`);
console.log(`  (${treeSkipped} POI de l'Arbre-Monde exclus - carte séparée, hors v1)`);

writeGameData("markers.json", markers);
console.log(
  `markers OK (${counts.relic} effigies, ${counts.alpha} alphas, ${counts.ft} voyages rapides)`,
);
