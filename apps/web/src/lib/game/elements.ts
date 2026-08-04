import { getLocale } from "$lib/paraglide/runtime";
import { ELEMENT_LABELS, type Locale } from "$lib/search/tokens";

/** Ids d'élément tels qu'ils sortent des données (`pals.json[].elements`,
 *  `skills.json[].element`). PascalCase anglais — ce sont eux la vérité, pas
 *  les noms de tokens. */
export type ElementId =
  | "Fire"
  | "Water"
  | "Leaf"
  | "Electricity"
  | "Ice"
  | "Earth"
  | "Dark"
  | "Dragon"
  | "Normal";

/** Suffixes des tokens Atlas (`--color-el-<token>`), en français : c'est la
 *  convention du thème livré, qu'on n'a pas à renommer. */
export type ElementToken =
  | "feu"
  | "eau"
  | "feuille"
  | "elec"
  | "glace"
  | "terre"
  | "tenebres"
  | "dragon"
  | "normal";

/** Ordre d'affichage des filtres (Paldex 2a) : celui du HTML de référence,
 *  pas l'ordre alphabétique. */
export const ELEMENT_IDS: readonly ElementId[] = [
  "Fire",
  "Water",
  "Leaf",
  "Electricity",
  "Dark",
  "Ice",
  "Earth",
  "Dragon",
  "Normal",
];

const TOKENS: Record<ElementId, ElementToken> = {
  Fire: "feu",
  Water: "eau",
  Leaf: "feuille",
  Electricity: "elec",
  Ice: "glace",
  Earth: "terre",
  Dark: "tenebres",
  Dragon: "dragon",
  Normal: "normal",
};

/** Teintes Atlas, dupliquées ici pour les consommateurs hors CSS (Leaflet
 *  dessine ses cercles en JS et ne peut pas lire une custom property). */
const HEX: Record<ElementToken, string> = {
  feu: "#ff5a0f",
  eau: "#2f8fff",
  feuille: "#3fb950",
  elec: "#f5c518",
  glace: "#56c8e8",
  terre: "#c98a3d",
  tenebres: "#8b5cf6",
  dragon: "#7c5cff",
  normal: "#a8a29e",
};

/** `'Fire'` → `'feu'`. Repli sur `normal` pour tout id inconnu : les skills
 *  portent `'None'`, et une régénération de game-data peut introduire un
 *  élément que ce module ne connaît pas encore. */
export function elToken(id: string): ElementToken {
  return TOKENS[id as ElementId] ?? "normal";
}

/** `'Fire'` → `'var(--color-el-feu)'`. Valeur à poser dans `--el`. */
export function elVar(id: string): string {
  return `var(--color-el-${elToken(id)})`;
}

/** `'Fire'` → `'#ff5a0f'`. Pour Leaflet, canvas, ou `<meta theme-color>`. */
export function elHex(id: string): string {
  return HEX[elToken(id)];
}

/** Libellé localisé, casse naturelle (« Ténèbres »). Les badges appliquent
 *  `text-transform: uppercase` — pas de second jeu de clés en majuscules.
 *
 *  Source : ELEMENT_LABELS, déjà utilisé par la palette ⌘K. Deux libellés
 *  divergent de la maquette (Leaf = « Plante » et non « Feuille », Normal =
 *  « Neutre » et non « Normal ») : on garde l'existant, sans quoi la recherche
 *  et les filtres parleraient deux vocabulaires différents. */
export function elLabel(id: string, locale?: Locale): string {
  const loc = locale ?? (getLocale() as Locale);
  return ELEMENT_LABELS[id]?.[loc] ?? id;
}

/** Style inline pour toute surface teintée.
 *
 *  Pose `--el` (élément principal), `--el2` (second élément, retombe sur `--el`
 *  en mono-type) et `--el2-a`, l'alpha de fin du dégradé. Les deux valeurs
 *  d'alpha viennent du HTML de référence, écran 2b : un slot mono-type finit à
 *  4 % de sa propre teinte (slot 2, Feuille), un bi-type finit à 8 % de sa
 *  seconde teinte (slot 3). Consommé par `.el-card-dual` (app.css). */
export function elVars(elements: readonly string[]): string {
  const first = elements[0] ?? "Normal";
  const second = elements[1];
  return second
    ? `--el:${elVar(first)};--el2:${elVar(second)};--el2-a:8%`
    : `--el:${elVar(first)};--el2:${elVar(first)};--el2-a:4%`;
}
