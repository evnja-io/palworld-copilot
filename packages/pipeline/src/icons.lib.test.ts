import { describe, expect, it } from "vitest";
import { caseAliases } from "./icons.lib.js";

describe("caseAliases", () => {
  it("aliase un id dont seule la casse diverge du fichier généré", () => {
    const present = { "pal:Volcanicmonster": true, "pal:Anubis": true };
    expect(caseAliases(present, "pal:", ["VolcanicMonster", "Anubis"])).toEqual({
      "pal:VolcanicMonster": "Volcanicmonster",
    });
  });

  it("ignore les ids déjà présents à la casse exacte", () => {
    expect(caseAliases({ "pal:Anubis": true }, "pal:", ["Anubis"])).toEqual({});
  });

  it("ignore les ids sans fichier correspondant", () => {
    expect(caseAliases({ "pal:Anubis": true }, "pal:", ["Inexistant"])).toEqual({});
  });

  it("ne se contredit pas quand la valeur existante est déjà un alias", () => {
    const present = { "pal:KingAlpaca_ice": "KingAlpaca_ice" };
    expect(caseAliases(present, "pal:", ["KingAlpaca_Ice"])).toEqual({
      "pal:KingAlpaca_Ice": "KingAlpaca_ice",
    });
  });
});
