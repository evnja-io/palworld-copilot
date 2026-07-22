import { describe, expect, it } from "vitest";
import breeding from "@palworld-companion/game-data/breeding.json";
import { childOf, parentsOf } from "./breeding";

describe("breeding", () => {
  it("A×A donne toujours A", () => {
    expect(childOf("Anubis", "Anubis")).toBe("Anubis");
  });
  it("respecte les combos uniques du jeu", () => {
    const combo = (breeding as any).uniqueCombos[0];
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
});
