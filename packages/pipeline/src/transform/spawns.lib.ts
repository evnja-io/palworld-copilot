// Zones de spawn des Pals, depuis DT_PaldexDistributionData - la table que le
// jeu utilise pour son propre Paldex. Fonctions pures : les I/O sont dans
// spawns.ts.
import { radiusToPx, worldToPixel } from "./coord.js";

export type SpawnPoint = [number, number];
export type PalSpawns = { r: number; day: SpawnPoint[]; night: SpawnPoint[] };

type PhaseBlock = { Locations?: Array<{ X: number; Y: number }>; Radius?: number };
export type DistributionRow = {
  dayTimeLocations?: PhaseBlock;
  nightTimeLocations?: PhaseBlock;
};

/** Rayon par défaut : uniforme à 15000 dans toutes les lignes observées. */
const DEFAULT_RADIUS = 15000;

export function buildPalIdIndex(ids: string[]): Map<string, string> {
  return new Map(ids.map((id) => [id.toLowerCase(), id]));
}

/** Clé de la table -> id de pals.json. Le préfixe BOSS_ (casse libre : le jeu
 *  écrit aussi « Boss_Anubis ») désigne la variante boss de terrain d'une
 *  espèce ; on la fusionne dans l'espèce de base, sinon les Pals qui
 *  n'apparaissent qu'en boss n'auraient aucune zone. */
export function resolvePalId(rawKey: string, index: Map<string, string>): string | null {
  const stripped = rawKey.replace(/^boss_/i, "");
  return index.get(stripped.toLowerCase()) ?? index.get(rawKey.toLowerCase()) ?? null;
}

/** Un représentant par cellule de grille : les points bruts se chevauchent
 *  massivement (réduction mesurée ×2,8 au demi-rayon). */
export function clusterPoints(points: SpawnPoint[], cell: number): SpawnPoint[] {
  const seen = new Set<string>();
  const out: SpawnPoint[] = [];
  for (const [x, y] of points) {
    const key = `${Math.round(x / cell)}:${Math.round(y / cell)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([x, y]);
  }
  return out;
}

export function buildSpawns(
  rows: Record<string, DistributionRow>,
  palIds: string[],
): { spawns: Record<string, PalSpawns>; unresolved: string[]; treeSkipped: number } {
  const index = buildPalIdIndex(palIds);
  const merged = new Map<string, { day: SpawnPoint[]; night: SpawnPoint[]; radius: number }>();
  const unresolved: string[] = [];
  let treeSkipped = 0;

  // Parcours trié : artefact reproductible d'un run à l'autre.
  for (const rawKey of Object.keys(rows).sort()) {
    const palId = resolvePalId(rawKey, index);
    if (!palId) {
      unresolved.push(rawKey);
      continue;
    }
    const entry = merged.get(palId) ?? { day: [], night: [], radius: 0 };
    for (const [phase, block] of [
      ["day", rows[rawKey].dayTimeLocations],
      ["night", rows[rawKey].nightTimeLocations],
    ] as const) {
      if (!block) continue;
      entry.radius = Math.max(entry.radius, block.Radius ?? DEFAULT_RADIUS);
      for (const loc of block.Locations ?? []) {
        const pt = worldToPixel(loc.X, loc.Y);
        if (!pt) {
          treeSkipped++;
          continue;
        }
        entry[phase].push(pt);
      }
    }
    merged.set(palId, entry);
  }

  const spawns: Record<string, PalSpawns> = {};
  for (const [palId, entry] of merged) {
    const radiusPx = radiusToPx(entry.radius || DEFAULT_RADIUS);
    const cell = radiusPx / 2;
    const day = clusterPoints(entry.day, cell);
    const night = clusterPoints(entry.night, cell);
    if (day.length === 0 && night.length === 0) continue;
    spawns[palId] = { r: Math.round(radiusPx * 10) / 10, day, night };
  }
  return { spawns, unresolved, treeSkipped };
}
