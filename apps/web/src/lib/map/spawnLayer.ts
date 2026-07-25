// Zones de spawn d'un Pal. Même contrat que MarkerController : Leaflet possède
// le DOM, Svelte l'état, et rien n'est monté par cercle (~190 par Pal).
import type * as L from "leaflet";

export type SpawnPhase = "day" | "night";
export type PalSpawns = { r: number; day: [number, number][]; night: [number, number][] };

export class SpawnLayer {
  #L: typeof L;
  #layer: L.FeatureGroup;
  #toLatLng: (px: number, py: number) => L.LatLng;
  /** Unité projetée correspondant à 1 px de texture (CRS.Simple). */
  #unit: number;
  #cache = new Map<string, PalSpawns | null>();
  /** Clé `palId:phase` en cours, pour ignorer les chargements obsolètes. */
  #current: string | null = null;

  constructor(leaflet: typeof L, map: L.Map, toLatLng: (px: number, py: number) => L.LatLng) {
    this.#L = leaflet;
    this.#toLatLng = toLatLng;
    this.#unit = toLatLng(1, 0).lng - toLatLng(0, 0).lng;
    this.#layer = leaflet.featureGroup().addTo(map);
  }

  async #load(palId: string): Promise<PalSpawns | null> {
    const hit = this.#cache.get(palId);
    if (hit !== undefined) return hit;
    let data: PalSpawns | null = null;
    try {
      const res = await fetch(`/spawns/${palId}.json`);
      if (res.ok) data = (await res.json()) as PalSpawns;
    } catch {
      /* hors ligne ou 404 : pas de zone à afficher */
    }
    this.#cache.set(palId, data);
    return data;
  }

  /** Affiche les zones d'un Pal pour une phase, ou vide la couche si null. */
  async setPal(palId: string | null, phase: SpawnPhase): Promise<void> {
    const key = palId ? `${palId}:${phase}` : null;
    if (key === this.#current) return;
    this.#current = key;
    this.#layer.clearLayers();
    if (!palId) return;
    const data = await this.#load(palId);
    // Un autre Pal a pu être demandé pendant le fetch.
    if (this.#current !== key || !data) return;
    const radius = data.r * this.#unit;
    for (const [px, py] of data[phase]) {
      this.#layer.addLayer(
        this.#L.circle(this.#toLatLng(px, py), {
          radius,
          className: "spawn-zone",
          stroke: false,
          interactive: false,
        }),
      );
    }
  }

  /** Emprise des zones affichées, pour cadrer la vue. */
  bounds(): L.LatLngBounds | null {
    const b = this.#layer.getBounds();
    return b.isValid() ? b : null;
  }

  destroy(): void {
    this.#layer.remove();
    this.#cache.clear();
  }
}
