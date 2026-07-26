// Registre des catégories de la carte : métadonnées visuelles et capacités.
// Module pur — aucune i18n ici (voir categoryLabels.ts), aucun DOM : c'est ce
// qui le rend testable et réutilisable par query.ts.
import type { GroupUser } from "$lib/types";
import type { MapMarker } from "./markerController";

export type CatKey =
  | "relic"
  | "alpha"
  | "boss"
  | "tower"
  | "watchtower"
  | "ft"
  | "spawn"
  | "resource";

export type CategoryMeta = {
  /** Couleur de la pastille, du glyphe et de la teinte de ligne. */
  color: string;
  glyph: string;
  /** Cochable individuellement (kind `marker`). */
  trackable: boolean;
  /** Contrôles d'affinage pertinents pour cette catégorie. */
  refine: "none" | "level" | "level+element";
  /** Catégorie sans données : visible, grisée, désactivée. */
  future: boolean;
};

/** Ordre du rail. Ajouter une catégorie = ajouter une entrée ici. */
export const CATEGORY_ORDER: CatKey[] = [
  "relic",
  "alpha",
  "boss",
  "tower",
  "watchtower",
  "ft",
  "resource",
  "spawn",
];

export const CATEGORIES: Record<CatKey, CategoryMeta> = {
  relic: { color: "var(--el-leaf)", glyph: "✦", trackable: true, refine: "none", future: false },
  alpha: {
    color: "var(--el-fire)",
    glyph: "▲",
    trackable: true,
    refine: "level+element",
    future: false,
  },
  boss: { color: "var(--el-dark)", glyph: "☠", trackable: true, refine: "level", future: false },
  tower: {
    color: "var(--el-electricity)",
    glyph: "⌂",
    trackable: true,
    refine: "none",
    future: false,
  },
  watchtower: {
    color: "var(--el-ice)",
    glyph: "⌖",
    trackable: true,
    refine: "none",
    future: false,
  },
  ft: { color: "var(--accent)", glyph: "◆", trackable: true, refine: "none", future: false },
  // Aucune donnée : spawners World Partition, cf. docs/decisions.md.
  resource: { color: "var(--el-earth)", glyph: "◈", trackable: false, refine: "none", future: true },
  // Pseudo-catégorie : des zones, pas des marqueurs. Pilotée par SpawnPicker.
  spawn: { color: "var(--accent)", glyph: "◍", trackable: false, refine: "none", future: false },
};

/** Catégories réellement présentes dans markers.json. */
export const MARKER_CATEGORIES = CATEGORY_ORDER.filter(
  (k) => !CATEGORIES[k].future && k !== "spawn",
);

/** `type` de markers.json EST la clé de catégorie : la classification se fait
 *  dans le pipeline (transform/markers.lib.ts), pas ici. */
export function categoryOf(mk: MapMarker): CatKey {
  return mk.type;
}

export type CatCount = { total: number; mine: number; group: number };

export function countsByCategory(
  markers: MapMarker[],
  mine: ReadonlySet<string>,
  group: Record<string, GroupUser[]>,
): Record<CatKey, CatCount> {
  const out = Object.fromEntries(
    CATEGORY_ORDER.map((k) => [k, { total: 0, mine: 0, group: 0 }]),
  ) as Record<CatKey, CatCount>;
  for (const mk of markers) {
    const c = out[categoryOf(mk)];
    if (!c) continue;
    c.total++;
    if (mine.has(mk.id)) c.mine++;
    if (group[mk.id]?.length) c.group++;
  }
  return out;
}
