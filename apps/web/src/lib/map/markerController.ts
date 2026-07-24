// Pont Svelte -> Leaflet : Leaflet possède le DOM de la carte, Svelte l'état.
// sync() reçoit l'état dérivé et diffe impérativement - jamais un composant
// Svelte par marqueur (~450).
import type * as L from "leaflet";

export type MapMarker = {
  id: string;
  type: "relic" | "alpha" | "ft";
  px: number;
  py: number;
  nameId?: string;
  meta?: { palId?: string; level?: number };
};

export type MarkerClickHandler = (marker: MapMarker, leafletMarker: L.Marker) => void;

const GLYPH: Record<MapMarker["type"], string> = { relic: "✦", alpha: "▲", ft: "◆" };

export class MarkerController {
  #L: typeof L;
  #map: L.Map;
  #layer: L.LayerGroup;
  #byId = new Map<string, L.Marker>();
  #onClick: MarkerClickHandler;
  #toLatLng: (px: number, py: number) => L.LatLng;

  constructor(
    leaflet: typeof L,
    map: L.Map,
    toLatLng: (px: number, py: number) => L.LatLng,
    onClick: MarkerClickHandler,
  ) {
    this.#L = leaflet;
    this.#map = map;
    this.#toLatLng = toLatLng;
    this.#onClick = onClick;
    this.#layer = leaflet.layerGroup().addTo(map);
  }

  #icon(mk: MapMarker, checked: boolean): L.DivIcon {
    const level = mk.type === "alpha" && mk.meta?.level ? `<i>${mk.meta.level}</i>` : "";
    return this.#L.divIcon({
      className: "",
      html: `<span class="mk mk-${mk.type}${checked ? " mk-checked" : ""}">${GLYPH[mk.type]}${level}</span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }

  /** Diffe l'ensemble visible + l'état coché. */
  sync(visible: MapMarker[], checked: ReadonlySet<string>): void {
    const wanted = new Map(visible.map((mk) => [mk.id, mk]));
    for (const [id, lm] of this.#byId) {
      if (!wanted.has(id)) {
        this.#layer.removeLayer(lm);
        this.#byId.delete(id);
      }
    }
    for (const [id, mk] of wanted) {
      const isChecked = checked.has(id);
      const existing = this.#byId.get(id);
      if (existing) {
        const prev = (existing as any).__checked;
        if (prev !== isChecked) {
          existing.setIcon(this.#icon(mk, isChecked));
          (existing as any).__checked = isChecked;
        }
      } else {
        const lm = this.#L.marker(this.#toLatLng(mk.px, mk.py), {
          icon: this.#icon(mk, isChecked),
          keyboard: false,
        });
        (lm as any).__checked = isChecked;
        lm.on("click", () => this.#onClick(mk, lm));
        this.#layer.addLayer(lm);
        this.#byId.set(id, lm);
      }
    }
  }

  /** Marqueur Leaflet d'un id donné, s'il est actuellement visible. */
  get(id: string): L.Marker | undefined {
    return this.#byId.get(id);
  }

  destroy(): void {
    this.#layer.remove();
    this.#byId.clear();
  }
}
