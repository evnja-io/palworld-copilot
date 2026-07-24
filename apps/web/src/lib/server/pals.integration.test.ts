// Test d'intégration listPalInstances : nécessite une base migrée (0007).
// Gated : ne tourne que si TEST_DATABASE_URL est posée (branche Neon).
// Invocation - les DEUX variables sont nécessaires, sur la MÊME branche :
//   TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web test
// (cf. scoping.integration.test.ts pour la raison : getDb() lit
// $env/dynamic/private, figé depuis process.env à l'init de Vite.)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("listPalInstances", () => {
  const tag = randomUUID().slice(0, 8);
  // GUID_A : revendiqué par u1 ET présent dans save_players → username gagne.
  // GUID_B : seulement save_players → pseudo in-game.
  // GUID_C : inconnu partout → GUID tronqué (8 chars + …).
  const GUID_A = "AAAA0000000000000000000000000000";
  const GUID_B = "BBBB0000000000000000000000000000";
  const GUID_C = "CCCC0000000000000000000000000000";
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
        discordId: `test-pals-${tag}-1`,
        username: `t1-${tag}`,
        avatarUrl: "https://example.com/a.png",
      })
      .returning();
    const [ub] = await db
      .insert(tables.users)
      .values({ discordId: `test-pals-${tag}-2`, username: `t2-${tag}` })
      .returning();
    u1 = ua.id;
    u2 = ub.id;
    const [sa] = await db
      .insert(tables.servers)
      .values({ name: `A-${tag}`, slug: `test-pals-a-${tag}`, ownerId: u1 })
      .returning();
    const [sb] = await db
      .insert(tables.servers)
      .values({ name: `B-${tag}`, slug: `test-pals-b-${tag}`, ownerId: u2 })
      .returning();
    srvA = sa.id;
    srvB = sb.id;
    await db.insert(tables.serverMembers).values([
      // u1 a revendiqué GUID_A sur A ; u2 est membre non revendiqué.
      { serverId: srvA, userId: u1, role: "owner", palPlayerGuid: GUID_A },
      { serverId: srvA, userId: u2, role: "member" },
      { serverId: srvB, userId: u2, role: "owner" },
    ]);
    await db.insert(tables.savePlayers).values([
      // GUID_A a AUSSI un pseudo in-game : le username doit primer.
      { serverId: srvA, playerGuid: GUID_A, nickname: `InGameA-${tag}` },
      { serverId: srvA, playerGuid: GUID_B, nickname: `Nick-${tag}` },
    ]);
    await db.insert(tables.savePals).values([
      // GUID_A : 3 instances, niveaux mélangés pour vérifier le tri desc.
      {
        serverId: srvA,
        instanceId: `INSTA1${tag}`,
        ownerGuid: GUID_A,
        palId: "Anubis",
        gender: "male",
        level: 22,
        passives: ["Legend", "Ferocious"],
        talentHp: 90,
        talentShot: 80,
        talentDefense: 70,
      },
      {
        serverId: srvA,
        instanceId: `INSTA2${tag}`,
        ownerGuid: GUID_A,
        palId: "SheepBall",
        gender: "female",
        level: 50,
        nickname: "Doudou",
        passives: [],
      },
      {
        serverId: srvA,
        instanceId: `INSTA3${tag}`,
        ownerGuid: GUID_A,
        palId: "PinkCat",
        level: 5,
        passives: ["Swift"],
      },
      // GUID_B : une instance.
      {
        serverId: srvA,
        instanceId: `INSTB1${tag}`,
        ownerGuid: GUID_B,
        palId: "Penguin",
        gender: "female",
        level: 12,
        passives: ["CoolTimeReduction_Up_1", "PAL_ALLAttack_up1"],
      },
      // GUID_C : une instance, owner inconnu de server_members et save_players.
      {
        serverId: srvA,
        instanceId: `INSTC1${tag}`,
        ownerGuid: GUID_C,
        palId: "Garm",
        level: 1,
        passives: [],
      },
      // Serveur B : même GUID_A, ne doit jamais fuir vers A (ni l'inverse).
      {
        serverId: srvB,
        instanceId: `INSTZ1${tag}`,
        ownerGuid: GUID_A,
        palId: "Bastet",
        level: 33,
        passives: ["Rare"],
      },
    ]);
  });

  afterAll(async () => {
    const { tables } = await import("$lib/server/db");
    const { inArray } = await import("drizzle-orm");
    // Cascade : supprimer les serveurs emporte membres/save_players/save_pals.
    await db.delete(tables.servers).where(inArray(tables.servers.id, [srvA, srvB]));
    await db.delete(tables.users).where(inArray(tables.users.id, [u1, u2]));
  });

  it("groupe les instances par propriétaire", async () => {
    const { listPalInstances } = await import("$lib/server/pals");
    const owners = await listPalInstances(srvA);
    expect(owners).toHaveLength(3);
    const byGuid = new Map(owners.map((o) => [o.guid, o]));
    expect(byGuid.get(GUID_A)?.instances).toHaveLength(3);
    expect(byGuid.get(GUID_B)?.instances).toHaveLength(1);
    expect(byGuid.get(GUID_C)?.instances).toHaveLength(1);
    expect(byGuid.get(GUID_B)?.instances[0].palId).toBe("Penguin");
  });

  it("chaîne de fallback du nom : username > pseudo in-game > GUID tronqué", async () => {
    const { listPalInstances } = await import("$lib/server/pals");
    const owners = await listPalInstances(srvA);
    const byGuid = new Map(owners.map((o) => [o.guid, o]));
    // GUID revendiqué : username Discord prime sur le pseudo in-game.
    expect(byGuid.get(GUID_A)?.name).toBe(`t1-${tag}`);
    expect(byGuid.get(GUID_A)?.userId).toBe(u1);
    expect(byGuid.get(GUID_A)?.avatarUrl).toBe("https://example.com/a.png");
    // Non revendiqué mais connu de save_players : pseudo in-game.
    expect(byGuid.get(GUID_B)?.name).toBe(`Nick-${tag}`);
    expect(byGuid.get(GUID_B)?.userId).toBeNull();
    expect(byGuid.get(GUID_B)?.avatarUrl).toBeNull();
    // Inconnu partout : GUID tronqué à 8 caractères + ellipse.
    expect(byGuid.get(GUID_C)?.name).toBe("CCCC0000…");
    expect(byGuid.get(GUID_C)?.userId).toBeNull();
    // Owners triés par nom d'affichage.
    const names = owners.map((o) => o.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("isole les serveurs entre eux", async () => {
    const { listPalInstances } = await import("$lib/server/pals");
    const ownersA = await listPalInstances(srvA);
    const ownersB = await listPalInstances(srvB);
    expect(ownersA.flatMap((o) => o.instances.map((i) => i.palId))).not.toContain("Bastet");
    expect(ownersB).toHaveLength(1);
    expect(ownersB[0].guid).toBe(GUID_A);
    expect(ownersB[0].instances.map((i) => i.palId)).toEqual(["Bastet"]);
    // GUID_A n'est revendiqué que sur A → fallback GUID tronqué sur B.
    expect(ownersB[0].name).toBe("AAAA0000…");
    expect(ownersB[0].userId).toBeNull();
  });

  it("round-trip du tableau passives (text[])", async () => {
    const { listPalInstances } = await import("$lib/server/pals");
    const owners = await listPalInstances(srvA);
    const byGuid = new Map(owners.map((o) => [o.guid, o]));
    const anubis = byGuid.get(GUID_A)?.instances.find((i) => i.palId === "Anubis");
    expect(anubis?.passives).toEqual(["Legend", "Ferocious"]);
    expect(anubis?.gender).toBe("male");
    expect(anubis?.talentHp).toBe(90);
    expect(anubis?.talentShot).toBe(80);
    expect(anubis?.talentDefense).toBe(70);
    // Tableau vide (défaut '{}') restitué en [].
    const sheep = byGuid.get(GUID_A)?.instances.find((i) => i.palId === "SheepBall");
    expect(sheep?.passives).toEqual([]);
    expect(sheep?.nickname).toBe("Doudou");
    // Talents absents → null.
    expect(sheep?.talentHp).toBeNull();
  });

  it("trie les instances par level décroissant", async () => {
    const { listPalInstances } = await import("$lib/server/pals");
    const owners = await listPalInstances(srvA);
    const a = owners.find((o) => o.guid === GUID_A);
    expect(a?.instances.map((i) => i.level)).toEqual([50, 22, 5]);
  });
});
