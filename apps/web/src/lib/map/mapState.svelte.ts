// État de la carte, persisté en localStorage. v3 : le modèle passe de trois
// cases à cocher à une catégorie sélectionnée + un ensemble de catégories
// visibles - un état v2 restauré tel quel laisserait ces champs absents.
import { defaultQuery, type Query } from "./query";
import { fromSearchParams, toSearchParams, type SpawnState } from "./shareUrl";
import type { SpawnPhase } from "./spawnLayer";

const STORAGE_KEY = "map-filters-v3";

export class MapState {
  query = $state<Query>(defaultQuery());
  spawn = $state<SpawnState>({ spawnPal: null, spawnPhase: "day" });

  /** Restaure depuis l'URL si elle porte des filtres, sinon depuis localStorage.
   *  L'URL gagne : un lien partagé doit montrer la vue qu'il décrit. */
  restore(url?: URL): void {
    const shared = url ? fromSearchParams(url.searchParams) : null;
    if (shared) {
      this.query = { ...defaultQuery(), ...shared.query };
      this.spawn = { spawnPal: null, spawnPhase: "day", ...shared.spawn };
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { query?: Partial<Query>; spawn?: Partial<SpawnState> };
      this.query = { ...defaultQuery(), ...parsed.query };
      this.spawn = { spawnPal: null, spawnPhase: "day", ...parsed.spawn };
    } catch {
      /* localStorage indisponible : défauts */
    }
  }

  persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ query: this.query, spawn: this.spawn }));
    } catch {
      /* ignore */
    }
  }

  /** Lien absolu reproduisant la vue courante. */
  shareHref(base: URL): string {
    const url = new URL(base.pathname, base.origin);
    url.search = toSearchParams(this.query, this.spawn).toString();
    return url.toString();
  }

  setPhase(phase: SpawnPhase): void {
    this.spawn.spawnPhase = phase;
    this.persist();
  }
}
