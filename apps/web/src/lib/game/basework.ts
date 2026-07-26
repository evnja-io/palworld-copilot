// Moteur offre/demande des bases : puissance de travail effective des pals
// assignés, statut par type de travail et recommandations d'affectation.
// Module pur, client-safe : n'importe QUE les JSON de game-data (comme
// team-data.ts), zéro Svelte, zéro serveur.
//
// Formule verrouillée (cf. plan base-orchestration) :
//   rank_t  = pals.json[palId].work[t] ?? 0            (clés absentes = 0)
//   addRank = somme des effets "WorkSuitabilityAddRank_MonsterFarm" (ToSelf)
//   mult    = max(0, 1 + somme des effets "CraftSpeed" (ToSelf) / 100)
//   power_t = t === "MonsterFarm"
//               ? (rank_t > 0 ? rank_t + addRank : 0)   AddRank seulement si
//                 aptitude innée (choix conservateur), CraftSpeed ignoré au ranch
//               : rank_t * mult
//
// Non-objectifs assumés (extensions futures, hors formule verrouillée) :
// - stat de base d'espèce craftSpeed (pals.json stats.craftSpeed) ;
// - rangs de condensation (absents de save_pals) ;
// - types d'effets passifs Mining/Logging (cibles non vérifiées).

import pals from "@palworld-companion/game-data/pals.json";
import passiveEffects from "@palworld-companion/game-data/passive-effects.json";

export const WORK_KEYS = [
  "Handcraft",
  "MonsterFarm",
  "Transport",
  "Collection",
  "Mining",
  "Deforest",
  "ProductMedicine",
  "Seeding",
  "Watering",
  "EmitFlame",
  "GenerateElectricity",
  "Cool",
] as const;
export type WorkKey = (typeof WORK_KEYS)[number];
export type WorkVector = Record<WorkKey, number>;

/** 1 poids de demande « vaut » 3 points de puissance (~ un ouvrier rang 3). Heuristique documentée. */
export const UNIT_SUPPLY = 3;
/** Capacité par défaut quand slot_count est inconnu (cap de base vanilla). */
export const DEFAULT_SLOT_COUNT = 15;
const OVERSUPPLY_RATIO = 2; // s > 2 x cible => excédent

// Index espèce -> aptitudes de travail (pals.json).
const WORK_BY_PAL = new Map<string, Record<string, number>>(
  // via unknown : certaines entrées ont un work vide {} dont l'inférence JSON
  // (clés toutes optionnelles undefined) n'est pas assignable à Record<string, number>.
  (pals as unknown as Array<{ id: string; work?: Record<string, number> }>).map((p) => [
    p.id,
    p.work ?? {},
  ]),
);

type PassiveEffect = { target: string; type: string; value: number };
const PASSIVES = passiveEffects as Record<string, { effects?: PassiveEffect[]; rank: number }>;

function zeroVector(): WorkVector {
  const v = {} as WorkVector;
  for (const k of WORK_KEYS) v[k] = 0;
  return v;
}

/** Somme des valeurs d'un type d'effet passif, cible ToSelf uniquement
 *  (les effets ToTrainer/ToOtherPals ne s'appliquent pas au pal porteur). */
function sumSelfEffects(passives: string[], type: string): number {
  let s = 0;
  for (const id of passives) {
    for (const e of PASSIVES[id]?.effects ?? []) {
      if (e.type === type && e.target === "ToSelf") s += e.value;
    }
  }
  return s;
}

/** Multiplicateur de vitesse de fabrication : max(0, 1 + Σ CraftSpeed / 100). */
export function craftSpeedMultiplier(passives: string[]): number {
  return Math.max(0, 1 + sumSelfEffects(passives, "CraftSpeed") / 100);
}

/** Puissance de travail effective d'un pal par type de travail.
 *  palId inconnu -> vecteur nul (espèce absente de pals.json). */
export function effectiveWork(palId: string, passives: string[]): WorkVector {
  const out = zeroVector();
  const work = WORK_BY_PAL.get(palId);
  if (!work) return out;
  const mult = craftSpeedMultiplier(passives);
  const addRank = sumSelfEffects(passives, "WorkSuitabilityAddRank_MonsterFarm");
  for (const k of WORK_KEYS) {
    const rank = work[k] ?? 0;
    // MonsterFarm : rang inné + AddRank (si aptitude innée), CraftSpeed ignoré au ranch.
    out[k] = k === "MonsterFarm" ? (rank > 0 ? rank + addRank : 0) : rank * mult;
  }
  return out;
}

/** Offre totale d'un groupe de travailleurs : somme des puissances effectives. */
export function supplyVector(
  workers: ReadonlyArray<{ palId: string; passives: string[] }>,
): WorkVector {
  const out = zeroVector();
  for (const w of workers) {
    const p = effectiveWork(w.palId, w.passives);
    for (const k of WORK_KEYS) out[k] += p[k];
  }
  return out;
}

/** Profil de demande complet depuis les lignes base_demands : absence de
 *  ligne = poids 1, clamp entier 0..3 (défense, l'endpoint valide déjà). */
export function normalizeDemands(
  rows: ReadonlyArray<{ workType: string; weight: number }>,
): Record<WorkKey, number> {
  const out = {} as Record<WorkKey, number>;
  for (const k of WORK_KEYS) out[k] = 1;
  for (const r of rows) {
    if (!(WORK_KEYS as readonly string[]).includes(r.workType)) continue;
    out[r.workType as WorkKey] = Number.isFinite(r.weight)
      ? Math.min(3, Math.max(0, Math.trunc(r.weight)))
      : 1;
  }
  return out;
}

export type WorkStatusKind = "ok" | "bottleneck" | "oversupply" | "idle";
export type WorkStatus = {
  work: WorkKey;
  weight: number;
  supply: number;
  target: number;
  /** min(1, offre/cible), null quand le travail est ignoré (poids 0). */
  coverage: number | null;
  kind: WorkStatusKind;
};

/** Statut par type de travail, dans l'ordre WORK_KEYS.
 *  cible = poids x UNIT_SUPPLY ;
 *  poids 0 et offre > 0 -> idle (offre inutile) ; poids 0 -> ok ;
 *  offre < cible -> bottleneck ; offre > OVERSUPPLY_RATIO x cible -> oversupply ; sinon ok. */
export function baseStatus(
  supply: WorkVector,
  demands: Record<WorkKey, number>,
): WorkStatus[] {
  return WORK_KEYS.map((work) => {
    const weight = demands[work];
    const s = supply[work];
    const target = weight * UNIT_SUPPLY;
    let kind: WorkStatusKind;
    if (weight === 0) kind = s > 0 ? "idle" : "ok";
    else if (s < target) kind = "bottleneck";
    else if (s > OVERSUPPLY_RATIO * target) kind = "oversupply";
    else kind = "ok";
    return {
      work,
      weight,
      supply: s,
      target,
      coverage: weight === 0 ? null : Math.min(1, s / target),
      kind,
    };
  });
}

export type Candidate = {
  instanceId: string;
  palId: string;
  passives: string[];
  ownerGuid: string;
  level: number;
  nickname: string | null;
};

/** Recommandations gloutonnes et déterministes pour une base.
 *
 *  score(c) = Σ_t poids_t x min(power_t(c), deficit_t) ; égalités départagées
 *  par puissance totale décroissante, puis palId ASC, puis instanceId ASC.
 *  Ajouts tant qu'il reste des slots libres, un déficit et un score > 0
 *  (application virtuelle après chaque ajout). Échanges seulement base pleine :
 *  les maxSwaps assignés les moins utiles (perte marginale pondérée) sont
 *  candidats à la sortie si net = score(entrant) - utilité(sortant) > 1e-9.
 *  idle = travaux à poids 0 mais offre > 0 sur l'état INITIAL.
 *  Complexité O((maxAdds + maxSwaps) x |pool| x 12). */
export function recommend(args: {
  assigned: Candidate[];
  slotCount: number | null;
  demands: Record<WorkKey, number>;
  pool: Candidate[];
  maxAdds?: number;
  maxSwaps?: number;
}): {
  adds: Array<{ pal: Candidate; score: number; gains: Partial<WorkVector> }>;
  swaps: Array<{ out: Candidate; in: Candidate; net: number }>;
  idle: WorkKey[];
} {
  const { assigned, pool, demands } = args;
  const maxAdds = args.maxAdds ?? 5;
  const maxSwaps = args.maxSwaps ?? 3;

  // Cache des puissances par instance (assigned et pool confondus).
  const powerCache = new Map<string, WorkVector>();
  const powerOf = (c: Candidate): WorkVector => {
    let v = powerCache.get(c.instanceId);
    if (!v) {
      v = effectiveWork(c.palId, c.passives);
      powerCache.set(c.instanceId, v);
    }
    return v;
  };
  const totalPower = (c: Candidate): number => {
    const p = powerOf(c);
    let s = 0;
    for (const k of WORK_KEYS) s += p[k];
    return s;
  };

  const target = zeroVector();
  for (const k of WORK_KEYS) target[k] = demands[k] * UNIT_SUPPLY;

  // État virtuel : offre courante, mise à jour après chaque ajout/échange.
  const supply = supplyVector(assigned);

  // idle : calculé sur l'état INITIAL, indépendant des ajouts/échanges.
  const idle = WORK_KEYS.filter((k) => demands[k] === 0 && supply[k] > 0);

  const deficit = zeroVector();
  const refreshDeficit = () => {
    for (const k of WORK_KEYS) deficit[k] = Math.max(0, target[k] - supply[k]);
  };
  refreshDeficit();
  const sumDeficit = () => {
    let s = 0;
    for (const k of WORK_KEYS) s += deficit[k];
    return s;
  };

  let freeSlots = Math.max(0, (args.slotCount ?? DEFAULT_SLOT_COUNT) - assigned.length);

  const score = (c: Candidate, def: WorkVector): number => {
    const p = powerOf(c);
    let s = 0;
    for (const k of WORK_KEYS) s += demands[k] * Math.min(p[k], def[k]);
    return s;
  };

  // Instances déjà proposées (ajout ou entrant d'échange) : jamais reproposées.
  const proposed = new Set<string>();

  /** Meilleur candidat du pool pour un vecteur de déficits donné, avec les
   *  départages déterministes de la spec. */
  const pickBest = (def: WorkVector): { c: Candidate; s: number } | null => {
    let best: Candidate | null = null;
    let bestS = 0;
    for (const c of pool) {
      if (proposed.has(c.instanceId)) continue;
      const s = score(c, def);
      if (best === null || s > bestS) {
        best = c;
        bestS = s;
        continue;
      }
      if (s < bestS) continue;
      // Égalité de score : puissance totale décroissante, puis palId ASC, puis instanceId ASC.
      const dp = totalPower(c) - totalPower(best);
      if (
        dp > 0 ||
        (dp === 0 &&
          (c.palId < best.palId || (c.palId === best.palId && c.instanceId < best.instanceId)))
      ) {
        best = c;
        bestS = s;
      }
    }
    return best === null ? null : { c: best, s: bestS };
  };

  // Phase 1 : ajouts (slots libres).
  const adds: Array<{ pal: Candidate; score: number; gains: Partial<WorkVector> }> = [];
  while (freeSlots > 0 && adds.length < maxAdds && sumDeficit() > 0) {
    const best = pickBest(deficit);
    if (best === null || best.s <= 0) break;
    const p = powerOf(best.c);
    // gains : contribution réellement imputée par clé (bornée au déficit AVANT
    // application), clés non nulles seulement.
    const gains: Partial<WorkVector> = {};
    for (const k of WORK_KEYS) {
      const g = Math.min(p[k], deficit[k]);
      if (g > 0) gains[k] = g;
    }
    adds.push({ pal: best.c, score: best.s, gains });
    proposed.add(best.c.instanceId);
    for (const k of WORK_KEYS) supply[k] += p[k];
    refreshDeficit();
    freeSlots--;
  }

  // Phase 2 : échanges (uniquement base pleine et déficits restants).
  const swaps: Array<{ out: Candidate; in: Candidate; net: number }> = [];
  if (freeSlots === 0 && sumDeficit() > 0) {
    // Utilité d'un assigné : perte marginale pondérée de couverture si on le retire.
    const usefulness = (a: Candidate): number => {
      const p = powerOf(a);
      let u = 0;
      for (const k of WORK_KEYS) {
        u += demands[k] * (Math.min(supply[k], target[k]) - Math.min(supply[k] - p[k], target[k]));
      }
      return u;
    };
    const ranked = assigned
      .map((a) => ({ a, u: usefulness(a) }))
      .sort(
        (x, y) =>
          x.u - y.u ||
          (x.a.instanceId < y.a.instanceId ? -1 : x.a.instanceId > y.a.instanceId ? 1 : 0),
      )
      .slice(0, maxSwaps); // les maxSwaps assignés les moins utiles

    for (const { a, u } of ranked) {
      if (sumDeficit() <= 0) break;
      // Retrait virtuel du sortant : déficits recalculés sans sa contribution.
      const pOut = powerOf(a);
      const defWithout = zeroVector();
      for (const k of WORK_KEYS) defWithout[k] = Math.max(0, target[k] - (supply[k] - pOut[k]));
      const best = pickBest(defWithout);
      if (best === null) continue;
      const net = best.s - u;
      if (net <= 1e-9) continue;
      swaps.push({ out: a, in: best.c, net });
      proposed.add(best.c.instanceId);
      const pIn = powerOf(best.c);
      for (const k of WORK_KEYS) supply[k] += pIn[k] - pOut[k];
      refreshDeficit();
    }
  }

  return { adds, swaps, idle };
}
