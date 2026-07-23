import { describe, expect, it } from "vitest";
import { suggestTokens, tokenLabel, type Token } from "./tokens";

describe("suggestTokens", () => {
  it("suggère l'élément Feu depuis « feu » (FR)", () => {
    const tokens = suggestTokens("feu");
    expect(tokens).toContainEqual({ kind: "element", value: "Fire" });
  });

  it("matche aussi les libellés EN et les diacritiques", () => {
    expect(suggestTokens("fire")).toContainEqual({ kind: "element", value: "Fire" });
    expect(suggestTokens("electricite")).toContainEqual({
      kind: "element",
      value: "Electricity",
    });
  });

  it("interprète un nombre final comme niveau minimum d'aptitude", () => {
    const tokens = suggestTokens("embrasement 2");
    expect(tokens).toContainEqual({ kind: "work", value: "EmitFlame", min: 2 });
  });

  it("matche au début de n'importe quel mot du libellé", () => {
    expect(suggestTokens("rapide")).toContainEqual({ kind: "marker", value: "ft" });
  });

  it("exclut les tokens déjà actifs et ignore les textes trop courts", () => {
    const active: Token[] = [{ kind: "element", value: "Fire" }];
    expect(suggestTokens("feu", active)).not.toContainEqual({ kind: "element", value: "Fire" });
    expect(suggestTokens("f")).toEqual([]);
  });
});

describe("tokenLabel", () => {
  it("localise selon la langue et affiche le niveau minimum", () => {
    expect(tokenLabel({ kind: "element", value: "Leaf" }, "fr")).toBe("Plante");
    expect(tokenLabel({ kind: "element", value: "Leaf" }, "en")).toBe("Grass");
    expect(tokenLabel({ kind: "work", value: "Mining", min: 3 }, "fr")).toBe("Minage 3+");
    expect(tokenLabel({ kind: "work", value: "Mining", min: 1 }, "fr")).toBe("Minage");
  });

  it("affiche le libellé embarqué des tokens passifs", () => {
    expect(tokenLabel({ kind: "passive", value: "Legend", label: "Légende" }, "fr")).toBe(
      "Légende",
    );
  });
});
