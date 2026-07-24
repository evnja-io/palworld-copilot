import { describe, expect, it } from "vitest";
import {
  INHERIT_COUNT_WEIGHTS,
  RANDOM_ADD_WEIGHTS,
  MAX_PASSIVES,
  choose,
  passiveUnion,
  pInheritSubset,
} from "./passives";

describe("constantes dataminées", () => {
  it("les tables de poids somment à 1 et le cap vaut 4", () => {
    expect(INHERIT_COUNT_WEIGHTS.reduce((s: number, w) => s + w, 0)).toBeCloseTo(1, 10);
    expect(RANDOM_ADD_WEIGHTS.reduce((s: number, w) => s + w, 0)).toBeCloseTo(1, 10);
    expect(MAX_PASSIVES).toBe(4);
  });
});

describe("choose", () => {
  it("cas limites exacts", () => {
    expect(choose(0, 0)).toBe(1);
    expect(choose(6, 2)).toBe(15);
    expect(choose(2, 3)).toBe(0);
  });
});

describe("passiveUnion", () => {
  it("dédoublonne et préserve l'ordre de première apparition", () => {
    expect(passiveUnion(["Swift", "Brave"], ["Brave", "Legend", "Swift"])).toEqual([
      "Swift",
      "Brave",
      "Legend",
    ]);
    expect(passiveUnion([], [])).toEqual([]);
    expect(passiveUnion(["A"], [])).toEqual(["A"]);
  });
});

describe("pInheritSubset - valeurs connues", () => {
  const cases: Array<[number, number, number]> = [
    [1, 1, 1.0],
    [2, 1, 0.8],
    [2, 2, 0.6],
    [3, 3, 0.3],
    [4, 4, 0.1],
    [4, 1, 0.5],
    [5, 1, 0.4],
    [6, 2, 0.1],
  ];
  for (const [u, d, expected] of cases) {
    it(`(u=${u}, d=${d}) = ${expected}`, () => {
      expect(pInheritSubset(u, d)).toBeCloseTo(expected, 10);
    });
  }

  it("(u, 0) = 1 pour u de 0 à 6", () => {
    for (let u = 0; u <= 6; u++) expect(pInheritSubset(u, 0)).toBe(1);
  });

  it("d > u ou d > cap -> 0", () => {
    expect(pInheritSubset(3, 4)).toBe(0); // D ⊄ U
    expect(pInheritSubset(2, 3)).toBe(0); // D ⊄ U
    expect(pInheritSubset(6, 5)).toBe(0); // d > cap de 4
  });
});

describe("pInheritSubset - cohérence avec la table de poids", () => {
  it("u = d -> somme exacte des poids w_k pour k >= d", () => {
    for (let d = 1; d <= 4; d++) {
      let expected = 0;
      for (let k = d; k <= 4; k++) expected += INHERIT_COUNT_WEIGHTS[k];
      // Ratios binomiaux tous égaux à 1 -> l'égalité stricte doit tenir.
      expect(pInheritSubset(d, d)).toBe(expected);
    }
  });

  it("strictement décroissant en u à d fixé (d = 1..4, u = d..8)", () => {
    for (let d = 1; d <= 4; d++) {
      for (let u = d; u < 8; u++) {
        expect(pInheritSubset(u + 1, d)).toBeLessThan(pInheritSubset(u, d));
      }
    }
  });
});
