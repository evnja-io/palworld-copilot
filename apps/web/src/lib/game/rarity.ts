import { getLocale } from "$lib/paraglide/runtime";
import type { ElementToken } from "$lib/game/elements";
import type { Locale } from "$lib/search/tokens";

/** Paliers de rareté du jeu, tels qu'ils apparaissent dans les descriptions
 *  (`<uiCommon id=|RARITY_EPIC|/>`). */
export type RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

const LABELS: Record<RarityTier, { fr: string; en: string }> = {
  common: { fr: "Commun", en: "Common" },
  uncommon: { fr: "Peu commun", en: "Uncommon" },
  rare: { fr: "Rare", en: "Rare" },
  epic: { fr: "Épique", en: "Epic" },
  legendary: { fr: "Légendaire", en: "Legendary" },
};

/** Teinte du palier — reprise du dessin 3b : épique en ténèbres (bordure +
 *  halo), rare en eau, le reste neutre. */
const TOKENS: Record<RarityTier, ElementToken> = {
  common: "normal",
  uncommon: "normal",
  rare: "eau",
  epic: "tenebres",
  legendary: "elec",
};

/** `items.json[].rarity` vaut 0, 1, 2, 3, 4, 5 ou 99 (valeurs observées).
 *
 *  ⚠ Le dessin étiquette l'Arc composite « ÉPIQUE » alors que la donnée lui
 *  donne `rarity: 0`. La maquette est illustrative : on affiche le vrai palier,
 *  la vignette ne correspondra donc pas au screenshot. */
export function rarityTier(rarity: number): RarityTier {
  if (rarity >= 4) return "legendary";
  if (rarity === 3) return "epic";
  if (rarity === 2) return "rare";
  if (rarity === 1) return "uncommon";
  return "common";
}

export function rarityLabel(tier: RarityTier, locale?: Locale): string {
  const loc = locale ?? (getLocale() as Locale);
  return LABELS[tier][loc];
}

export function rarityToken(tier: RarityTier): ElementToken {
  return TOKENS[tier];
}

/** Table indexée par l'identifiant du jeu, pour résoudre les jetons
 *  `<uiCommon id=|RARITY_*|/>` des descriptions. */
export const RARITY_BY_GAME_ID: Record<string, RarityTier> = {
  RARITY_COMMON: "common",
  RARITY_UNCOMMON: "uncommon",
  RARITY_RARE: "rare",
  RARITY_EPIC: "epic",
  RARITY_LEGENDARY: "legendary",
};
