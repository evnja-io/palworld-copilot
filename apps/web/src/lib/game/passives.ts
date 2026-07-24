// Probabilités d'héritage des compétences passives à la reproduction.
// Module pur, zéro dépendance — utilisable côté client comme côté serveur.
//
// Source des constantes : reverse-engineering communautaire par /u/mgxts
// (datamine des champs Combi_PassiveInheritNum / Combi_PassiveRandomAddNum de
// BP_PalGameSetting), repris tel quel par PalCalc (GameConstants.cs) et
// corroboré par Game8 / PalHatch — vérifié le 2026-07-23. Le jeu ayant évolué
// depuis (1.0+), ces valeurs restent une estimation communautaire.

/** Table dataminée (mgxts / PalCalc) : P(hériter exactement k passifs du pool
 *  parental U = union dédupliquée des passifs des deux parents), k = 0..4.
 *  Si k > |U|, l'enfant hérite tout U. Sous-ensemble choisi uniformément. */
export const INHERIT_COUNT_WEIGHTS = [0, 0.4, 0.3, 0.2, 0.1] as const;

/** P(ajouter exactement k passifs aléatoires après héritage), k = 0..3 —
 *  tronqué au cap global de 4. Documenté pour référence : les mutations ne
 *  délogent jamais un passif hérité, donc elles sont neutres pour
 *  P(enfant ⊇ D) quand D ⊆ U (seul cas calculé ici). */
export const RANDOM_ADD_WEIGHTS = [0.4, 0.3, 0.2, 0.1] as const;

/** Nombre maximal de passifs sur un Pal. */
export const MAX_PASSIVES = 4;

/** Coefficient binomial C(n, k), exact pour les petits n utilisés ici (n ≤ 8).
 *  Produit multiplicatif entier à chaque étape ; k < 0 ou k > n -> 0. */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Union dédupliquée des passifs des deux parents, ordre de première
 *  apparition préservé (a puis b). */
export function passiveUnion(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...a, ...b]) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/** P(l'enfant hérite au moins tous les passifs d'un sous-ensemble D du pool
 *  parental U), avec u = |U| et d = |D|.
 *
 *  P(⊇ D) = Σ_{k=d..4} w_k · C(u−d, min(k,u)−d) / C(u, min(k,u))
 *
 *  min(k, u) : si le tirage k dépasse la taille du pool, tout U est hérité.
 *  Cas limites : d = 0 -> 1 ; d > 4 (cap) ou d > u (D ⊄ U) -> 0.
 *  Non-objectif explicite : probabilité « ensemble exact » (interactions
 *  cap/mutations) — hors scope. */
export function pInheritSubset(unionSize: number, desiredSize: number): number {
  const u = unionSize;
  const d = desiredSize;
  if (d === 0) return 1;
  if (d > MAX_PASSIVES || d > u) return 0;
  let p = 0;
  for (let k = d; k <= MAX_PASSIVES; k++) {
    const m = Math.min(k, u); // nombre de passifs effectivement hérités
    p += (INHERIT_COUNT_WEIGHTS[k] * choose(u - d, m - d)) / choose(u, m);
  }
  return p;
}
