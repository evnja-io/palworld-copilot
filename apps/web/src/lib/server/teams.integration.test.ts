// Gated : TEST_DATABASE_URL ET DATABASE_URL sur la MÊME branche Neon (migrée 0008).
//   TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web test
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("teams CRUD + authz", () => {
  const tag = randomUUID().slice(0, 8);
  let db: Awaited<ReturnType<typeof mkDb>>;
  let srvA: string, srvB: string, u1: string, u2: string;

  const input = () => ({
    name: `Boss-${tag}`,
    notes: "notes",
    slots: [
      { palId: "Anubis", passives: ["AccuracyDecrease"], actives: ["AirCanon"] },
      null,
      null,
      null,
      null,
    ],
  });

  async function mkDb() {
    const { getDb } = await import("$lib/server/db");
    return getDb();
  }

  beforeAll(async () => {
    db = await mkDb();
    const { tables } = await import("$lib/server/db");
    const [ua] = await db
      .insert(tables.users)
      .values({ discordId: `test-${tag}-1`, username: `t1-${tag}` })
      .returning();
    const [ub] = await db
      .insert(tables.users)
      .values({ discordId: `test-${tag}-2`, username: `t2-${tag}` })
      .returning();
    u1 = ua.id;
    u2 = ub.id;
    const [sa] = await db
      .insert(tables.servers)
      .values({ name: `A-${tag}`, slug: `test-a-${tag}`, ownerId: u1 })
      .returning();
    const [sb] = await db
      .insert(tables.servers)
      .values({ name: `B-${tag}`, slug: `test-b-${tag}`, ownerId: u2 })
      .returning();
    srvA = sa.id;
    srvB = sb.id;
    await db.insert(tables.serverMembers).values([
      { serverId: srvA, userId: u1, role: "owner" },
      { serverId: srvA, userId: u2, role: "member" },
      { serverId: srvB, userId: u2, role: "owner" },
    ]);
  });

  afterAll(async () => {
    const { tables } = await import("$lib/server/db");
    const { inArray } = await import("drizzle-orm");
    // Cascade : supprimer les serveurs emporte membres et équipes.
    await db.delete(tables.servers).where(inArray(tables.servers.id, [srvA, srvB]));
    await db.delete(tables.users).where(inArray(tables.users.id, [u1, u2]));
  });

  it("CRUD complet avec fidélité jsonb", async () => {
    const { createTeam, getTeam, updateTeam, deleteTeam } = await import("$lib/server/teams");
    const created = await createTeam(srvA, u2, input());
    expect(created.authorId).toBe(u2);
    expect(created.slots).toEqual(input().slots);

    const fetched = await getTeam(srvA, created.id);
    expect(fetched?.slots?.[0]?.palId).toBe("Anubis");
    expect(fetched?.authorName).toBe(`t2-${tag}`);

    const updated = await updateTeam(srvA, created.id, u2, {
      ...input(),
      name: `Farm-${tag}`,
      slots: [null, null, null, null, null],
    });
    expect(updated.name).toBe(`Farm-${tag}`);
    expect(updated.slots).toEqual([null, null, null, null, null]);

    await deleteTeam(srvA, created.id, u2);
    expect(await getTeam(srvA, created.id)).toBeNull();
  });

  it("listTeams est scopé par serveur", async () => {
    const { createTeam, listTeams, deleteTeam } = await import("$lib/server/teams");
    const t = await createTeam(srvA, u1, input());
    expect((await listTeams(srvA)).map((x) => x.id)).toContain(t.id);
    expect((await listTeams(srvB)).map((x) => x.id)).not.toContain(t.id);
    // getTeam scopé : le même id via srvB → null.
    const { getTeam } = await import("$lib/server/teams");
    expect(await getTeam(srvB, t.id)).toBeNull();
    await deleteTeam(srvA, t.id, u1);
  });

  it("update/delete par un non-auteur → 403, y compris l'owner du serveur", async () => {
    const { createTeam, updateTeam, deleteTeam, getTeam } = await import("$lib/server/teams");
    const t = await createTeam(srvA, u2, input()); // auteur = u2 (member) ; u1 = owner
    await expect(updateTeam(srvA, t.id, u1, input())).rejects.toMatchObject({ status: 403 });
    await expect(deleteTeam(srvA, t.id, u1)).rejects.toMatchObject({ status: 403 });
    expect(await getTeam(srvA, t.id)).not.toBeNull();
    await deleteTeam(srvA, t.id, u2);
  });

  it("teamId inconnu → 404", async () => {
    const { updateTeam, deleteTeam } = await import("$lib/server/teams");
    const ghost = randomUUID();
    await expect(updateTeam(srvA, ghost, u1, input())).rejects.toMatchObject({ status: 404 });
    await expect(deleteTeam(srvA, ghost, u1)).rejects.toMatchObject({ status: 404 });
  });
});
