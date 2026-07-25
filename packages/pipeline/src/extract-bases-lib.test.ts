import { describe, expect, it } from "vitest";
import { extractBaseData, type BaseExtractStats } from "./extract-bases-lib.ts";

// Fixtures synthétiques : enveloppes palsav minimales de GroupSaveDataMap,
// BaseCampSaveData et CharacterContainerSaveData (cf. plan base-orchestration
// pour la forme réelle vérifiée). Builders à option-bag, comme extract-pals-lib.test.ts.

const GUILD = "aaaaaaaa-0000-0000-0000-000000000001";
const GUILD_NORM = "AAAAAAAA000000000000000000000001";
const GUILD2 = "aaaaaaaa-0000-0000-0000-000000000002";
const GUILD2_NORM = "AAAAAAAA000000000000000000000002";
const GUILD3 = "aaaaaaaa-0000-0000-0000-000000000003";
const GUILD3_NORM = "AAAAAAAA000000000000000000000003";
const GUILD4 = "aaaaaaaa-0000-0000-0000-000000000004";
const GUILD4_NORM = "AAAAAAAA000000000000000000000004";

const P1 = "00afd495-0000-4b32-8a1e-000000000001";
const P1_NORM = "00AFD49500004B328A1E000000000001";
const P2 = "00afd495-0000-4b32-8a1e-000000000002";
const P2_NORM = "00AFD49500004B328A1E000000000002";
const ADMIN = "00afd495-0000-4b32-8a1e-00000000000a";
const ADMIN_NORM = "00AFD49500004B328A1E00000000000A";

const BASE1 = "bbbbbbbb-0000-0000-0000-000000000001";
const BASE1_NORM = "BBBBBBBB000000000000000000000001";
const BASE2 = "bbbbbbbb-0000-0000-0000-000000000002";
const BASE2_NORM = "BBBBBBBB000000000000000000000002";

const CONT1 = "cccccccc-0000-0000-0000-000000000001";
const CONT2 = "cccccccc-0000-0000-0000-000000000002";

const PAL1 = "dddddddd-0000-0000-0000-000000000001";
const PAL1_NORM = "DDDDDDDD000000000000000000000001";
const PAL2 = "dddddddd-0000-0000-0000-000000000002";
const PAL2_NORM = "DDDDDDDD000000000000000000000002";
const PAL3 = "dddddddd-0000-0000-0000-000000000003";
const PAL3_NORM = "DDDDDDDD000000000000000000000003";

const ZERO = "00000000-0000-0000-0000-000000000000";

const ZERO_STATS: BaseExtractStats = {
  nonGuildGroups: 0,
  malformedGroups: 0,
  malformedBases: 0,
  basesWithoutDirector: 0,
  missingContainers: 0,
  emptySlots: 0,
  malformedSlots: 0,
  duplicateAssignments: 0,
  duplicateMembers: 0,
};

type GroupOpts = {
  key?: unknown;
  groupType?: unknown; // null -> pas de GroupType dans l'enveloppe
  rawGroupType?: string; // raw.group_type (fallback du filtre)
  raw?: unknown; // remplace RawData.value entier (ex. tableau d'octets bruts)
  groupId?: string | null; // null -> pas de group_id dans raw
  name?: string;
  nameKey?: "guild_name" | "group_name";
  baseCampLevel?: unknown;
  admin?: string;
  players?: unknown;
};

function groupEntry(opts: GroupOpts = {}) {
  const raw =
    opts.raw !== undefined
      ? opts.raw
      : (() => {
          const r: Record<string, unknown> = {};
          if (opts.groupId !== null) r.group_id = opts.groupId ?? GUILD;
          if (opts.rawGroupType !== undefined) r.group_type = opts.rawGroupType;
          if (opts.name !== undefined) r[opts.nameKey ?? "guild_name"] = opts.name;
          if (opts.baseCampLevel !== undefined) r.base_camp_level = opts.baseCampLevel;
          if (opts.admin !== undefined) r.admin_player_uid = opts.admin;
          if (opts.players !== undefined) r.players = opts.players;
          return r;
        })();
  const value: Record<string, unknown> = { RawData: { value: raw } };
  if (opts.groupType !== null) value.GroupType = opts.groupType ?? "EPalGroupType::Guild";
  return { key: opts.key ?? opts.groupId ?? GUILD, value };
}

function player(uid?: string, name?: string, lastOnline?: unknown) {
  const info: Record<string, unknown> = {};
  if (name !== undefined) info.player_name = name;
  if (lastOnline !== undefined) info.last_online_real_time = lastOnline;
  const p: Record<string, unknown> = { player_info: info };
  if (uid !== undefined) p.player_uid = uid;
  return p;
}

type BaseOpts = {
  key?: unknown;
  raw?: unknown;
  id?: string | null; // null -> pas de raw.id
  guildId?: string | null; // null -> pas de group_id_belong_to
  name?: string;
  translation?: { x?: unknown; y?: unknown; z?: unknown };
  areaRange?: unknown;
  modules?: unknown[] | null; // null -> pas de ModuleMap ; défaut WorkerDirector
  containerId?: string;
};

function baseEntry(opts: BaseOpts = {}) {
  const raw =
    opts.raw !== undefined
      ? opts.raw
      : (() => {
          const r: Record<string, unknown> = {};
          if (opts.id !== null) r.id = opts.id ?? BASE1;
          if (opts.guildId !== null) r.group_id_belong_to = opts.guildId ?? GUILD;
          if (opts.name !== undefined) r.name = opts.name;
          if (opts.translation !== undefined) r.transform = { translation: opts.translation };
          if (opts.areaRange !== undefined) r.area_range = opts.areaRange;
          return r;
        })();
  const value: Record<string, unknown> = { RawData: { value: raw } };
  if (opts.modules !== null) {
    value.ModuleMap = {
      value: opts.modules ?? [
        {
          key: "EPalBaseCampModuleType::WorkerDirector",
          value: { RawData: { value: { container_id: opts.containerId ?? CONT1 } } },
        },
      ],
    };
  }
  return { key: opts.key ?? opts.id ?? BASE1, value };
}

function containerEntry(opts: { key?: unknown; slots?: unknown[] } = {}) {
  return {
    key: opts.key ?? { ID: { value: CONT1 } },
    value: { Slots: { value: { values: opts.slots ?? [] } } },
  };
}

function slot(instanceId: string, slotIndex?: unknown) {
  const s: Record<string, unknown> = { RawData: { value: { instance_id: instanceId } } };
  if (slotIndex !== undefined) s.SlotIndex = { value: slotIndex };
  return s;
}

describe("extractBaseData", () => {
  it("extrait guilde, membres, base et affectations avec GUIDs normalisés (nominal)", () => {
    const { guilds, members, bases, assignments, stats } = extractBaseData(
      [
        groupEntry({
          name: "Les Bergers",
          baseCampLevel: 10,
          admin: ADMIN,
          players: [player(P1, "Alice", "638546135210000000"), player(P2)],
        }),
      ],
      [
        baseEntry({
          name: "Camp principal",
          translation: { x: 1000.5, y: -2000, z: 300 },
          areaRange: 2500,
        }),
      ],
      [containerEntry({ slots: [slot(PAL1), slot(PAL2), slot(ZERO)] })],
    );
    expect(guilds).toEqual([
      { guildId: GUILD_NORM, name: "Les Bergers", baseCampLevel: 10, adminPlayerGuid: ADMIN_NORM },
    ]);
    expect(members).toEqual([
      { guildId: GUILD_NORM, playerGuid: P1_NORM, playerName: "Alice", lastOnlineTicks: "638546135210000000" },
      { guildId: GUILD_NORM, playerGuid: P2_NORM, playerName: null, lastOnlineTicks: null },
    ]);
    expect(bases).toEqual([
      {
        baseId: BASE1_NORM,
        guildId: GUILD_NORM,
        name: "Camp principal",
        worldX: 1000.5,
        worldY: -2000,
        worldZ: 300,
        areaRange: 2500,
        slotCount: 3,
      },
    ]);
    expect(assignments).toEqual([
      { instanceId: PAL1_NORM, baseId: BASE1_NORM, slotIndex: 0 },
      { instanceId: PAL2_NORM, baseId: BASE1_NORM, slotIndex: 1 },
    ]);
    expect(stats).toEqual({ ...ZERO_STATS, emptySlots: 1 });
  });

  it("saute les groupes non guilde (stat nonGuildGroups)", () => {
    const { guilds, stats } = extractBaseData(
      [groupEntry({ groupType: "EPalGroupType::Neutral", groupId: GUILD2 })],
      [],
      [],
    );
    expect(guilds).toHaveLength(0);
    expect(stats.nonGuildGroups).toBe(1);
  });

  it("compte une RawData non décodée sans jeter (les deux formes observables)", () => {
    // Forme réelle du fork quand la section n'est pas décodée : ArrayProperty
    // ByteProperty sérialisée { values: [octets] }. Le GroupType, propriété
    // sœur toujours décodée, passe le filtre guilde : sans ce rejet, une
    // guilde creuse serait émise et le garde anti-wipe de syncBaseData
    // (guilds.length === 0) ne se déclencherait jamais.
    const { guilds, members, stats } = extractBaseData(
      [groupEntry({ raw: { values: [1, 2, 3, 4] } }), groupEntry({ raw: [1, 2, 3] })],
      [],
      [],
    );
    expect(guilds).toHaveLength(0);
    expect(members).toHaveLength(0);
    expect(stats.malformedGroups).toBe(2);
  });

  it("compte une base à la RawData non décodée ({ values }) sans jeter", () => {
    const { bases, stats } = extractBaseData([], [baseEntry({ raw: { values: [9, 9] } })], []);
    expect(bases).toHaveLength(0);
    expect(stats.malformedBases).toBe(1);
  });

  it("déduplique les membres et ignore les player_uid nuls (stat duplicateMembers)", () => {
    // players[] avec doublon : sans déduplication, la PK de save_guild_members
    // ferait échouer toute la transaction de sync.
    const { members, stats } = extractBaseData(
      [
        groupEntry({
          players: [player(P1, "Alice"), player(P1, "Alice-bis"), player(ZERO, "Fantôme"), player(P2)],
        }),
      ],
      [],
      [],
    );
    expect(members.map((m) => m.playerGuid)).toEqual([P1_NORM, P2_NORM]);
    expect(members[0]?.playerName).toBe("Alice"); // première occurrence conservée
    expect(stats.duplicateMembers).toBe(1);
  });

  it("gère les variantes d'enveloppe de GroupType (string, {value}, {value:{value}}, raw.group_type)", () => {
    const { guilds, stats } = extractBaseData(
      [
        groupEntry({ groupId: GUILD }),
        groupEntry({ groupId: GUILD2, groupType: { value: "EPalGroupType::Guild" } }),
        groupEntry({ groupId: GUILD3, groupType: { value: { value: "EPalGroupType::Guild" } } }),
        groupEntry({ groupId: GUILD4, groupType: null, rawGroupType: "EPalGroupType::Guild" }),
      ],
      [],
      [],
    );
    expect(guilds.map((g) => g.guildId)).toEqual([GUILD_NORM, GUILD2_NORM, GUILD3_NORM, GUILD4_NORM]);
    expect(stats.nonGuildGroups).toBe(0);
  });

  it("gère les variantes de clé de map (string, {value}, {ID:{value}})", () => {
    const { guilds, bases, assignments } = extractBaseData(
      [groupEntry({ key: { value: GUILD }, groupId: null })], // id retombe sur la clé {value}
      [baseEntry({ key: { value: BASE1 }, id: null })], // idem côté base
      [containerEntry({ key: CONT1, slots: [slot(PAL1)] })], // clé string directe
    );
    expect(guilds[0]?.guildId).toBe(GUILD_NORM);
    expect(bases[0]).toMatchObject({ baseId: BASE1_NORM, slotCount: 1 });
    expect(assignments).toEqual([{ instanceId: PAL1_NORM, baseId: BASE1_NORM, slotIndex: 0 }]);
  });

  it("garde la base sans WorkerDirector (slotCount null, stat basesWithoutDirector)", () => {
    const { bases, assignments, stats } = extractBaseData(
      [groupEntry()],
      [
        baseEntry({ modules: null }), // pas de ModuleMap du tout
        baseEntry({
          id: BASE2,
          // module sans container_id ni clé WorkerDirector
          modules: [{ key: "EPalBaseCampModuleType::TransportItemDirector", value: { RawData: { value: {} } } }],
        }),
      ],
      [],
    );
    expect(bases.map((b) => b.baseId)).toEqual([BASE1_NORM, BASE2_NORM]);
    expect(bases.map((b) => b.slotCount)).toEqual([null, null]);
    expect(assignments).toHaveLength(0);
    expect(stats.basesWithoutDirector).toBe(2);
  });

  it("compte un container_id sans entrée CharacterContainerSaveData (stat missingContainers)", () => {
    const { bases, assignments, stats } = extractBaseData(
      [groupEntry()],
      [baseEntry({ containerId: CONT2 })],
      [containerEntry()], // seul CONT1 est indexé
    );
    expect(bases[0]?.slotCount).toBeNull();
    expect(assignments).toHaveLength(0);
    expect(stats.missingContainers).toBe(1);
  });

  it("compte les slots vides dans slotCount et honore SlotIndex (défaut index, ByteProperty)", () => {
    const { bases, assignments, stats } = extractBaseData(
      [groupEntry()],
      [baseEntry()],
      [
        containerEntry({
          slots: [
            slot(ZERO), // slot libre : compté dans slotCount, pas d'affectation
            slot(PAL1), // SlotIndex absent -> index tableau (1)
            slot(PAL2, 5), // SlotIndex à plat
            slot(PAL3, { type: "None", value: 7 }), // ByteProperty imbriquée
            {}, // slot sans RawData -> malformedSlots
          ],
        }),
      ],
    );
    expect(bases[0]?.slotCount).toBe(5);
    expect(assignments).toEqual([
      { instanceId: PAL1_NORM, baseId: BASE1_NORM, slotIndex: 1 },
      { instanceId: PAL2_NORM, baseId: BASE1_NORM, slotIndex: 5 },
      { instanceId: PAL3_NORM, baseId: BASE1_NORM, slotIndex: 7 },
    ]);
    expect(stats.emptySlots).toBe(1);
    expect(stats.malformedSlots).toBe(1);
  });

  it("déduplique une instance affectée à deux bases (première gagne, stat duplicateAssignments)", () => {
    const { assignments, stats } = extractBaseData(
      [groupEntry()],
      [baseEntry(), baseEntry({ id: BASE2, containerId: CONT2 })],
      [
        containerEntry({ slots: [slot(PAL1)] }),
        containerEntry({ key: { ID: { value: CONT2 } }, slots: [slot(PAL1)] }),
      ],
    );
    expect(assignments).toEqual([{ instanceId: PAL1_NORM, baseId: BASE1_NORM, slotIndex: 0 }]);
    expect(stats.duplicateAssignments).toBe(1);
  });

  it("déballe les enveloppes ByteProperty de base_camp_level / area_range / last_online", () => {
    const { guilds, members, bases } = extractBaseData(
      [
        groupEntry({
          baseCampLevel: { type: "None", value: 12 },
          players: [player(P1, "Alice", { type: "None", value: "638000000000000000" }), player(P2, undefined, 12345)],
        }),
      ],
      [baseEntry({ areaRange: { type: "None", value: 3000 } })],
      [containerEntry()],
    );
    expect(guilds[0]?.baseCampLevel).toBe(12);
    expect(members.map((m) => m.lastOnlineTicks)).toEqual(["638000000000000000", "12345"]);
    expect(bases[0]?.areaRange).toBe(3000);
  });

  it("retourne un résultat vide sans jeter quand les sections sont absentes", () => {
    const { guilds, members, bases, assignments, stats } = extractBaseData([], [], []);
    expect(guilds).toEqual([]);
    expect(members).toEqual([]);
    expect(bases).toEqual([]);
    expect(assignments).toEqual([]);
    expect(stats).toEqual(ZERO_STATS);
  });

  it("garde la guilde sans players[], admin GUID nul -> null, membre sans uid sauté", () => {
    const { guilds, members } = extractBaseData(
      [
        groupEntry({ admin: ZERO }), // pas de players
        groupEntry({ groupId: GUILD2, players: [player(undefined, "SansUid")] }),
      ],
      [],
      [],
    );
    expect(guilds).toHaveLength(2);
    expect(guilds[0]?.adminPlayerGuid).toBeNull();
    expect(members).toHaveLength(0);
  });
});
