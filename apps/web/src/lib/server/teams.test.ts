import { describe, expect, it } from "vitest";
import { validateTeamInput } from "./teams";

const slot = (over: Record<string, unknown> = {}) => ({
  palId: "Anubis",
  passives: ["AccuracyDecrease"],
  actives: ["AirCanon"],
  ...over,
});
const valid = (over: Record<string, unknown> = {}) => ({
  name: "Boss rush",
  notes: "anti Jetragon",
  slots: [slot(), null],
  ...over,
});

// error(400) de @sveltejs/kit lance un HttpError { status, body }.
const rejects = (raw: unknown) => {
  try {
    validateTeamInput(raw);
  } catch (e) {
    expect((e as { status?: number }).status).toBe(400);
    return;
  }
  throw new Error("validateTeamInput aurait dû rejeter");
};

describe("validateTeamInput", () => {
  it("accepte une équipe valide et normalise à 5 slots", () => {
    const t = validateTeamInput(valid());
    expect(t.name).toBe("Boss rush");
    expect(t.slots).toHaveLength(5);
    expect(t.slots[0]).toEqual(slot());
    expect(t.slots.slice(1)).toEqual([null, null, null, null]);
  });

  it("trim le nom, rejette vide / trop long / mauvais types", () => {
    expect(validateTeamInput(valid({ name: "  ok  " })).name).toBe("ok");
    rejects(valid({ name: "   " }));
    rejects(valid({ name: "x".repeat(81) }));
    rejects(valid({ name: 42 }));
    rejects(valid({ notes: "x".repeat(2001) }));
    rejects(valid({ notes: 42 }));
    rejects(null);
    rejects("nope");
  });

  it("rejette les slots invalides", () => {
    rejects(valid({ slots: "nope" }));
    rejects(valid({ slots: [slot(), slot(), slot(), slot(), slot(), slot()] })); // > 5
    rejects(valid({ slots: [slot({ palId: "NotAPal" })] }));
    rejects(valid({ slots: [slot({ palId: 42 })] }));
    rejects(valid({ slots: [{ ...slot(), extra: true }] })); // clé en trop
    // Sonde proto : côté API le payload passe par JSON.parse, qui crée une clé
    // PROPRE "__proto__" (le setter n'est pas invoqué) → rejet par le comptage
    // de clés. (Un littéral { __proto__: … } réglerait le prototype, que le
    // spread ne copie pas — la sonde serait neutralisée.)
    rejects(
      valid({
        slots: [
          JSON.parse(
            '{"palId":"Anubis","passives":["AccuracyDecrease"],"actives":["AirCanon"],"__proto__":{"polluted":true}}',
          ),
        ],
      }),
    );
  });

  it("rejette les passifs invalides", () => {
    rejects(valid({ slots: [slot({ passives: ["NotAPassive"] })] }));
    rejects(valid({ slots: [slot({ passives: ["AccuracyDecrease", "AccuracyDecrease"] })] })); // doublon
    rejects(
      valid({
        slots: [
          slot({
            passives: [
              "AccuracyDecrease",
              "AccuracyIncrease",
              "Attack_ACC_up1",
              "Defense_ACC_up1_Otomo_Only_Equip",
              "CraftSpeed_up1",
            ],
          }),
        ],
      }),
    ); // > 4 (ids réels de passive-effects.json)
    rejects(valid({ slots: [slot({ passives: "AccuracyDecrease" })] }));
  });

  it("rejette les actifs invalides (partner skill, junk, doublon, > 3)", () => {
    rejects(valid({ slots: [slot({ actives: ["BlueThunderHorse_PartnerSkill"] })] }));
    rejects(valid({ slots: [slot({ actives: ["Human_Rolling"] })] }));
    rejects(valid({ slots: [slot({ actives: ["AirCanon", "AirCanon"] })] }));
    rejects(valid({ slots: [slot({ actives: ["AirCanon", "AirBlade", "AquaJet", "AcidRain"] })] }));
  });
});
