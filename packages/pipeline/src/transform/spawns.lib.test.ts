import { describe, expect, it } from "vitest";
import {
  buildPalIdIndex,
  buildSpawns,
  clusterPoints,
  resolvePalId,
  type DistributionRow,
} from "./spawns.lib.js";

const index = buildPalIdIndex(["Anubis", "VolcanicMonster", "Alpaca"]);

describe("resolvePalId", () => {
  it("retire le préfixe BOSS_ quelle que soit sa casse", () => {
    expect(resolvePalId("BOSS_Anubis", index)).toBe("Anubis");
    expect(resolvePalId("Boss_Anubis", index)).toBe("Anubis");
  });

  it("résout une casse divergente", () => {
    expect(resolvePalId("Volcanicmonster", index)).toBe("VolcanicMonster");
  });

  it("laisse intact un id déjà exact", () => {
    expect(resolvePalId("Alpaca", index)).toBe("Alpaca");
  });

  it("renvoie null pour un id inconnu", () => {
    expect(resolvePalId("Inexistant", index)).toBeNull();
  });
});

describe("clusterPoints", () => {
  it("ne garde qu'un point par cellule de grille", () => {
    expect(clusterPoints([[0, 0], [1, 1], [100, 100]], 10)).toEqual([[0, 0], [100, 100]]);
  });

  it("préserve l'ordre d'entrée des représentants", () => {
    expect(clusterPoints([[100, 100], [0, 0]], 10)).toEqual([[100, 100], [0, 0]]);
  });

  it("accepte une liste vide", () => {
    expect(clusterPoints([], 10)).toEqual([]);
  });
});

// Le centre de la texture : worldToPixel(-375247, -18) === [4096, 4096].
const CENTER = { X: -375247, Y: -18 };
const row = (day: Array<{ X: number; Y: number }>, night: Array<{ X: number; Y: number }> = []): DistributionRow => ({
  dayTimeLocations: { Locations: day, Radius: 15000 },
  nightTimeLocations: { Locations: night, Radius: 15000 },
});

describe("buildSpawns", () => {
  it("projette les points et expose le rayon en pixels", () => {
    const { spawns } = buildSpawns({ Anubis: row([CENTER]) }, ["Anubis"]);
    expect(spawns.Anubis.day).toEqual([[4096, 4096]]);
    expect(spawns.Anubis.r).toBeCloseTo(84.74, 2);
  });

  it("sépare le jour et la nuit", () => {
    const { spawns } = buildSpawns({ Anubis: row([CENTER], [CENTER]) }, ["Anubis"]);
    expect(spawns.Anubis.day).toHaveLength(1);
    expect(spawns.Anubis.night).toHaveLength(1);
  });

  it("fusionne une clé BOSS_ dans l'espèce de base", () => {
    const far = { X: -375247, Y: 200_000 };
    const { spawns } = buildSpawns(
      { Anubis: row([CENTER]), BOSS_Anubis: row([far]) },
      ["Anubis"],
    );
    expect(spawns.Anubis.day).toHaveLength(2);
  });

  it("crée l'entrée même quand seule la clé BOSS_ existe", () => {
    const { spawns } = buildSpawns({ Boss_Anubis: row([CENTER]) }, ["Anubis"]);
    expect(spawns.Anubis.day).toEqual([[4096, 4096]]);
  });

  it("écarte et compte les points de l'Arbre-Monde", () => {
    const { spawns, treeSkipped } = buildSpawns(
      { Anubis: row([CENTER, { X: -375247, Y: 800_000 }]) },
      ["Anubis"],
    );
    expect(spawns.Anubis.day).toHaveLength(1);
    expect(treeSkipped).toBe(1);
  });

  it("signale les clés non résolues sans planter", () => {
    const { spawns, unresolved } = buildSpawns({ Inexistant: row([CENTER]) }, ["Anubis"]);
    expect(unresolved).toEqual(["Inexistant"]);
    expect(spawns).toEqual({});
  });

  it("n'émet aucune entrée pour un Pal sans point exploitable", () => {
    const { spawns } = buildSpawns({ Anubis: row([]) }, ["Anubis"]);
    expect(spawns.Anubis).toBeUndefined();
  });

  it("regroupe les points trop proches", () => {
    const near = { X: CENTER.X + 100, Y: CENTER.Y + 100 };
    const { spawns } = buildSpawns({ Anubis: row([CENTER, near]) }, ["Anubis"]);
    expect(spawns.Anubis.day).toHaveLength(1);
  });
});
