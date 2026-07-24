// Fixtures partagées du design lab team builder — AUCUN accès DB.
// Ids réels vérifiés contre les ensembles éligibles de $lib/game/team-data ;
// une assertion au chargement casse le lab si un id devient invalide.
import pals from "@palworld-companion/game-data/pals.json";
import skills from "@palworld-companion/game-data/skills.json";
import { PAL_IDS, ACTIVE_SKILL_IDS, PASSIVE_IDS, passiveRank } from "$lib/game/team-data";

export type FixtureSlot = {
  palId: string | null;
  passives: string[];
  actives: string[];
};

export type FixtureTeam = {
  name: string;
  notes: string;
  author: string;
  updatedAt: string;
  slots: FixtureSlot[];
};

export const TEAM: FixtureTeam = {
  name: "Raid Bellanoir — Nuit 3",
  notes:
    "Compo anti-boss : Anubis en pivot esquive, Neptilius pour le burst Eau. " +
    "Slot 5 libre pour le contre élémentaire. Lecture seule pour les autres membres du serveur.",
  author: "Sephi",
  updatedAt: "il y a 2 h",
  slots: [
    {
      palId: "Anubis",
      passives: ["Legend", "PAL_ALLAttack_up2", "ElementBoost_Earth_2_PAL", "PAL_Sanity_Down_2"],
      actives: ["SandTornado", "Unique_Anubis_GroundPunch", "RockBeat"],
    },
    {
      palId: "PoseidonOrca",
      passives: ["Legend", "ElementBoost_Aqua_2_PAL", "PAL_ALLAttack_up2", "Rare"],
      actives: ["RipTide", "SeaGush", "Unique_PoseidonOrca_TorrentLaser"],
    },
    {
      palId: "BlueThunderHorse",
      passives: ["ElementBoost_Thunder_2_PAL", "MoveSpeed_up_2", "PAL_ALLAttack_up2", "Noukin"],
      actives: ["TriSpark", "Unique_BlueThunderHorse_FlashDash", "ThunderStorm"],
    },
    {
      palId: "GrassGolem",
      passives: ["ElementBoost_Leaf_2_PAL", "PAL_FullStomach_Down_2", "Stamina_Up_2", "PAL_Sanity_Down_2"],
      actives: ["SolarBeam", "WindBurst", "Unique_GrassGolem_ArmCannon"],
    },
    { palId: null, passives: [], actives: [] },
  ],
};

// Garde-fou : tout id de fixture doit exister dans les ensembles éligibles.
for (const slot of TEAM.slots) {
  if (slot.palId && !PAL_IDS.has(slot.palId)) {
    throw new Error(`fixture invalide : pal ${slot.palId}`);
  }
  for (const p of slot.passives) {
    if (!PASSIVE_IDS.has(p)) throw new Error(`fixture invalide : passif ${p}`);
  }
  for (const a of slot.actives) {
    if (!ACTIVE_SKILL_IDS.has(a)) throw new Error(`fixture invalide : actif ${a}`);
  }
}

const PALS = pals as Array<{ id: string; elements: string[]; zukanIndex: number }>;
const SKILLS = skills as Record<string, { element?: string; power?: number; ct?: number }>;

export function palElements(palId: string): string[] {
  return PALS.find((p) => p.id === palId)?.elements ?? [];
}

export function palZukan(palId: string): number {
  return PALS.find((p) => p.id === palId)?.zukanIndex ?? 0;
}

export function skillInfo(skillId: string): { element?: string; power?: number; ct?: number } {
  return SKILLS[skillId] ?? {};
}

export { passiveRank };
