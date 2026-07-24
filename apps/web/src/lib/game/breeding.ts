import palsJson from "@palworld-companion/game-data/pals.json";
import breedingJson from "@palworld-companion/game-data/breeding.json";

type Pal = { id: string; combiRank: number; combiPriority: number; ignoreCombi?: boolean };
const pals = palsJson as Pal[];
const byId = new Map(pals.map((p) => [p.id, p]));

// Pals éligibles comme enfant (règle du jeu : IgnoreCombi exclut).
const breedable = pals.filter((p) => !p.ignoreCombi);

// Canonicalisation : les DataTables du jeu divergent parfois en casse
// (« Blueplatypus » dans DT_PalCombiUnique vs id « BluePlatypus » dans pals.json).
// On résout chaque id de combo unique contre pals.json, insensible à la casse,
// et on ignore les combos dont un id ne résout pas (pals filtrés/événementiels).
const canonical = new Map(pals.map((p) => [p.id.toLowerCase(), p.id]));

const uniques = new Map<string, string>();
const comboList: Array<{ parentA: string; parentB: string; child: string }> = [];
const comboSeen = new Set<string>();
for (const c of (breedingJson as { uniqueCombos: Array<{ parentA: string; parentB: string; child: string }> })
  .uniqueCombos) {
  const parentA = canonical.get(c.parentA.toLowerCase());
  const parentB = canonical.get(c.parentB.toLowerCase());
  const child = canonical.get(c.child.toLowerCase());
  if (!parentA || !parentB || !child) continue;
  const key = [parentA, parentB].sort().join("|");
  // Certaines paires ont deux enfants selon le genre des parents (CatMage×FoxMage) :
  // comme l'implémentation d'origine, la dernière entrée du fichier gagne dans la map.
  uniques.set(key, child);
  const comboKey = `${key}>${child}`;
  if (!comboSeen.has(comboKey)) {
    comboSeen.add(comboKey);
    comboList.push({ parentA, parentB, child });
  }
}
const uniqueChildren = new Set(uniques.values());

/** Combos uniques canonicalisés (ids pals.json), dédupliqués par clé de parents
 *  triée + enfant, dans l'ordre stable du fichier source - pour l'index UI. */
export const uniqueComboList: ReadonlyArray<{ parentA: string; parentB: string; child: string }> =
  comboList;

// Tableau trié par combiRank pour la recherche binaire de childOf : pals
// élevables hors enfants de combos uniques (atteignables uniquement via combo).
const rankSorted = breedable
  .filter((p) => !uniqueChildren.has(p.id))
  .slice()
  .sort((x, y) => x.combiRank - y.combiRank);

/** Enfant = combo unique, sinon pal élevable au combiRank le plus proche de
 *  floor((rA+rB+1)/2) (égalité -> combiPriority le plus bas). A×A -> A.
 *  O(log n) : recherche binaire du rang cible puis comparaison des voisins. */
export function childOf(aId: string, bId: string): string {
  if (aId === bId) return aId;
  const unique = uniques.get([aId, bId].sort().join("|"));
  if (unique) return unique;
  const a = byId.get(aId),
    b = byId.get(bId);
  if (!a || !b) throw new Error(`Pal inconnu : ${aId} / ${bId}`);
  const target = Math.floor((a.combiRank + b.combiRank + 1) / 2);
  // Premier index dont le combiRank >= target (borne inférieure).
  let lo = 0,
    hi = rankSorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rankSorted[mid].combiRank < target) lo = mid + 1;
    else hi = mid;
  }
  // Candidats : le bloc de rang juste >= target et le bloc juste < target
  // (blocs entiers car plusieurs pals peuvent partager le même combiRank).
  let best: Pal | null = null;
  const consider = (p: Pal) => {
    if (
      !best ||
      Math.abs(p.combiRank - target) < Math.abs(best.combiRank - target) ||
      (Math.abs(p.combiRank - target) === Math.abs(best.combiRank - target) &&
        p.combiPriority < best.combiPriority)
    )
      best = p;
  };
  if (lo < rankSorted.length) {
    const r = rankSorted[lo].combiRank;
    for (let i = lo; i < rankSorted.length && rankSorted[i].combiRank === r; i++)
      consider(rankSorted[i]);
  }
  if (lo > 0) {
    const r = rankSorted[lo - 1].combiRank;
    for (let i = lo - 1; i >= 0 && rankSorted[i].combiRank === r; i--) consider(rankSorted[i]);
  }
  return best!.id;
}

/** Paires de parents produisant childId (échantillon représentatif, borné). */
export function parentsOf(childId: string, limit = 50): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  // Les variantes ont un combo unique X×X→X en plus du vrai combo : la boucle
  // brute retrouve les mêmes paires via childOf, d'où la déduplication par clé triée.
  const seen = new Set<string>();
  const add = (a: string, b: string) => {
    const key = [a, b].sort().join("|");
    if (!seen.has(key)) {
      seen.add(key);
      out.push([a, b]);
    }
  };
  for (const [key, child] of uniques)
    if (child === childId) add(...(key.split("|") as [string, string]));
  outer: for (let i = 0; i < pals.length; i++) {
    for (let j = i; j < pals.length; j++) {
      if (out.length >= limit) break outer;
      const a = pals[i].id,
        b = pals[j].id;
      if (childOf(a, b) === childId) add(a, b);
    }
  }
  return out.slice(0, limit);
}

export type BreedStep = { child: string; parentA: string; parentB: string; depth: number };

/** Chemin d'élevage le plus court (en tours) des espèces possédées vers targetId.
 *  BFS en couches sur l'espace des espèces : chaque tour n'évalue que les paires
 *  touchant la frontière du tour précédent (ancien×nouveau + nouveau×nouveau une
 *  seule fois par clé triée) - la première découverte fixe donc la profondeur
 *  minimale. Genre ignoré (hypothèse : les deux sexes d'une espèce obtenables).
 *  Retourne [] si la cible est déjà possédée, null si inatteignable en maxDepth. */
export function breedingPath(
  ownedSpecies: Iterable<string>,
  targetId: string,
  maxDepth = 6,
): BreedStep[] | null {
  const owned = new Set<string>();
  for (const id of ownedSpecies) if (byId.has(id)) owned.add(id);
  if (owned.has(targetId)) return [];
  if (!byId.has(targetId)) return null; // cible hors pals.json : inatteignable

  const via = new Map<string, [string, string]>();
  const depthOf = new Map<string, number>();
  const known = new Set(owned);
  let frontier = [...owned];

  for (let r = 1; r <= maxDepth && frontier.length > 0; r++) {
    const discovered = new Map<string, [string, string]>();
    const evalPair = (a: string, b: string) => {
      const c = childOf(a, b);
      // Première découverte d'une espèce : on mémorise la paire témoin.
      if (!known.has(c) && !discovered.has(c)) discovered.set(c, [a, b]);
    };
    const frontierSet = new Set(frontier);
    // Ancien × nouveau (les paires ancien×ancien ont été évaluées aux tours précédents).
    for (const b of frontier) {
      for (const a of known) {
        if (frontierSet.has(a)) continue; // traité ci-dessous en nouveau×nouveau
        evalPair(a, b);
      }
    }
    // Nouveau × nouveau, une seule fois par clé triée.
    for (let i = 0; i < frontier.length; i++)
      for (let j = i; j < frontier.length; j++) evalPair(frontier[i], frontier[j]);

    for (const [c, pair] of discovered) {
      via.set(c, pair);
      depthOf.set(c, r);
      known.add(c);
    }
    if (via.has(targetId)) break; // couche minimale atteinte
    frontier = [...discovered.keys()];
  }

  if (!via.has(targetId)) return null;

  // Reconstruction de la chaîne témoin : parents avant enfant, déduplication
  // par enfant, tri final par profondeur croissante.
  const steps: BreedStep[] = [];
  const emitted = new Set<string>();
  const emit = (child: string) => {
    if (emitted.has(child)) return;
    const pair = via.get(child);
    if (!pair) return; // espèce possédée : feuille
    emitted.add(child);
    emit(pair[0]);
    emit(pair[1]);
    steps.push({ child, parentA: pair[0], parentB: pair[1], depth: depthOf.get(child)! });
  };
  emit(targetId);
  steps.sort((x, y) => x.depth - y.depth);
  return steps;
}
