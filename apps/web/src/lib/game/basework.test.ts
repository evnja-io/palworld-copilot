// Tests du moteur offre/demande des bases. Valeurs attendues calculées à la
// main depuis les données réelles de game-data :
// - pals.json : SheepBall {Handcraft:1, MonsterFarm:1, Transport:1},
//   PinkLizard {Handcraft:3, Mining:2, ProductMedicine:3, Transport:2},
//   Anubis {Handcraft:6, Mining:6, Transport:4}, Ganesha {Watering:1},
//   Boar {Mining:1}, WizardOwl {Collection:1}, NightFox {Collection:1},
//   ChickenPal {Collection:1, MonsterFarm:1}, KingAlpaca {Collection:2}.
// - passive-effects.json : CraftSpeed_up2 +50, CraftSpeed_down1 -10,
//   CraftSpeed_down2 -30, Noukin -50, PAL_rude -10, PAL_SpiritualInst -10,
//   TrainerWorkSpeed_UP_1 +25 (cible ToTrainer, donc exclu),
//   WorkSuitabilityAddRank_MonsterFarm_1 +1, WorkSuitabilityAddRank_MonsterFarm_2 +2.
import { describe, expect, it } from "vitest";
import {
  WORK_KEYS,
  UNIT_SUPPLY,
  DEFAULT_SLOT_COUNT,
  craftSpeedMultiplier,
  effectiveWork,
  supplyVector,
  normalizeDemands,
  baseStatus,
  recommend,
  type Candidate,
  type WorkKey,
  type WorkVector,
} from "./basework";

/** Vecteur complet à partir des clés non nulles. */
const vec = (over: Partial<WorkVector> = {}): WorkVector => {
  const out = {} as WorkVector;
  for (const k of WORK_KEYS) out[k] = over[k] ?? 0;
  return out;
};

/** Profil de demande complet, clés absentes = 0 (contrairement à normalizeDemands). */
const D = (over: Partial<Record<WorkKey, number>> = {}): Record<WorkKey, number> => {
  const out = {} as Record<WorkKey, number>;
  for (const k of WORK_KEYS) out[k] = over[k] ?? 0;
  return out;
};

const cand = (instanceId: string, palId: string, passives: string[] = []): Candidate => ({
  instanceId,
  palId,
  passives,
  ownerGuid: "OWNER",
  level: 1,
  nickname: null,
});

describe("constantes", () => {
  it("12 types de travail dans l'ordre attendu, heuristiques documentées", () => {
    expect(WORK_KEYS).toEqual([
      "Handcraft",
      "MonsterFarm",
      "Transport",
      "Collection",
      "Mining",
      "Deforest",
      "ProductMedicine",
      "Seeding",
      "Watering",
      "EmitFlame",
      "GenerateElectricity",
      "Cool",
    ]);
    expect(UNIT_SUPPLY).toBe(3);
    expect(DEFAULT_SLOT_COUNT).toBe(15);
  });
});

describe("craftSpeedMultiplier", () => {
  it("1 sans passif, somme des CraftSpeed ToSelf sinon", () => {
    expect(craftSpeedMultiplier([])).toBe(1);
    expect(craftSpeedMultiplier(["CraftSpeed_up2"])).toBe(1.5);
    expect(craftSpeedMultiplier(["CraftSpeed_down2", "CraftSpeed_down1"])).toBeCloseTo(0.6, 10);
  });

  it("clampe à 0 quand la somme passe sous -100", () => {
    // -50 - 30 - 10 - 10 - 10 = -110 -> max(0, 1 - 1.1) = 0
    expect(
      craftSpeedMultiplier([
        "Noukin",
        "CraftSpeed_down2",
        "CraftSpeed_down1",
        "PAL_rude",
        "PAL_SpiritualInst",
      ]),
    ).toBe(0);
  });

  it("ignore les effets non ToSelf et les passifs inconnus", () => {
    expect(craftSpeedMultiplier(["TrainerWorkSpeed_UP_1"])).toBe(1); // cible ToTrainer
    expect(craftSpeedMultiplier(["PassifInexistant"])).toBe(1);
  });
});

describe("effectiveWork", () => {
  it("rang 3 + CraftSpeed_up2 (+50) -> 4.5", () => {
    expect(effectiveWork("PinkLizard", ["CraftSpeed_up2"])).toEqual(
      vec({ Handcraft: 4.5, Mining: 3, ProductMedicine: 4.5, Transport: 3 }),
    );
  });

  it("rang 1 + CraftSpeed_down2 + CraftSpeed_down1 -> 0.6 ; MonsterFarm insensible au CraftSpeed", () => {
    const p = effectiveWork("SheepBall", ["CraftSpeed_down2", "CraftSpeed_down1"]);
    expect(p.Handcraft).toBeCloseTo(0.6, 10);
    expect(p.Transport).toBeCloseTo(0.6, 10);
    expect(p.MonsterFarm).toBe(1); // le ranch ignore le multiplicateur
  });

  it("multiplicateur clampé à 0 : travaux hors ranch annulés, ranch intact", () => {
    const p = effectiveWork("SheepBall", [
      "Noukin",
      "CraftSpeed_down2",
      "CraftSpeed_down1",
      "PAL_rude",
      "PAL_SpiritualInst",
    ]);
    expect(p.Handcraft).toBe(0);
    expect(p.Transport).toBe(0);
    expect(p.MonsterFarm).toBe(1);
  });

  it("palId inconnu -> vecteur nul", () => {
    expect(effectiveWork("EspeceInconnue", ["CraftSpeed_up2"])).toEqual(vec());
  });

  it("MonsterFarm = rang inné + AddRank, CraftSpeed ignoré", () => {
    const p = effectiveWork("SheepBall", ["WorkSuitabilityAddRank_MonsterFarm_1", "CraftSpeed_up2"]);
    expect(p.MonsterFarm).toBe(2); // 1 inné + 1 AddRank, pas de x1.5
    expect(p.Handcraft).toBe(1.5); // le CraftSpeed s'applique ailleurs
    expect(
      effectiveWork("SheepBall", ["WorkSuitabilityAddRank_MonsterFarm_2"]).MonsterFarm,
    ).toBe(3);
  });

  it("AddRank ignoré sans aptitude MonsterFarm innée (choix conservateur)", () => {
    expect(
      effectiveWork("PinkLizard", ["WorkSuitabilityAddRank_MonsterFarm_1"]).MonsterFarm,
    ).toBe(0);
  });
});

describe("supplyVector", () => {
  it("somme les puissances effectives, 0 par défaut", () => {
    expect(supplyVector([])).toEqual(vec());
    expect(
      supplyVector([
        { palId: "SheepBall", passives: [] },
        { palId: "SheepBall", passives: [] },
        { palId: "Ganesha", passives: [] },
      ]),
    ).toEqual(vec({ Handcraft: 2, MonsterFarm: 2, Transport: 2, Watering: 1 }));
  });
});

describe("normalizeDemands", () => {
  it("défaut 1 pour toutes les clés absentes", () => {
    const d = normalizeDemands([]);
    for (const k of WORK_KEYS) expect(d[k]).toBe(1);
  });

  it("clampe en entier 0..3 et ignore les types inconnus", () => {
    const d = normalizeDemands([
      { workType: "Mining", weight: 5 },
      { workType: "Watering", weight: -2 },
      { workType: "Handcraft", weight: 2.9 },
      { workType: "Cool", weight: 0 },
      { workType: "TravailInconnu", weight: 3 },
    ]);
    expect(d.Mining).toBe(3);
    expect(d.Watering).toBe(0);
    expect(d.Handcraft).toBe(2);
    expect(d.Cool).toBe(0);
    expect(d.Transport).toBe(1); // non fourni -> défaut
    expect(Object.keys(d).sort()).toEqual([...WORK_KEYS].sort()); // rien d'autre
  });
});

describe("baseStatus", () => {
  const at = (statuses: ReturnType<typeof baseStatus>, k: WorkKey) =>
    statuses.find((s) => s.work === k)!;

  it("12 lignes dans l'ordre WORK_KEYS", () => {
    const st = baseStatus(vec(), D());
    expect(st.map((s) => s.work)).toEqual([...WORK_KEYS]);
  });

  it("frontières bottleneck / ok / oversupply (poids 1, cible 3)", () => {
    const d = D({ Mining: 1 });
    const s1 = at(baseStatus(vec({ Mining: 2.9 }), d), "Mining");
    expect(s1.kind).toBe("bottleneck");
    expect(s1.target).toBe(3);
    expect(s1.coverage).toBeCloseTo(2.9 / 3, 10);

    const s2 = at(baseStatus(vec({ Mining: 3 }), d), "Mining");
    expect(s2.kind).toBe("ok");
    expect(s2.coverage).toBe(1);

    // exactement 2 x cible : encore ok (strictement supérieur requis)
    expect(at(baseStatus(vec({ Mining: 6 }), d), "Mining").kind).toBe("ok");

    const s3 = at(baseStatus(vec({ Mining: 6.1 }), d), "Mining");
    expect(s3.kind).toBe("oversupply");
    expect(s3.coverage).toBe(1);
  });

  it("poids 0 : ok sans offre, idle avec offre, coverage null", () => {
    const d = D(); // tous poids 0
    const ok = at(baseStatus(vec(), d), "Watering");
    expect(ok.kind).toBe("ok");
    expect(ok.coverage).toBeNull();

    const idle = at(baseStatus(vec({ Watering: 0.5 }), d), "Watering");
    expect(idle.kind).toBe("idle");
    expect(idle.coverage).toBeNull();
  });
});

describe("recommend", () => {
  it("comble d'abord le déficit pondéré le plus payant, puis le suivant", () => {
    const r = recommend({
      assigned: [],
      slotCount: 5,
      demands: D({ Mining: 3, Watering: 1 }),
      pool: [cand("g1", "Ganesha"), cand("b1", "Boar")],
    });
    // score(Boar) = 3 x min(1, 9) = 3 > score(Ganesha) = 1 x min(1, 3) = 1
    expect(r.adds.map((a) => a.pal.instanceId)).toEqual(["b1", "g1"]);
    expect(r.adds[0].score).toBe(3);
    expect(r.adds[0].gains).toEqual({ Mining: 1 });
    expect(r.swaps).toEqual([]); // slots libres restants -> pas d'échange
  });

  it("s'arrête quand plus aucun candidat n'apporte (score <= 0)", () => {
    const r = recommend({
      assigned: [],
      slotCount: 5,
      demands: D({ Mining: 1 }),
      pool: [cand("g1", "Ganesha")], // Watering seulement, poids 0
    });
    expect(r.adds).toEqual([]);
    expect(r.swaps).toEqual([]);
  });

  it("gains bornés au déficit restant, clés non nulles seulement", () => {
    const r = recommend({
      assigned: [cand("pl", "PinkLizard")], // Mining 2 -> déficit Mining = 1
      slotCount: 5,
      demands: D({ Mining: 1 }),
      pool: [cand("an", "Anubis")], // Mining 6
    });
    expect(r.adds).toHaveLength(1);
    expect(r.adds[0].gains).toEqual({ Mining: 1 }); // min(6, 1), Handcraft poids 0 exclu
  });

  it("départage déterministe : instanceId ASC à égalité parfaite", () => {
    const r = recommend({
      assigned: [],
      slotCount: 5,
      demands: D({ Handcraft: 1 }),
      pool: [cand("b", "SheepBall"), cand("a", "SheepBall")],
    });
    expect(r.adds[0].pal.instanceId).toBe("a");
  });

  it("départage déterministe : palId ASC avant instanceId", () => {
    const r = recommend({
      assigned: [],
      slotCount: 1,
      demands: D({ Collection: 1 }),
      // scores et puissances totales identiques (Collection 1 chacun)
      pool: [cand("a", "WizardOwl"), cand("z", "NightFox")],
    });
    expect(r.adds[0].pal.palId).toBe("NightFox"); // "N" < "W" malgré "z" > "a"
  });

  it("départage déterministe : puissance totale d'abord", () => {
    const r = recommend({
      assigned: [cand("ka", "KingAlpaca")], // Collection 2 -> déficit 1
      slotCount: 5,
      demands: D({ Collection: 1 }),
      // scores égaux (1 x min(1, 1)) mais ChickenPal a MonsterFarm 1 en plus
      pool: [cand("a", "WizardOwl"), cand("z", "ChickenPal")],
    });
    expect(r.adds[0].pal.palId).toBe("ChickenPal");
  });

  it("respecte les slots libres puis maxAdds", () => {
    const pool = [cand("b1", "Boar"), cand("b2", "Boar"), cand("b3", "Boar")];
    const r1 = recommend({
      assigned: [cand("b0", "Boar")],
      slotCount: 2, // 1 slot libre
      demands: D({ Mining: 3 }),
      pool,
    });
    expect(r1.adds).toHaveLength(1);
    expect(r1.swaps).toEqual([]); // le sortant potentiel est aussi utile que l'entrant

    const r2 = recommend({
      assigned: [],
      slotCount: 5,
      demands: D({ Mining: 3 }),
      pool,
      maxAdds: 1,
    });
    expect(r2.adds).toHaveLength(1);
  });

  it("slotCount null -> DEFAULT_SLOT_COUNT ; base pleine -> échanges ; idle sur l'état initial", () => {
    const assigned = Array.from({ length: DEFAULT_SLOT_COUNT }, (_, i) =>
      cand(`g${String(i).padStart(2, "0")}`, "Ganesha"),
    );
    const r = recommend({
      assigned,
      slotCount: null,
      demands: D({ Mining: 3 }),
      pool: [cand("b1", "Boar")],
    });
    expect(r.adds).toEqual([]); // 15 / 15, aucun slot libre
    expect(r.swaps).toHaveLength(1);
    // utilité 0 pour tous les Ganesha (Watering poids 0) -> instanceId ASC
    expect(r.swaps[0].out.instanceId).toBe("g00");
    expect(r.swaps[0].in.instanceId).toBe("b1");
    expect(r.swaps[0].net).toBe(3); // score 3 - utilité 0
    expect(r.idle).toEqual(["Watering"]); // poids 0, offre 15 > 0
  });

  it("pas d'échange quand tous les assignés sont utiles (net <= 1e-9)", () => {
    const r = recommend({
      assigned: [cand("b0", "Boar")],
      slotCount: 1,
      demands: D({ Mining: 3 }),
      pool: [cand("b1", "Boar")],
    });
    // utilité(b0) = 3, score(b1) après retrait = 3 -> net 0, pas d'échange
    expect(r.adds).toEqual([]);
    expect(r.swaps).toEqual([]);
  });

  it("plafonne les échanges à maxSwaps (défaut 3)", () => {
    const assigned = Array.from({ length: 5 }, (_, i) => cand(`g${i}`, "Ganesha"));
    const pool = Array.from({ length: 5 }, (_, i) => cand(`b${i}`, "Boar"));
    const args = { assigned, slotCount: 5, demands: D({ Mining: 3 }), pool };

    expect(recommend(args).swaps).toHaveLength(3); // défaut maxSwaps = 3
    expect(recommend({ ...args, maxSwaps: 1 }).swaps).toHaveLength(1);
  });

  it("plafonne les ajouts à maxAdds = 5 par défaut", () => {
    const pool = Array.from({ length: 8 }, (_, i) => cand(`b${i}`, "Boar"));
    const r = recommend({
      assigned: [],
      slotCount: 10,
      demands: D({ Mining: 3 }), // cible 9, chaque Boar apporte 1
      pool,
    });
    expect(r.adds).toHaveLength(5);
    // application virtuelle : le déficit décroît d'un ajout à l'autre
    expect(r.adds.map((a) => a.score)).toEqual([3, 3, 3, 3, 3]);
    expect(r.adds.map((a) => a.pal.instanceId)).toEqual(["b0", "b1", "b2", "b3", "b4"]);
  });
});
