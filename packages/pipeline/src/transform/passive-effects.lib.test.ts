import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadDataTableRows } from "../lib.js";
import { RAW_DIR } from "../paths.js";
import { parsePassiveRow, passiveValuesById } from "./passive-effects.lib.js";

const rowLegend = {
  Rank: 4,
  EffectType1: "EPalPassiveSkillEffectType::ShotAttack", EffectValue1: 20.0, TargetType1: "EPalPassiveSkillEffectTargetType::ToSelf",
  EffectType2: "EPalPassiveSkillEffectType::Defense",    EffectValue2: 20.0, TargetType2: "EPalPassiveSkillEffectTargetType::ToSelf",
  EffectType3: "EPalPassiveSkillEffectType::MoveSpeed",  EffectValue3: 20.0, TargetType3: "EPalPassiveSkillEffectTargetType::ToSelf",
  EffectType4: "EPalPassiveSkillEffectType::no",         EffectValue4: 0.0,  TargetType4: "EPalPassiveSkillEffectTargetType::None",
};

describe("parsePassiveRow", () => {
  it("déballe les effets non vides et déduplique les slots 'no'", () => {
    const p = parsePassiveRow(rowLegend);
    expect(p.rank).toBe(4);
    expect(p.effects).toEqual([
      { type: "ShotAttack", value: 20, target: "ToSelf" },
      { type: "Defense", value: 20, target: "ToSelf" },
      { type: "MoveSpeed", value: 20, target: "ToSelf" },
    ]);
    expect(p.values).toEqual([20, 20, 20, 0]);
  });
});

describe("passiveValuesById", () => {
  it("indexe les valeurs positionnelles par id", () => {
    expect(passiveValuesById({ Legend: rowLegend })).toEqual({ Legend: [20, 20, 20, 0] });
  });
});

describe.skipIf(!existsSync(RAW_DIR))("passifs (exports réels)", () => {
  it("couvre les IDs innés avec les bonnes valeurs", { timeout: 120_000 }, () => {
    const rows = loadDataTableRows(/DT_PassiveSkill_Main/);
    expect(Object.keys(rows).length).toBeGreaterThan(1000);
    const def = parsePassiveRow(rows["Deffence_up2_2"]);
    expect(def.effects[0]).toEqual({ type: "Defense", value: 20, target: "ToSelf" });
    expect(def.values[0]).toBe(20);
  });
});
