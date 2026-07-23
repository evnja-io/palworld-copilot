import { describe, expect, it } from "vitest";
import { sortByWorkLevel, workLabel } from "./work";

const mk = (id: string, work: Record<string, number>) => ({ id, work });

describe("sortByWorkLevel", () => {
  it("trie par niveau décroissant de l'aptitude choisie", () => {
    const pals = [mk("a", { Watering: 1 }), mk("b", { Watering: 4 }), mk("c", { Watering: 2 })];
    expect(sortByWorkLevel(pals, "Watering").map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("relègue les pals sans l'aptitude en fin de liste", () => {
    const pals = [mk("a", { EmitFlame: 2 }), mk("b", { Watering: 3 }), mk("c", { Watering: 1 })];
    expect(sortByWorkLevel(pals, "Watering").map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("préserve l'ordre d'origine (n° Paldex) à niveau égal", () => {
    const pals = [mk("a", { Mining: 2 }), mk("b", { Mining: 2 }), mk("c", { Mining: 3 })];
    expect(sortByWorkLevel(pals, "Mining").map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("sans aptitude sélectionnée, renvoie la liste telle quelle", () => {
    const pals = [mk("a", { Mining: 1 }), mk("b", { Mining: 3 })];
    expect(sortByWorkLevel(pals, "").map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("ne mute pas le tableau d'entrée", () => {
    const pals = [mk("a", { Cool: 1 }), mk("b", { Cool: 2 })];
    sortByWorkLevel(pals, "Cool");
    expect(pals.map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("workLabel", () => {
  it("libellés localisés FR/EN", () => {
    expect(workLabel("Seeding", "fr")).toBe("Semis");
    expect(workLabel("Seeding", "en")).toBe("Planting");
    expect(workLabel("Watering", "fr")).toBe("Arrosage");
  });

  it("retombe sur la clé brute si inconnue", () => {
    expect(workLabel("Unknown", "fr")).toBe("Unknown");
  });
});
