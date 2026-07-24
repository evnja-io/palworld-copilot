import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enumName, l10nMap, loadDataTableRows, pick, resolveEffectPlaceholders, stripRichTags } from "./lib.js";
import { RAW_DIR } from "./paths.js";

// Premier accès : walk de /mnt/c (lent sous WSL) - timeout large.
describe.skipIf(!existsSync(RAW_DIR))("lib (exports réels)", () => {
  it("fusionne les variantes _Common", { timeout: 120_000 }, () => {
    const rows = loadDataTableRows(/DT_PalMonsterParameter/);
    expect(Object.keys(rows).length).toBeGreaterThan(700);
  });
  it("l10nMap applique la décision Phase 0", { timeout: 120_000 }, () => {
    const names = l10nMap(/\/en\/.*DT_PalNameText/, "PAL_NAME_");
    expect(Object.keys(names).length).toBeGreaterThan(250);
    expect(names["Anubis"]).toBe("Anubis");
  });
});

describe("helpers purs", () => {
  it("pick prend le premier champ présent", () => {
    expect(pick({ B: 2 }, "A", "B")).toBe(2);
    expect(pick({}, "A")).toBeUndefined();
  });
  it("enumName déballe les enums UE", () => {
    expect(enumName("EPalElementType::Fire")).toBe("Fire");
    expect(enumName("Fire")).toBe("Fire");
  });
  it("stripRichTags retire les balises en gardant le texte", () => {
    expect(stripRichTags("Hunger <NumRed_13>+10.0%</> faster")).toBe("Hunger +10.0% faster");
    expect(stripRichTags("plain")).toBe("plain");
  });
  it("resolveEffectPlaceholders substitue les valeurs positionnelles", () => {
    expect(resolveEffectPlaceholders("Defense +{EffectValue1}%", [20])).toBe("Defense +20%");
    expect(resolveEffectPlaceholders("{EffectValue1}/{EffectValue2}", [5, 30])).toBe("5/30");
  });
  it("resolveEffectPlaceholders laisse le token si la valeur manque", () => {
    expect(resolveEffectPlaceholders("x{EffectValue2}", [5])).toBe("x{EffectValue2}");
  });
});
