import { describe, expect, it } from "vitest";
import descFr from "@palworld-companion/game-data/l10n/descriptions.fr.json";
import descEn from "@palworld-companion/game-data/l10n/descriptions.en.json";
import { resolveGameMarkup } from "./names";

describe("resolveGameMarkup", () => {
  it("ne laisse aucun balisage de jeu dans les descriptions FR et EN", () => {
    for (const [loc, table] of [
      ["fr", descFr],
      ["en", descEn],
    ] as const) {
      const leftovers = Object.entries(table as Record<string, string>)
        .map(([k, v]) => [k, resolveGameMarkup(v, loc)] as const)
        .filter(([, v]) => /<[a-zA-Z]+ id=/.test(v));
      expect(leftovers.slice(0, 5), `balisage résiduel en ${loc}`).toEqual([]);
    }
  });

  it("résout les noms de Pal et de compétence", () => {
    expect(resolveGameMarkup("Le <characterName id=|SheepBall|/> dort.", "fr")).toBe(
      "Le Lamball dort."
    );
    expect(resolveGameMarkup("<activeSkillName id=|AquaJet|/> !", "fr")).not.toContain("<");
  });

  it("résout élément, aptitude et rareté", () => {
    expect(resolveGameMarkup("<uiCommon id=|COMMON_ELEMENT_NAME_Fire|/>", "fr")).toBe("Feu");
    expect(resolveGameMarkup("<uiCommon id=|RARITY_EPIC|/>", "fr")).toBe("Épique");
    expect(resolveGameMarkup("<uiCommon id=|COMMON_WORK_SUITABILITY_Mining|/>", "fr")).toBe(
      "Minage"
    );
  });

  it("accepte la forme avec style= et retire les icônes sans asset", () => {
    expect(
      resolveGameMarkup("Dégâts <uiCommon id=|COMMON_ELEMENT_NAME_Fire| style=|Elem_Fire|/>.", "fr")
    ).toBe("Dégâts Feu.");
    // L'espace laissé par l'icône retirée ne doit pas décoller la ponctuation.
    expect(resolveGameMarkup("Type <img id=|ElemIcon_Fire|/> .", "fr")).toBe("Type.");
  });

  it("laisse intact un texte sans balisage", () => {
    expect(resolveGameMarkup("Un texte normal, avec ponctuation.", "fr")).toBe(
      "Un texte normal, avec ponctuation."
    );
  });
});
