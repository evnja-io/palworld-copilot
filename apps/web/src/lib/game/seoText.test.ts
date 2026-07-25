import { describe, expect, it } from "vitest";
import {
  buildingSeoDescription,
  itemSeoDescription,
  metaText,
  palSeoDescription,
} from "./seoText";

describe("metaText", () => {
  it("aplatit les retours à la ligne des descriptions de jeu", () => {
    expect(metaText("Une ligne.\r\nUne autre.")).toBe("Une ligne. Une autre.");
    expect(metaText("  espaces   multiples  ")).toBe("espaces multiples");
  });

  it("tronque sur une frontière de mot au-delà de la longueur cible", () => {
    const long = "mot ".repeat(80).trim();
    const out = metaText(long);
    expect(out.length).toBeLessThanOrEqual(159);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("  ");
    // Pas de mot coupé en deux avant l'ellipse.
    expect(out.slice(0, -1).trimEnd().endsWith("mot")).toBe(true);
  });

  it("laisse un texte court intact", () => {
    expect(metaText("Court.")).toBe("Court.");
  });
});

describe("descriptions meta par entité", () => {
  it("utilise la description de jeu d'un pal", () => {
    const out = palSeoDescription("SheepBall");
    expect(out.length).toBeGreaterThan(25);
    expect(out).not.toContain("\r");
    expect(out).not.toContain("\n");
  });

  it("utilise la description de jeu d'un objet quand elle existe", () => {
    expect(itemSeoDescription("Wood").length).toBeGreaterThan(25);
  });

  it("retombe sur le gabarit quand la description n'est que le nom", () => {
    // item:AnimalSkin n'a pour « description » que « Animal Skin ».
    const out = itemSeoDescription("AnimalSkin");
    expect(out.length).toBeGreaterThan(25);
    expect(out).toMatch(/Palworld/);
  });

  it("compose la description d'une construction avec ses matériaux", () => {
    // Aucune construction n'a de description de jeu : les matériaux les
    // distinguent les unes des autres.
    const out = buildingSeoDescription("Altar");
    expect(out).toMatch(/100/);
    expect(out.length).toBeGreaterThan(25);
  });

  it("résout le nom d'une construction via mapObjectId, pas via id", () => {
    // CampFire (id) -> Campfire (mapObjectId) : sans ça le nom serait l'id brut.
    expect(buildingSeoDescription("CampFire")).toMatch(/Campfire/);
  });

  it("ne jette pas sur un id inconnu", () => {
    expect(() => buildingSeoDescription("PasUneConstruction")).not.toThrow();
    expect(() => itemSeoDescription("PasUnObjet")).not.toThrow();
    expect(() => palSeoDescription("PasUnPal")).not.toThrow();
  });
});
