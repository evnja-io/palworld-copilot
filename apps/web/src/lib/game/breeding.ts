import palsJson from "@palworld-companion/game-data/pals.json";
import breedingJson from "@palworld-companion/game-data/breeding.json";

type Pal = { id: string; combiRank: number; combiPriority: number; ignoreCombi?: boolean };
const pals = palsJson as Pal[];
const byId = new Map(pals.map((p) => [p.id, p]));

// Pals éligibles comme enfant (règle du jeu : IgnoreCombi exclut).
const breedable = pals.filter((p) => !p.ignoreCombi);

const uniques = new Map<string, string>();
for (const c of (breedingJson as any).uniqueCombos as Array<{
  parentA: string;
  parentB: string;
  child: string;
}>) {
  uniques.set([c.parentA, c.parentB].sort().join("|"), c.child);
}
const uniqueChildren = new Set(uniques.values());

/** Enfant = combo unique, sinon pal élevable au combiRank le plus proche de
 *  floor((rA+rB+1)/2) (égalité -> combiPriority le plus bas). A×A -> A. */
export function childOf(aId: string, bId: string): string {
  if (aId === bId) return aId;
  const unique = uniques.get([aId, bId].sort().join("|"));
  if (unique) return unique;
  const a = byId.get(aId),
    b = byId.get(bId);
  if (!a || !b) throw new Error(`Pal inconnu : ${aId} / ${bId}`);
  const target = Math.floor((a.combiRank + b.combiRank + 1) / 2);
  let best: Pal | null = null;
  for (const p of breedable) {
    if (uniqueChildren.has(p.id)) continue; // atteignables uniquement via combo unique
    if (
      !best ||
      Math.abs(p.combiRank - target) < Math.abs(best.combiRank - target) ||
      (Math.abs(p.combiRank - target) === Math.abs(best.combiRank - target) &&
        p.combiPriority < best.combiPriority)
    )
      best = p;
  }
  return best!.id;
}

/** Paires de parents produisant childId (échantillon représentatif, borné). */
export function parentsOf(childId: string, limit = 50): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, child] of uniques)
    if (child === childId) out.push(key.split("|") as [string, string]);
  outer: for (let i = 0; i < pals.length; i++) {
    for (let j = i; j < pals.length; j++) {
      if (out.length >= limit) break outer;
      const a = pals[i].id,
        b = pals[j].id;
      if (childOf(a, b) === childId) out.push([a, b]);
    }
  }
  return out.slice(0, limit);
}
