import { describe, expect, it } from "vitest";
import {
  assertMarkerCounts,
  classifyBossSpawner,
  classifyFt,
  normalizeMarkers,
  TOWER_FT_IDS,
  type Marker,
} from "./markers.lib.js";

const mk = (id: string, type: Marker["type"], extra: Partial<Marker> = {}): Marker => ({
  id,
  type,
  px: 100,
  py: 200,
  ...extra,
});

describe("classifyFt", () => {
  it("classe les huit entrées de tours de boss", () => {
    expect(TOWER_FT_IDS.size).toBe(8);
    for (const id of TOWER_FT_IDS) expect(classifyFt(id)).toBe("tower");
  });

  it("classe les tours d'observation", () => {
    expect(classifyFt("WatchTower_1")).toBe("watchtower");
    expect(classifyFt("WatchTower_22")).toBe("watchtower");
  });

  it("laisse le reste en voyage rapide", () => {
    expect(classifyFt("FTPoint1")).toBe("ft");
    expect(classifyFt("SkyIsland_A")).toBe("ft");
    expect(classifyFt(undefined)).toBe("ft");
  });

  it("ne se fie pas au libellé : Boss_KingWhale n'est pas une tour", () => {
    expect(classifyFt("Boss_KingWhale")).toBe("ft");
  });
});

describe("classifyBossSpawner", () => {
  it("sépare les Pals des PNJ", () => {
    expect(classifyBossSpawner("Anubis")).toBe("alpha");
    expect(classifyBossSpawner("None")).toBe("boss");
    expect(classifyBossSpawner(undefined)).toBe("boss");
    expect(classifyBossSpawner("")).toBe("boss");
  });
});

describe("normalizeMarkers", () => {
  it("rend les ids uniques par suffixe numérique", () => {
    const out = normalizeMarkers([
      mk("alpha_BOSS_X", "alpha", { px: 1, py: 1, meta: { palId: "None" } }),
      mk("alpha_BOSS_X", "alpha", { px: 2, py: 2, meta: { palId: "None" } }),
      mk("alpha_BOSS_X", "alpha", { px: 3, py: 3, meta: { palId: "None" } }),
    ]);
    expect(out.map((m) => m.id)).toEqual(["alpha_BOSS_X", "alpha_BOSS_X_2", "alpha_BOSS_X_3"]);
  });

  it("évite un suffixe déjà pris", () => {
    const out = normalizeMarkers([
      mk("a", "relic", { px: 1, py: 1 }),
      mk("a", "relic", { px: 2, py: 2 }),
      mk("a_2", "relic", { px: 3, py: 3 }),
    ]);
    expect(new Set(out.map((m) => m.id)).size).toBe(3);
    expect(out.map((m) => m.id)).toContain("a_3");
  });

  it("reclasse les spawners PNJ en boss et garde les Pals en alpha", () => {
    const out = normalizeMarkers([
      mk("alpha_1", "alpha", { meta: { palId: "Anubis", level: 47 } }),
      mk("alpha_2", "alpha", { meta: { palId: "None", level: 23 } }),
    ]);
    expect(out.find((m) => m.id === "alpha_1")!.type).toBe("alpha");
    expect(out.find((m) => m.id === "alpha_2")!.type).toBe("boss");
  });

  it("reclasse les points de voyage rapide en tours", () => {
    const out = normalizeMarkers([
      mk("ft_a", "ft", { nameId: "FTPoint45" }),
      mk("ft_b", "ft", { nameId: "WatchTower_3" }),
      mk("ft_c", "ft", { nameId: "FTPoint1" }),
    ]);
    expect(out.map((m) => m.type)).toEqual(["tower", "watchtower", "ft"]);
  });

  it("est idempotent et déterministe", () => {
    const input = [
      mk("b", "ft", { nameId: "FTPoint45" }),
      mk("a", "alpha", { meta: { palId: "None" } }),
      mk("a", "alpha", { px: 9, py: 9, meta: { palId: "None" } }),
    ];
    const once = normalizeMarkers(input);
    const twice = normalizeMarkers(once);
    expect(twice).toEqual(once);
  });

  it("trie par id pour un diff stable", () => {
    const out = normalizeMarkers([mk("z", "relic"), mk("a", "relic")]);
    expect(out.map((m) => m.id)).toEqual(["a", "z"]);
  });
});

describe("assertMarkerCounts", () => {
  it("refuse un id dupliqué", () => {
    const dup = [mk("a", "relic"), mk("a", "relic")];
    expect(() => assertMarkerCounts(dup)).toThrow(/dupliqué/i);
  });

  it("refuse un nombre de tours inattendu", () => {
    const markers = [mk("t", "tower")];
    expect(() => assertMarkerCounts(markers)).toThrow(/tower/i);
  });
});
