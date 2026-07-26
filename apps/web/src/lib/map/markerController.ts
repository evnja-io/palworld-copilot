// Pont Svelte -> Leaflet : Leaflet possède le DOM de la carte, Svelte l'état.
// sync() reçoit l'état dérivé et diffe impérativement - jamais un composant
// Svelte par marqueur (~450).
import type * as L from "leaflet";
import { palIcon } from "$lib/game/icons";

export type MapMarker = {
  id: string;
  type: "relic" | "alpha" | "boss" | "tower" | "watchtower" | "ft";
  px: number;
  py: number;
  nameId?: string;
  meta?: { palId?: string; level?: number };
};

export type MarkerClickHandler = (marker: MapMarker, leafletMarker: L.Marker) => void;

const GLYPH: Record<MapMarker["type"], string> = {
  relic: "✦",
  alpha: "▲",
  boss: "☠",
  tower: "⌂",
  watchtower: "⌖",
  ft: "◆",
};

/** HTML du divIcon. Les Alpha portent le portrait de leur Pal ; les boss PNJ et
 *  les icônes absentes gardent le glyphe. */
export function markerHtml(mk: MapMarker, checked: boolean): string {
  const hasLevel = mk.type === "alpha" || mk.type === "boss";
  const level = hasLevel && mk.meta?.level ? `<i>${mk.meta.level}</i>` : "";
  const icon = mk.type === "alpha" && mk.meta?.palId ? palIcon(mk.meta.palId) : undefined;
  const body = icon ? `<img src="${icon}" alt="" width="18" height="18" />` : GLYPH[mk.type];
  const cls = `mk mk-${mk.type}${icon ? " mk-pal" : ""}${checked ? " mk-checked" : ""}`;
  return `<span class="${cls}">${body}${level}</span>`;
}

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
    return this.#L.divIcon({
      className: "",
      html: markerHtml(mk, checked),
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
