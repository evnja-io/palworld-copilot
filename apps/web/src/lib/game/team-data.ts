// Ensembles éligibles du team builder, partagés client (pickers) / serveur
// (validation) pour que l'UI propose exactement ce que le serveur accepte.
// N'importe PAS paraglide/names.ts : utilisé par le validateur et vitest.
import pals from "@palworld-companion/game-data/pals.json";
import skills from "@palworld-companion/game-data/skills.json";
import palMoves from "@palworld-companion/game-data/pal-moves.json";
import passiveEffects from "@palworld-companion/game-data/passive-effects.json";
import namesEn from "@palworld-companion/game-data/l10n/names.en.json";
import type { TeamSlot } from "$lib/types";

const NAMES_EN = namesEn as Record<string, string>;
const PASSIVES = passiveEffects as Record<string, { rank: number }>;

/** Passifs innés d'espèce (pals.json), filtrés aux ids valides, plafonnés à 4. */
const DEFAULT_PASSIVES = new Map<string, string[]>(
  (pals as Array<{ id: string; passives?: string[] }>).map((p) => [
    p.id,
    (p.passives ?? []).filter((id) => Object.prototype.hasOwnProperty.call(PASSIVES, id)).slice(0, 4),
  ]),
);

export const PAL_IDS: Set<string> = new Set((pals as Array<{ id: string }>).map((p) => p.id));

// skills.json mélange actifs et partner skills ; 52 entrées (PNJ/junk) n'ont
// pas de nom EN — exclues des deux côtés (picker ET validation).
export const ACTIVE_SKILL_IDS: Set<string> = new Set(
  Object.keys(skills as Record<string, unknown>).filter(
    (id) => !/partnerskill/i.test(id) && Boolean(NAMES_EN[`skill:${id}`]),
  ),
);

export const PASSIVE_IDS: Set<string> = new Set(Object.keys(PASSIVES));

export function passiveRank(passiveId: string): number {
  return Object.prototype.hasOwnProperty.call(PASSIVES, passiveId)
    ? PASSIVES[passiveId].rank
    : 0;
}

// pal-moves.json diverge en casse de pals.json pour 4 ids (ex. GhostAnglerFish
// vs GhostAnglerfish, cf. packages/pipeline/src/transform/pals.ts:6).
const MOVES_LC = new Map<string, Array<{ level: number; skillId: string }>>(
  Object.entries(palMoves as Record<string, Array<{ level: number; skillId: string }>>).map(
    ([k, v]) => [k.toLowerCase(), v],
  ),
);

export function learnsetFor(palId: string): Array<{ level: number; skillId: string }> {
  const raw = MOVES_LC.get(palId.toLowerCase()) ?? [];
  return raw
    .filter((e) => ACTIVE_SKILL_IDS.has(e.skillId))
    .slice()
    .sort((a, b) => a.level - b.level);
}

export function partnerSkillNsId(palId: string): string {
  return `partnerskill:${palId}`;
}

/** Passifs par défaut d'un Pal : ses passifs innés d'espèce (0 à 4). */
export function defaultPassivesFor(palId: string): string[] {
  return DEFAULT_PASSIVES.get(palId) ?? [];
}

/** Actifs par défaut d'un Pal : ses 3 skills de plus haut niveau (loadout de fin
 *  de jeu), du plus fort au plus faible. [] si le Pal n'a pas de learnset. */
export function defaultActivesFor(palId: string): string[] {
  return learnsetFor(palId)
    .slice(-3)
    .reverse()
    .map((e) => e.skillId);
}

/** Slot pré-rempli au placement d'un Pal : passifs innés + actifs par défaut,
 *  pour ne pas repartir d'un slot vide (données déjà connues par espèce). */
export function defaultSlotFor(palId: string): TeamSlot {
  return {
    palId,
    passives: defaultPassivesFor(palId),
    actives: defaultActivesFor(palId),
  };
}
