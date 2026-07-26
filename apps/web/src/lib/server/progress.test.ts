import { describe, expect, it } from "vitest";
import markers from "@palworld-companion/game-data/markers.json";
import { isValidEntity, isValidKind } from "./progress";

const byType = (t: string) =>
  (markers as Array<{ id: string; type: string }>).filter((mk) => mk.type === t);

describe("registre de progression", () => {
  it("accepte les trois kinds", () => {
    expect(isValidKind("pal_caught")).toBe(true);
    expect(isValidKind("tech_unlocked")).toBe(true);
    expect(isValidKind("marker")).toBe(true);
    expect(isValidKind("nope")).toBe(false);
  });

  it("isValidKind ne connaît que les kinds du registre", () => {
    // Un kind qui existe sur tout objet JS (hérité du prototype) ne doit pas
    // être confondu avec une clé propre du registre.
    expect(isValidKind("constructor")).toBe(false);
  });

  it("accepte un pal connu pour pal_caught, refuse le reste", () => {
    expect(isValidEntity("pal_caught", "Anubis")).toBe(true);
    expect(isValidEntity("pal_caught", "NotAPal")).toBe(false);
  });

  it("accepte une techno connue pour tech_unlocked, refuse le reste", () => {
    expect(isValidEntity("tech_unlocked", "Workbench")).toBe(true);
    expect(isValidEntity("tech_unlocked", "NotATech")).toBe(false);
  });

  it("refuse un kind hérité du prototype (__proto__)", () => {
    // Object.prototype.hasOwnProperty protège REGISTRY : un kind qui existe
    // sur tout objet JS ne doit renvoyer valide pour aucune entité.
    expect(isValidEntity("__proto__", "Anubis")).toBe(false);
  });

  it("accepte un id de chaque catégorie de marqueur", () => {
    for (const type of ["relic", "alpha", "boss", "tower", "watchtower", "ft"]) {
      const sample = byType(type)[0];
      expect(sample, `aucun marqueur de type ${type}`).toBeDefined();
      expect(isValidEntity("marker", sample.id), type).toBe(true);
    }
  });

  it("refuse un id inconnu", () => {
    expect(isValidEntity("marker", "relic_inexistant")).toBe(false);
  });
});
