// Filtres de la carte, persistés en localStorage.
import type { SpawnPhase } from "./spawnLayer";

// v2 : ajout de spawnPal / spawnPhase - un état v1 restauré tel quel
// laisserait ces champs absents.
const STORAGE_KEY = "map-filters-v2";

export type MapFilters = {
  relic: boolean;
  alpha: boolean;
  ft: boolean;
  hideChecked: boolean;
  /** Pal dont les zones de spawn sont affichées, null si aucune. */
  spawnPal: string | null;
  spawnPhase: SpawnPhase;
};

const DEFAULTS: MapFilters = {
  relic: true,
  alpha: true,
  ft: true,
  hideChecked: false,
  spawnPal: null,
  spawnPhase: "day",
};

export class MapState {
  filters = $state<MapFilters>({ ...DEFAULTS });

  restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.filters = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* localStorage indisponible : défauts */
    }
  }

  persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.filters));
    } catch {
      /* ignore */
    }
  }
}
