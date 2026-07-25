import { describe, expect, it } from "vitest";
import { radiusToPx, worldToGame, worldToPixel } from "./coord.js";

describe("worldToGame", () => {
  it("place l'origine in-game au centre des translations", () => {
    expect(worldToGame(-375247, -18)).toEqual([0, 0]);
  });
});

describe("worldToPixel", () => {
  it("projette l'origine in-game au centre de la texture", () => {
    expect(worldToPixel(-375247, -18)).toEqual([4096, 4096]);
  });

  it("écarte les points hors de la plage in-game (Arbre-Monde)", () => {
    expect(worldToPixel(-375247, 800_000)).toBeNull();
  });

  it("arrondit à une décimale", () => {
    const pt = worldToPixel(-375247, 1234)!;
    expect(pt[0]).toBe(Math.round(pt[0] * 10) / 10);
  });
});

describe("radiusToPx", () => {
  it("convertit le rayon de spawn du jeu en pixels de texture", () => {
    // 15000 / 725 unités in-game, sur 2000 unités pour 8192 px
    expect(radiusToPx(15000)).toBeCloseTo(84.74, 2);
  });
});
