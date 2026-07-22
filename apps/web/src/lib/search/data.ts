// Données de la palette, importées dynamiquement à la première ouverture
// (l'index fait ~500 Ko : inutile de le payer sur chaque page).
import searchIndex from "@palworld-companion/game-data/search-index.json";
import palMoves from "@palworld-companion/game-data/pal-moves.json";
import pals from "@palworld-companion/game-data/pals.json";
import type { SearchEntry } from "./engine.js";

export { resolve } from "./resolve.js";

export const index = searchIndex as SearchEntry[];

/** skillId -> pals (du Paldex uniquement, pas les variantes boss) qui l'apprennent. */
export const learners = new Map<string, ReadonlySet<string>>();
{
  const known = new Set(pals.map((p) => p.id));
  const moves = palMoves as Record<string, Array<{ level: number; skillId: string }>>;
  const acc = new Map<string, Set<string>>();
  for (const [palId, list] of Object.entries(moves)) {
    if (!known.has(palId)) continue;
    for (const mv of list) {
      const set = acc.get(mv.skillId);
      if (set) set.add(palId);
      else acc.set(mv.skillId, new Set([palId]));
    }
  }
  for (const [k, v] of acc) learners.set(k, v);
}
