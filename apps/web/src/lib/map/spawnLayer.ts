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
  /** Le cache retient la promesse, pas sa valeur : deux demandes du même Pal
   *  pendant un fetch en vol partagent alors une seule requête. */
  #cache = new Map<string, Promise<PalSpawns | null>>();
  /** Clé `palId:phase` en cours, pour court-circuiter une demande identique. */
  #current: string | null = null;
  /** Jeton de la demande la plus récente. `#current` ne suffit pas comme garde :
   *  avec A → B → A pendant que le premier fetch de A est en vol, les deux
   *  continuations de A voient la même clé et dessinent chacune leurs cercles. */
  #seq = 0;
  /** Opération de dessin en cours, rendue par `setPal` pour qu'un appelant
   *  puisse attendre que les cercles existent. */
  #op: Promise<void> = Promise.resolve();

  constructor(leaflet: typeof L, map: L.Map, toLatLng: (px: number, py: number) => L.LatLng) {
    this.#L = leaflet;
    this.#toLatLng = toLatLng;
    this.#unit = toLatLng(1, 0).lng - toLatLng(0, 0).lng;
    this.#layer = leaflet.featureGroup().addTo(map);
  }

  #load(palId: string): Promise<PalSpawns | null> {
    const hit = this.#cache.get(palId);
    if (hit) return hit;
    const pending = (async () => {
      try {
        const res = await fetch(`/spawns/${palId}.json`);
        if (res.ok) return (await res.json()) as PalSpawns;
      } catch {
        /* hors ligne ou fichier absent : pas de zone à afficher */
      }
      return null;
    })();
    this.#cache.set(palId, pending);
    return pending;
  }

  /** Affiche les zones d'un Pal pour une phase, ou vide la couche si null.
   *  La promesse rendue se règle quand les cercles sont dessinés — y compris
   *  quand l'appel rejoint une demande identique déjà en cours. Sans cela, un
   *  appelant qui attend pour cadrer la vue obtiendrait une emprise vide. */
  setPal(palId: string | null, phase: SpawnPhase): Promise<void> {
    const key = palId ? `${palId}:${phase}` : null;
    if (key === this.#current) return this.#op;
    this.#current = key;
    this.#op = this.#draw(palId, phase, ++this.#seq);
    return this.#op;
  }

  async #draw(palId: string | null, phase: SpawnPhase, token: number): Promise<void> {
    this.#layer.clearLayers();
    if (!palId) return;
    const data = await this.#load(palId);
    // Une demande plus récente a pris la main pendant le fetch.
    if (token !== this.#seq || !data) return;
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
    // Invalide toute demande encore en vol : sa continuation ne dessinera pas
    // dans une couche déjà détachée.
    this.#seq++;
    this.#current = null;
    this.#layer.remove();
    this.#cache.clear();
  }
}
