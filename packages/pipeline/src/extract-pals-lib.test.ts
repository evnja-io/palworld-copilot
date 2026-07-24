import { describe, expect, it } from "vitest";
import { extractPalInstances, normalizeGuid } from "./extract-pals-lib.ts";

// Fixtures synthétiques : enveloppe palsav minimale d'une entrée de
// CharacterSaveParameterMap (cf. extract-players.ts pour la forme réelle).

const OWNER = "00afd495-0000-4b32-8a1e-000000000001";
const OWNER_NORM = "00AFD49500004B328A1E000000000001";
const IID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const IID_NORM = "AAAAAAAABBBBCCCCDDDDEEEEEEEEEEEE";
const ZERO = "00000000-0000-0000-0000-000000000000";

const palIdsLower = new Map([
  ["sheepball", "SheepBall"],
  ["kingalpaca_ice", "KingAlpaca_Ice"],
  ["blueplatypus", "BluePlatypus"],
]);

type FixtureOpts = {
  instanceId?: string | null; // null -> clé sans InstanceId
  owner?: string | null; // null -> pas d'OwnerPlayerUId
  species?: string;
  isPlayer?: boolean;
  gender?: unknown; // valeur brute de Gender.value (string ou objet)
  level?: number;
  nickname?: string;
  passives?: unknown; // valeur brute de PassiveSkillList.value.values
  talentHp?: number;
  talentShot?: number;
  talentDefense?: number;
};

function entry(opts: FixtureOpts = {}) {
  const sp: Record<string, unknown> = {};
  if (opts.isPlayer) sp.IsPlayer = { value: true };
  if (opts.owner !== null) sp.OwnerPlayerUId = { value: opts.owner ?? OWNER };
  sp.CharacterID = { value: opts.species ?? "SheepBall" };
  if (opts.gender !== undefined) sp.Gender = { value: opts.gender };
  if (opts.level !== undefined) sp.Level = { value: opts.level };
  if (opts.nickname !== undefined) sp.NickName = { value: opts.nickname };
  if (opts.passives !== undefined) sp.PassiveSkillList = { value: { values: opts.passives } };
  if (opts.talentHp !== undefined) sp.Talent_HP = { value: opts.talentHp };
  if (opts.talentShot !== undefined) sp.Talent_Shot = { value: opts.talentShot };
  if (opts.talentDefense !== undefined) sp.Talent_Defense = { value: opts.talentDefense };
  return {
    key: opts.instanceId === null ? {} : { InstanceId: { value: opts.instanceId ?? IID } },
    value: { RawData: { value: { object: { SaveParameter: { value: sp } } } } },
  };
}

describe("normalizeGuid", () => {
  it("supprime les tirets et passe en majuscules", () => {
    expect(normalizeGuid(OWNER)).toBe(OWNER_NORM);
    expect(normalizeGuid("00afd495-0000-0000-0000-000000000000")).toBe(
      "00AFD495000000000000000000000000",
    );
  });
});

describe("extractPalInstances", () => {
  it("extrait une instance complète avec GUIDs normalisés", () => {
    const { rows, stats } = extractPalInstances(
      [
        entry({
          gender: "EPalGenderType::Female",
          level: 42,
          nickname: "Doudou",
          passives: ["Rare", "Legend"],
          talentHp: 90,
          talentShot: 80,
          talentDefense: 70,
        }),
      ],
      palIdsLower,
    );
    expect(stats).toEqual({ players: 0, noOwner: 0, unknownSpecies: 0, duplicates: 0 });
    expect(rows).toEqual([
      {
        instanceId: IID_NORM,
        ownerGuid: OWNER_NORM,
        palId: "SheepBall",
        gender: "female",
        level: 42,
        nickname: "Doudou",
        passives: ["Rare", "Legend"],
        talentHp: 90,
        talentShot: 80,
        talentDefense: 70,
      },
    ]);
  });

  it("saute les entrées joueur (stat players)", () => {
    const { rows, stats } = extractPalInstances([entry({ isPlayer: true })], palIdsLower);
    expect(rows).toHaveLength(0);
    expect(stats.players).toBe(1);
  });

  it("résout l'espèce sans tenir compte de la casse", () => {
    const { rows } = extractPalInstances([entry({ species: "sHeEpBaLl" })], palIdsLower);
    expect(rows[0]?.palId).toBe("SheepBall");
  });

  it("retire le préfixe BOSS_ (casse mixte) avant nouvelle tentative", () => {
    const { rows, stats } = extractPalInstances(
      [entry({ species: "BOSS_KingAlpaca_Ice" }), entry({ species: "boss_BluePlatypus", instanceId: "11111111-1111-1111-1111-111111111111" })],
      palIdsLower,
    );
    expect(rows.map((r) => r.palId)).toEqual(["KingAlpaca_Ice", "BluePlatypus"]);
    expect(stats.unknownSpecies).toBe(0);
  });

  it("saute les espèces inconnues (stat unknownSpecies)", () => {
    const { rows, stats } = extractPalInstances(
      [entry({ species: "GYM_ThunderDragonMan" }), entry({ species: "RAID_KingBahamut_Dark" })],
      palIdsLower,
    );
    expect(rows).toHaveLength(0);
    expect(stats.unknownSpecies).toBe(2);
  });

  it("saute owner absent et owner GUID nul (stat noOwner)", () => {
    const { rows, stats } = extractPalInstances(
      [entry({ owner: null }), entry({ owner: ZERO })],
      palIdsLower,
    );
    expect(rows).toHaveLength(0);
    expect(stats.noOwner).toBe(2);
  });

  it("saute l'entrée sans InstanceId", () => {
    const { rows, stats } = extractPalInstances([entry({ instanceId: null })], palIdsLower);
    expect(rows).toHaveLength(0);
    expect(stats).toEqual({ players: 0, noOwner: 0, unknownSpecies: 0, duplicates: 0 });
  });

  it("gère les deux formes d'enveloppe du genre (female avant male)", () => {
    const { rows } = extractPalInstances(
      [
        entry({ gender: "EPalGenderType::Female" }), // string directe — "Female" contient "male"
        entry({ gender: { value: "EPalGenderType::Male" }, instanceId: "22222222-2222-2222-2222-222222222222" }), // objet imbriqué
        entry({ gender: { value: "EPalGenderType::Female" }, instanceId: "33333333-3333-3333-3333-333333333333" }),
        entry({ instanceId: "44444444-4444-4444-4444-444444444444" }), // Gender absent
      ],
      palIdsLower,
    );
    expect(rows.map((r) => r.gender)).toEqual(["female", "male", "female", null]);
  });

  it("applique les défauts : level 1, nickname/talents null, passives []", () => {
    const { rows } = extractPalInstances([entry()], palIdsLower);
    expect(rows[0]).toMatchObject({
      level: 1,
      nickname: null,
      passives: [],
      talentHp: null,
      talentShot: null,
      talentDefense: null,
    });
  });

  it("retombe sur les défauts quand level/talents/nickname ont un type inattendu", () => {
    // Enveloppe divergente (Int64 sérialisé en string, objet imbriqué…) : les
    // scalaires non conformes ne doivent jamais atteindre le cast SQL int[].
    const { rows } = extractPalInstances(
      [
        entry({
          level: "42" as unknown as number,
          nickname: { value: "Doudou" } as unknown as string,
          talentHp: "90" as unknown as number,
          talentShot: { value: 80 } as unknown as number,
        }),
      ],
      palIdsLower,
    );
    expect(rows[0]).toMatchObject({
      level: 1,
      nickname: null,
      talentHp: null,
      talentShot: null,
      talentDefense: null,
    });
  });

  it("ne garde que les passifs de type string", () => {
    const { rows } = extractPalInstances(
      [entry({ passives: ["Rare", 3, null, "Legend"] })],
      palIdsLower,
    );
    expect(rows[0]?.passives).toEqual(["Rare", "Legend"]);
  });

  it("déduplique par InstanceId (stat duplicates)", () => {
    const { rows, stats } = extractPalInstances(
      [
        entry({ level: 10 }),
        entry({ level: 20, species: "BluePlatypus" }), // même IID par défaut
      ],
      palIdsLower,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.level).toBe(10); // première occurrence conservée
    expect(stats.duplicates).toBe(1);
  });
});
