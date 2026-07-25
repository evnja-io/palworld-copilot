// Descriptions meta par entité. Objectif : chaque page de détail porte un texte
// DISTINCT. On part toujours de la description du jeu (l10n) quand elle existe,
// et on retombe sinon sur un gabarit alimenté par les données de l'entité —
// jamais sur une phrase générique répétée sur des centaines de pages.
import buildings from "@palworld-companion/game-data/buildings.json";
import items from "@palworld-companion/game-data/items.json";
import { m } from "$lib/paraglide/messages";
import { gameDesc, gameName } from "$lib/game/names";

/** Longueur cible d'une meta description (les moteurs tronquent vers 155-160). */
const MAX_LEN = 158;

/** Normalise un texte de jeu en une ligne exploitable dans une balise meta :
 *  les descriptions l10n contiennent des \r\n et des espaces doublés. */
export function metaText(raw: string): string {
  const flat = raw.replace(/\s+/g, " ").trim();
  if (flat.length <= MAX_LEN) return flat;
  const cut = flat.slice(0, MAX_LEN);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Longueur en dessous de laquelle une description l10n n'apporte rien. */
const MIN_USEFUL_LEN = 25;

/** Une description de jeu est-elle exploitable comme meta description ?
 *  Certaines entrées l10n sont des placeholders : absentes, ou réduites au nom
 *  de l'entité (`item:AnimalSkin` → « Animal Skin »). Les laisser passer
 *  produirait une meta de 11 caractères, pire qu'un gabarit. */
function usableDesc(desc: string | undefined, name: string): string | null {
  if (!desc) return null;
  const flat = desc.replace(/\s+/g, " ").trim();
  if (flat.length < MIN_USEFUL_LEN || flat === name) return null;
  return flat;
}

/** Pal : les 288 ont une description de jeu exploitable, distincte. */
export function palSeoDescription(palId: string): string {
  const name = gameName(`pal:${palId}`);
  const desc = usableDesc(gameDesc(`pal:${palId}`), name);
  return metaText(desc ?? m.seo_pal_fallback({ name }));
}

const ITEM_RARITY = new Map<string, number>(
  (items as Array<{ id: string; rarity?: number }>).map((i) => [i.id, i.rarity ?? 0]),
);

/** Objet : ~2220/2344 ont une description exploitable ; gabarit pour les autres.
 *  Le gabarit mentionne la rareté quand elle existe : sans ça, les variantes
 *  `_2.._5` d'un même équipement (Head001_2…_5 partagent le nom « Couronne
 *  royale » et n'ont aucune description) produiraient des metas identiques. */
export function itemSeoDescription(itemId: string): string {
  const name = gameName(`item:${itemId}`);
  const desc = usableDesc(gameDesc(`item:${itemId}`), name);
  if (desc) return metaText(desc);
  const rarity = ITEM_RARITY.get(itemId) ?? 0;
  return metaText(
    rarity > 0 ? m.seo_item_fallback_rarity({ name, rarity }) : m.seo_item_fallback({ name }),
  );
}

type BuildingRow = {
  id: string;
  mapObjectId: string;
  materials?: Array<{ id: string; count: number }>;
};

// Indexé par `id` (le paramètre de route), mais le nom se résout via
// `mapObjectId` : les deux diffèrent pour 6 constructions (CampFire →
// Campfire, Stone_pillar → Stone_Pillar…), cf. la page de détail.
const BUILDINGS = new Map<string, BuildingRow>(
  (buildings as BuildingRow[]).map((b) => [b.id, b]),
);

/** Construction : aucune n'a de description de jeu (le namespace `building:`
 *  n'existe pas dans l10n). On compose donc avec les matériaux requis, qui
 *  distinguent réellement les 498 pages les unes des autres. */
export function buildingSeoDescription(buildingId: string): string {
  const row = BUILDINGS.get(buildingId);
  const name = gameName(`building:${row?.mapObjectId ?? buildingId}`);
  const materials = row?.materials ?? [];
  if (materials.length === 0) return metaText(m.seo_building_fallback({ name }));
  const list = materials
    .map((mat) => `${mat.count} ${gameName(`item:${mat.id}`)}`)
    .join(", ");
  return metaText(m.seo_building_materials({ name, materials: list }));
}
