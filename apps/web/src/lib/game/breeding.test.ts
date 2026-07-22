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
});
