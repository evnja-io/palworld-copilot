// Test d'intégration listGuildBases / setBaseDemand : nécessite une base migrée (0012).
// Gated : ne tourne que si TEST_DATABASE_URL est posée (branche Neon).
// Invocation - les DEUX variables sont nécessaires, sur la MÊME branche :
//   TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web test
// (cf. scoping.integration.test.ts pour la raison : getDb() lit
// $env/dynamic/private, figé depuis process.env à l'init de Vite.)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("listGuildBases / setBaseDemand", () => {
  const tag = randomUUID().slice(0, 8);
  // Chaîne d'identité des membres :
  // GUID_A : revendiqué par u1 ET présent partout -> username gagne.
  // GUID_B : save_players + player_name de guilde -> pseudo in-game gagne.
  // GUID_C : seulement player_name de la save de guilde -> ce nom.
  const GUID_A = "AAAA0000000000000000000000000000";
  const GUID_B = "BBBB0000000000000000000000000000";
  const GUID_C = "CCCC0000000000000000000000000000";
  const GUILD_1 = "F00D0000000000000000000000000001";
  const BASE_1 = "BA5E0000000000000000000000000001";
  const BASE_2 = "BA5E0000000000000000000000000002";
  let db: Awaited<ReturnType<typeof mkDb>>;
  let srvA: string, srvB: string, u1: string, u2: string;

  async function mkDb() {
    const { getDb } = await import("$lib/server/db");
    return getDb();
  }

  beforeAll(async () => {
    db = await mkDb();
    const { tables } = await import("$lib/server/db");
    const [ua] = await db
      .insert(tables.users)
      .values({
        discordId: `test-bases-${tag}-1`,
        username: `t1-${tag}`,
        avatarUrl: "https://example.com/a.png",
      })
      .returning();
    const [ub] = await db
      .insert(tables.users)
      .values({ discordId: `test-bases-${tag}-2`, username: `t2-${tag}` })
      .returning();
    u1 = ua.id;
    u2 = ub.id;
    const [sa] = await db
      .insert(tables.servers)
      .values({ name: `A-${tag}`, slug: `test-bases-a-${tag}`, ownerId: u1 })
      .returning();
    const [sb] = await db
      .insert(tables.servers)
      .values({ name: `B-${tag}`, slug: `test-bases-b-${tag}`, ownerId: u2 })
      .returning();
    srvA = sa.id;
    srvB = sb.id;
    await db.insert(tables.serverMembers).values([
      // u1 a revendiqué GUID_A sur A : son username Discord doit primer.
      { serverId: srvA, userId: u1, role: "owner", palPlayerGuid: GUID_A },
      { serverId: srvB, userId: u2, role: "owner" },
    ]);
    await db.insert(tables.savePlayers).values([
      // GUID_A a AUSSI un pseudo in-game : le username doit quand même primer.
      { serverId: srvA, playerGuid: GUID_A, nickname: `InGameA-${tag}` },
      { serverId: srvA, playerGuid: GUID_B, nickname: `InGameB-${tag}` },
    ]);
    await db.insert(tables.saveGuilds).values([
      {
        serverId: srvA,
        guildId: GUILD_1,
        name: `Guilde-${tag}`,
        baseCampLevel: 10,
        adminPlayerGuid: GUID_A,
      },
    ]);
    await db.insert(tables.saveGuildMembers).values([
      { serverId: srvA, guildId: GUILD_1, playerGuid: GUID_A, playerName: `SaveA-${tag}` },
      { serverId: srvA, guildId: GUILD_1, playerGuid: GUID_B, playerName: `SaveB-${tag}` },
      { serverId: srvA, guildId: GUILD_1, playerGuid: GUID_C, playerName: `SaveC-${tag}` },
    ]);
    await db.insert(tables.saveBases).values([
      {
        serverId: srvA,
        baseId: BASE_1,
        guildId: GUILD_1,
        name: "Base principale",
        worldX: 1000.5,
        worldY: -2000.25,
        worldZ: 300,
        areaRange: 2500,
        slotCount: 5,
      },
      // Base sans nom, sans WorkerDirector connu (slot_count null), sans affectation.
      { serverId: srvA, baseId: BASE_2, guildId: GUILD_1 },
    ]);
    await db.insert(tables.savePals).values([
      {
        serverId: srvA,
        instanceId: `PAL-A-${tag}`,
        ownerGuid: GUID_A,
        palId: "Anubis",
        gender: "male",
        level: 40,
        passives: ["CraftSpeed_up2"],
      },
      {
        serverId: srvA,
        instanceId: `PAL-B-${tag}`,
        ownerGuid: GUID_B,
        palId: "SheepBall",
        gender: "female",
        level: 12,
        nickname: "Doudou",
        passives: [],
      },
    ]);
    await db.insert(tables.savePalAssignments).values([
      // Ordre d'insertion inversé pour vérifier le tri par slot_index.
      { serverId: srvA, instanceId: `PAL-A-${tag}`, baseId: BASE_1, slotIndex: 1 },
      { serverId: srvA, instanceId: `PAL-B-${tag}`, baseId: BASE_1, slotIndex: 0 },
      // Affectation dont l'instance est ABSENTE de save_pals -> unresolvedCount.
      { serverId: srvA, instanceId: `PAL-GHOST-${tag}`, baseId: BASE_1, slotIndex: 2 },
    ]);
    await db.insert(tables.baseDemands).values([
      { serverId: srvA, baseId: BASE_1, workType: "Mining", weight: 3 },
      { serverId: srvA, baseId: BASE_1, workType: "Handcraft", weight: 0 },
    ]);
  });

  afterAll(async () => {
    const { tables } = await import("$lib/server/db");
    const { inArray } = await import("drizzle-orm");
    // Cascade : supprimer les serveurs emporte membres, save_* et base_demands.
    await db.delete(tables.servers).where(inArray(tables.servers.id, [srvA, srvB]));
    await db.delete(tables.users).where(inArray(tables.users.id, [u1, u2]));
  });

  it("assemble guilde, membres, bases et demandes", async () => {
    const { listGuildBases } = await import("$lib/server/bases");
    const guilds = await listGuildBases(srvA);
    expect(guilds).toHaveLength(1);
    const g = guilds[0];
    expect(g.guildId).toBe(GUILD_1);
    expect(g.name).toBe(`Guilde-${tag}`);
    expect(g.baseCampLevel).toBe(10);
    expect(g.adminPlayerGuid).toBe(GUID_A);
    expect(g.members).toHaveLength(3);
    expect(g.bases.map((b) => b.baseId)).toEqual([BASE_1, BASE_2]);
    const b1 = g.bases[0];
    expect(b1.name).toBe("Base principale");
    expect(b1.worldX).toBe(1000.5);
    expect(b1.worldY).toBe(-2000.25);
    expect(b1.slotCount).toBe(5);
    expect(b1.demands).toEqual([
      { workType: "Handcraft", weight: 0 },
      { workType: "Mining", weight: 3 },
    ]);
    const b2 = g.bases[1];
    expect(b2.name).toBeNull();
    expect(b2.slotCount).toBeNull();
    expect(b2.assigned).toEqual([]);
    expect(b2.unresolvedCount).toBe(0);
    expect(b2.demands).toEqual([]);
  });

  it("chaîne d'identité : username > pseudo in-game > nom de la save de guilde", async () => {
    const { listGuildBases } = await import("$lib/server/bases");
    const [g] = await listGuildBases(srvA);
    const byGuid = new Map(g.members.map((m) => [m.playerGuid, m]));
    // GUID revendiqué : username Discord prime sur tout le reste.
    expect(byGuid.get(GUID_A)?.name).toBe(`t1-${tag}`);
    expect(byGuid.get(GUID_A)?.userId).toBe(u1);
    expect(byGuid.get(GUID_A)?.avatarUrl).toBe("https://example.com/a.png");
    // Non revendiqué mais connu de save_players : pseudo in-game.
    expect(byGuid.get(GUID_B)?.name).toBe(`InGameB-${tag}`);
    expect(byGuid.get(GUID_B)?.userId).toBeNull();
    // Connu seulement de la save de guilde : player_name embarqué.
    expect(byGuid.get(GUID_C)?.name).toBe(`SaveC-${tag}`);
    expect(byGuid.get(GUID_C)?.userId).toBeNull();
    // Membres triés par nom d'affichage.
    const names = g.members.map((m) => m.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("liste les pals assignés triés par slot et compte les non résolus", async () => {
    const { listGuildBases } = await import("$lib/server/bases");
    const [g] = await listGuildBases(srvA);
    const b1 = g.bases[0];
    // PAL-GHOST est absent de save_pals : compté, pas listé.
    expect(b1.assigned).toHaveLength(2);
    expect(b1.unresolvedCount).toBe(1);
    expect(b1.assigned.map((p) => p.slotIndex)).toEqual([0, 1]);
    const [first, second] = b1.assigned;
    expect(first.palId).toBe("SheepBall");
    expect(first.ownerGuid).toBe(GUID_B);
    expect(first.nickname).toBe("Doudou");
    expect(second.palId).toBe("Anubis");
    expect(second.ownerGuid).toBe(GUID_A);
    expect(second.level).toBe(40);
    expect(second.passives).toEqual(["CraftSpeed_up2"]);
  });

  it("isole les serveurs entre eux", async () => {
    const { listGuildBases } = await import("$lib/server/bases");
    expect(await listGuildBases(srvB)).toEqual([]);
  });

  it("setBaseDemand : upsert insert puis update, visible dans listGuildBases", async () => {
    const { listGuildBases, setBaseDemand } = await import("$lib/server/bases");
    // Insert (pas de ligne Watering au départ).
    expect(await setBaseDemand(srvA, BASE_1, "Watering", 2)).toBe(true);
    let [g] = await listGuildBases(srvA);
    let watering = g.bases[0].demands.find((d) => d.workType === "Watering");
    expect(watering?.weight).toBe(2);
    // Update de la même clé (conflit sur la PK composite).
    expect(await setBaseDemand(srvA, BASE_1, "Watering", 0)).toBe(true);
    [g] = await listGuildBases(srvA);
    watering = g.bases[0].demands.find((d) => d.workType === "Watering");
    expect(watering?.weight).toBe(0);
  });

  it("setBaseDemand : false si la base est inconnue sur ce serveur", async () => {
    const { setBaseDemand } = await import("$lib/server/bases");
    expect(await setBaseDemand(srvA, "DEAD0000000000000000000000000000", "Mining", 1)).toBe(false);
    // BASE_1 existe sur A, pas sur B : le scoping serveur s'applique aussi ici.
    expect(await setBaseDemand(srvB, BASE_1, "Mining", 1)).toBe(false);
  });
});
