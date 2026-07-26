import { describe, expect, it } from "vitest";
import { bossLabel, inGameCoords } from "./coords";

describe("inGameCoords", () => {
  it("place le centre de la texture à (0, 0)", () => {
    expect(inGameCoords(4096, 4096)).toEqual([0, 0]);
  });

  it("convertit les coins comme le jeu (Y inversé)", () => {
    expect(inGameCoords(0, 0)).toEqual([-1000, 1000]);
    expect(inGameCoords(8192, 8192)).toEqual([1000, -1000]);
  });
});

describe("bossLabel", () => {
  it("retire le préfixe alpha_BOSS_ et remplace les underscores", () => {
    expect(bossLabel("alpha_BOSS_Believer_CrossBow")).toBe("Believer CrossBow");
  });

  it("retire aussi un simple préfixe alpha_ (sans BOSS_)", () => {
    expect(bossLabel("alpha_DarkTrader")).toBe("DarkTrader");
  });

  it("ne laisse pas d'espace superflu en fin de nom", () => {
    // Un SpawnerID peut se terminer par un underscore (variantes numérotées
    // comme "..._CrossBow_2" une fois le suffixe numérique retiré ailleurs) :
    // sans .trim(), le nom affiché porterait un espace final invisible.
    expect(bossLabel("alpha_BOSS_Believer_CrossBow_")).toBe("Believer CrossBow");
  });
});
