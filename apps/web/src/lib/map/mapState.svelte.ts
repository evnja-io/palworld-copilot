// Filtres de la carte, persistés en localStorage.
const STORAGE_KEY = "map-filters-v1";

export type MapFilters = {
  relic: boolean;
  alpha: boolean;
  ft: boolean;
  hideChecked: boolean;
};

const DEFAULTS: MapFilters = { relic: true, alpha: true, ft: true, hideChecked: false };

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
