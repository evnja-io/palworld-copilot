import { getLocale } from "$lib/paraglide/runtime";
import namesFr from "@palworld-companion/game-data/l10n/names.fr.json";
import namesEn from "@palworld-companion/game-data/l10n/names.en.json";
import descFr from "@palworld-companion/game-data/l10n/descriptions.fr.json";
import descEn from "@palworld-companion/game-data/l10n/descriptions.en.json";
import { elLabel } from "$lib/game/elements";
import { workLabel } from "$lib/game/work";
import { RARITY_BY_GAME_ID, rarityLabel } from "$lib/game/rarity";
import type { Locale } from "$lib/search/tokens";

const N = { fr: namesFr, en: namesEn } as Record<string, Record<string, string>>;
const D = { fr: descFr, en: descEn } as Record<string, Record<string, string>>;

/** nsId ex. "pal:Anubis", "item:Wood". Repli : EN puis l'id brut. */
export function gameName(nsId: string): string {
  const loc = getLocale();
  return N[loc]?.[nsId] ?? N.en[nsId] ?? nsId.split(":").pop()!;
}

/** Termes d'interface du jeu qui n'ont pas de table L10N extraite. */
const UI_TERMS: Record<string, { fr: string; en: string }> = {
  COMMON_STATUS_DEFENCE: { fr: "Défense", en: "Defense" },
  COMMON_STATUS_RANGE_ATTACK: { fr: "Attaque à distance", en: "Ranged attack" },
  ADDITIONAL_EFFECT_Poison: { fr: "Poison", en: "Poison" },
  COMMON_WORK_TYPE_CollectResourcePickable: { fr: "Collecte", en: "Gathering" },
  COMMON_WORK_TYPE_ConvertItem: { fr: "Transformation", en: "Conversion" },
  COMMON_WORK_TYPE_Seeding: { fr: "Semis", en: "Planting" },
  COMMON_WORK_TYPE_Watering: { fr: "Arrosage", en: "Watering" },
};

/** Balisage laissé par l'extraction dans 1 107 des 3 272 descriptions FR :
 *  `<characterName id=|Kitsunebi|/>`, `<uiCommon id=|RARITY_EPIC|/>`,
 *  `<activeSkillName id=|AquaJet|/>`, `<img id=|ElemIcon_Fire|/>`.
 *
 *  Non résolu, ce balisage s'affichait tel quel — jusque dans le héros de la
 *  fiche Pal et dans les descriptions SEO. On le remplace par le libellé
 *  localisé correspondant ; les jetons sans équivalent (icônes d'élément, dont
 *  aucun asset n'existe) sont retirés, espaces compactés. */
function resolveToken(tag: string, id: string, loc: Locale): string {
  switch (tag) {
    case "characterName":
      return gameName(`pal:${id}`);
    case "activeSkillName":
      return gameName(`skill:${id}`);
    case "img":
      // ElemIcon_* : pas de jeu d'icônes d'élément dans le dépôt.
      return "";
    case "uiCommon": {
      if (id in RARITY_BY_GAME_ID) return rarityLabel(RARITY_BY_GAME_ID[id]!, loc);
      const elem = id.match(/^COMMON_ELEMENT_NAME_(.+)$/);
      if (elem) return elLabel(elem[1]!, loc);
      const work = id.match(/^COMMON_WORK_SUITABILITY_(.+)$/);
      if (work) return workLabel(work[1]!, loc);
      return UI_TERMS[id]?.[loc] ?? "";
    }
    default:
      return "";
  }
}

/** `style=|…|` est optionnel et suit l'id sur certains jetons. */
const TOKEN_RE = /<([a-zA-Z]+) id=\|([^|]*)\|(?: style=\|[^|]*\|)?\/>/g;

export function resolveGameMarkup(text: string, locale?: Locale): string {
  const loc = locale ?? (getLocale() as Locale);
  if (!text.includes("<")) return text;
  return text
    .replace(TOKEN_RE, (_, tag: string, id: string) => resolveToken(tag, id, loc))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.;:!?])/g, "$1")
    .trim();
}

export function gameDesc(nsId: string): string | undefined {
  const loc = getLocale();
  const raw = D[loc]?.[nsId] ?? D.en[nsId];
  return raw === undefined ? undefined : resolveGameMarkup(raw, loc as Locale);
}
