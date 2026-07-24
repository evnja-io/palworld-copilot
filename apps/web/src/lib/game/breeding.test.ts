import { describe, expect, it } from "vitest";
import breeding from "@palworld-companion/game-data/breeding.json";
import palsJson from "@palworld-companion/game-data/pals.json";
import { breedingPath, childOf, parentsOf, uniqueComboList } from "./breeding";

type Pal = { id: string; combiRank: number; combiPriority: number; ignoreCombi?: boolean };
type RawCombo = { parentA: string; parentB: string; child: string };
const pals = palsJson as Pal[];
const palIds = new Set(pals.map((p) => p.id));
const canonical = new Map(pals.map((p) => [p.id.toLowerCase(), p.id]));
const rawCombos = (breeding as { uniqueCombos: RawCombo[] }).uniqueCombos;

// ---------------------------------------------------------------------------
// Référence linéaire : copie de l'ancienne implémentation de childOf (scan
// complet), avec la même canonicalisation des combos uniques (dernier gagne),
// pour prouver l'équivalence exhaustive avec la recherche binaire.
// ---------------------------------------------------------------------------
const byIdRef = new Map(pals.map((p) => [p.id, p]));
const breedableRef = pals.filter((p) => !p.ignoreCombi);
const uniquesRef = new Map<string, string>();
for (const c of rawCombos) {
  const a = canonical.get(c.parentA.toLowerCase());
  const b = canonical.get(c.parentB.toLowerCase());
  const child = canonical.get(c.child.toLowerCase());
  if (!a || !b || !child) continue;
  uniquesRef.set([a, b].sort().join("|"), child);
}
const uniqueChildrenRef = new Set(uniquesRef.values());

function childOfLinear(aId: string, bId: string): string {
  if (aId === bId) return aId;
  const unique = uniquesRef.get([aId, bId].sort().join("|"));
  if (unique) return unique;
  const a = byIdRef.get(aId),
    b = byIdRef.get(bId);
  if (!a || !b) throw new Error(`Pal inconnu : ${aId} / ${bId}`);
  const target = Math.floor((a.combiRank + b.combiRank + 1) / 2);
  let best: Pal | null = null;
  for (const p of breedableRef) {
    if (uniqueChildrenRef.has(p.id)) continue;
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

describe("breeding", () => {
  it("A×A donne toujours A", () => {
    expect(childOf("Anubis", "Anubis")).toBe("Anubis");
  });
  it("respecte les combos uniques du jeu", () => {
    const combo = rawCombos[0];
    expect(childOf(combo.parentA, combo.parentB)).toBe(combo.child);
    expect(childOf(combo.parentB, combo.parentA)).toBe(combo.child); // symétrique
  });
  it("parentsOf retrouve des paires cohérentes", () => {
    const pairs = parentsOf("Anubis");
    expect(pairs.length).toBeGreaterThan(0);
    for (const [a, b] of pairs.slice(0, 10)) expect(childOf(a, b)).toBe("Anubis");
  });
  it("parentsOf ne renvoie jamais de paires dupliquées (variantes à combo unique)", () => {
    // Les variantes B ont un combo unique X×X→X en plus du vrai combo : les deux
    // boucles de parentsOf retrouvaient donc les mêmes paires deux fois.
    for (const id of ["KingAlpaca_Ice", "FlyingManta_Thunder", "Monkey_Fire"]) {
      const pairs = parentsOf(id, 30);
      const keys = pairs.map(([a, b]) => [a, b].sort().join("|"));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("canonicalise la casse des combos uniques (Blueplatypus → BluePlatypus)", () => {
    // breeding.json épelle « Blueplatypus » dans deux combos : sans
    // canonicalisation ces paires retombaient sur la règle du combiRank.
    expect(childOf("SakuraSaurus", "BluePlatypus")).toBe("SakuraSaurus_Water");
    expect(childOf("BluePlatypus", "SakuraSaurus")).toBe("SakuraSaurus_Water"); // symétrique
    expect(childOf("BluePlatypus", "LavaGirl")).toBe("BluePlatypus_Fire");
  });

  it("honore chaque combo brut dont les trois ids résolvent (insensible à la casse)", () => {
    // Certaines paires ont plusieurs enfants selon le genre des parents
    // (CatMage×FoxMage) : childOf doit renvoyer l'un des enfants possibles.
    const childrenByKey = new Map<string, Set<string>>();
    for (const c of rawCombos) {
      const a = canonical.get(c.parentA.toLowerCase());
      const b = canonical.get(c.parentB.toLowerCase());
      const child = canonical.get(c.child.toLowerCase());
      if (!a || !b || !child) continue;
      const key = [a, b].sort().join("|");
      (childrenByKey.get(key) ?? childrenByKey.set(key, new Set()).get(key)!).add(child);
      const got = childOf(a, b);
      expect(palIds.has(got)).toBe(true);
    }
    expect(childrenByKey.size).toBeGreaterThan(100);
    for (const [key, children] of childrenByKey) {
      const [a, b] = key.split("|") as [string, string];
      expect(children.has(childOf(a, b))).toBe(true);
      if (children.size === 1) expect(childOf(a, b)).toBe([...children][0]);
    }
  });

  it("childOf et parentsOf ne renvoient que des ids de pals.json", () => {
    const sample = pals.slice(0, 40).map((p) => p.id);
    for (let i = 0; i < sample.length; i++)
      for (let j = i; j < sample.length; j++)
        expect(palIds.has(childOf(sample[i], sample[j]))).toBe(true);
    for (const [a, b] of parentsOf("Anubis", 60)) {
      expect(palIds.has(a)).toBe(true);
      expect(palIds.has(b)).toBe(true);
    }
  });

  it("recherche binaire équivalente au scan linéaire sur toutes les paires", () => {
    const ids = pals.map((p) => p.id);
    const mismatches: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i; j < ids.length; j++) {
        const fast = childOf(ids[i], ids[j]);
        const slow = childOfLinear(ids[i], ids[j]);
        if (fast !== slow) mismatches.push(`${ids[i]}×${ids[j]} : ${fast} ≠ ${slow}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("uniqueComboList : canonique, dédupliqué, ids valides", () => {
    expect(uniqueComboList.length).toBeGreaterThan(100);
    const seen = new Set<string>();
    for (const c of uniqueComboList) {
      expect(palIds.has(c.parentA)).toBe(true);
      expect(palIds.has(c.parentB)).toBe(true);
      expect(palIds.has(c.child)).toBe(true);
      const key = `${[c.parentA, c.parentB].sort().join("|")}>${c.child}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("breedingPath", () => {
  it("cible déjà possédée → []", () => {
    expect(breedingPath(["SheepBall", "Anubis"], "Anubis")).toEqual([]);
  });

  it("trouve une chaîne valide de SheepBall+PinkCat vers Anubis", () => {
    const owned = ["SheepBall", "PinkCat"];
    // Avec les données réelles, Anubis (combiRank 480) n'est atteignable depuis
    // ces deux pals communs qu'au-delà de 6 tours (la règle de la moyenne des
    // rangs descend lentement) : maxDepth élargi pour ce cas extrême.
    const path = breedingPath(owned, "Anubis", 30);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
    // Chaque étape : childOf(parents) === enfant, parents disponibles
    // (possédés ou produits par une étape antérieure), profondeurs croissantes.
    const available = new Set(owned);
    let lastDepth = 0;
    for (const step of path!) {
      expect(childOf(step.parentA, step.parentB)).toBe(step.child);
      expect(available.has(step.parentA)).toBe(true);
      expect(available.has(step.parentB)).toBe(true);
      expect(step.depth).toBeGreaterThanOrEqual(lastDepth);
      lastDepth = step.depth;
      available.add(step.child);
    }
    expect(path![path!.length - 1].child).toBe("Anubis");
  });

  it("trouve une chaîne courte avec le maxDepth par défaut (PinkCat+IceHorse → Anubis)", () => {
    const owned = ["PinkCat", "IceHorse"];
    const path = breedingPath(owned, "Anubis");
    expect(path).not.toBeNull();
    const available = new Set(owned);
    for (const step of path!) {
      expect(childOf(step.parentA, step.parentB)).toBe(step.child);
      expect(available.has(step.parentA)).toBe(true);
      expect(available.has(step.parentB)).toBe(true);
      expect(step.depth).toBeLessThanOrEqual(6);
      available.add(step.child);
    }
    expect(path![path!.length - 1].child).toBe("Anubis");
  });

  it("cible inatteignable (JetDragon : ignoreCombi + combo self uniquement) → null", () => {
    expect(breedingPath(["SheepBall"], "JetDragon")).toBe(null);
  });

  it("ignore les espèces possédées inconnues de pals.json", () => {
    expect(breedingPath(["PasUnPal", "Anubis"], "Anubis")).toEqual([]);
    expect(breedingPath(["PasUnPal"], "Anubis")).toBe(null);
  });
});
