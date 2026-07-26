// Filtrage de la carte. Deux sorties distinctes et volontairement séparées :
//  · runQuery       -> la LISTE (une seule catégorie, celle qui est sélectionnée)
//  · visibleMarkers -> la CARTE (toutes les catégories visibles)
// Module pur : ni DOM, ni i18n, ni Svelte.
import { CATEGORIES, categoryOf, type CatKey } from "./categories";
import type { MapMarker } from "./markerController";

export type Query = {
  /** Catégorie au premier plan : liste + contrôles d'affinage. */
  selected: CatKey;
  /** Catégories dessinées sur la carte. */
  visible: CatKey[];
  levelMin: number;
  element: string;
  hideTracked: boolean;
  search: string;
};

export function defaultQuery(): Query {
  return {
    selected: "relic",
    // Les quatre catégories de progression : afficher les 447 marqueurs d'entrée
    // de jeu noierait la carte.
    visible: ["relic", "alpha", "boss", "tower"],
    levelMin: 1,
    element: "",
    hideTracked: false,
    search: "",
  };
}

/** Repli sans accents ni casse, pour que « volcan noir » trouve « Volcan Noir ». */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Lignes de la liste : la catégorie sélectionnée, affinée. */
export function runQuery(
  markers: MapMarker[],
  q: Query,
  mine: ReadonlySet<string>,
  nameOf: (mk: MapMarker) => string,
  elementOf?: (mk: MapMarker) => string | undefined,
): MapMarker[] {
  const meta = CATEGORIES[q.selected];
  if (!meta || meta.future || q.selected === "spawn") return [];
  const needle = q.search.trim() ? norm(q.search.trim()) : "";
  const wantsLevel = meta.refine !== "none";
  const wantsElement = meta.refine === "level+element" && !!q.element;
  return markers.filter((mk) => {
    if (categoryOf(mk) !== q.selected) return false;
    if (q.hideTracked && mine.has(mk.id)) return false;
    if (wantsLevel && q.levelMin > 1 && (mk.meta?.level ?? 0) < q.levelMin) return false;
    if (wantsElement && elementOf?.(mk) !== q.element) return false;
    if (needle && !norm(nameOf(mk)).includes(needle)) return false;
    return true;
  });
}

/** Marqueurs à dessiner : toutes les catégories visibles. `hideTracked` s'y
 *  applique aussi, sinon « masquer les faits » ne masquerait que la liste. */
export function visibleMarkers(
  markers: MapMarker[],
  q: Query,
  mine: ReadonlySet<string>,
): MapMarker[] {
  const visible = new Set(q.visible);
  return markers.filter((mk) => {
    if (!visible.has(categoryOf(mk))) return false;
    if (q.hideTracked && mine.has(mk.id)) return false;
    return true;
  });
}
