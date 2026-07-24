// Test d'intégration multi-tenant : nécessite une base migrée (A + backfill + B).
// Gated : ne tourne que si TEST_DATABASE_URL est posée (branche Neon, Tâche 8).
// Invocation - les DEUX variables sont nécessaires, sur la MÊME branche :
//   TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web test
// TEST_DATABASE_URL déclenche la suite ; DATABASE_URL doit aussi pointer la
// branche car getDb() lit $env/dynamic/private, que le plugin SvelteKit fige
// depuis process.env/.env à l'init de Vite - muter process.env dans un
// beforeAll serait trop tardif (l'env est déjà capturé).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("scoping multi-tenant", () => {
  const tag = randomUUID().slice(0, 8);
  const GUID = "AAAA0000000000000000000000000000";
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
      { serverId: srvB, userId: u2, role: "owner" },
      // u1 est aussi membre de B : le cas le plus sensible pour le scoping.
      { serverId: srvB, userId: u1, role: "member" },
    ]);
    await db.insert(tables.saveSnapshots).values([
      { serverId: srvA, playerGuid: GUID, kind: "pal_caught", entityId: "Anubis" },
      { serverId: srvA, playerGuid: GUID, kind: "tech_unlocked", entityId: "Workbench" },
    ]);
  });

  afterAll(async () => {
    const { tables } = await import("$lib/server/db");
    const { inArray } = await import("drizzle-orm");
    // Cascade : supprimer les serveurs emporte membres/progress/snapshots.
    await db.delete(tables.servers).where(inArray(tables.servers.id, [srvA, srvB]));
    await db.delete(tables.users).where(inArray(tables.users.id, [u1, u2]));
  });

  it("les coches ne fuient pas entre serveurs", async () => {
    const { setProgress, getProgress } = await import("$lib/server/progress");
    await setProgress(srvA, u1, "pal_caught", "Anubis", true);
    const a = await getProgress(srvA, "pal_caught", u1);
    const b = await getProgress(srvB, "pal_caught", u2);
    expect(a.mine).toContain("Anubis");
    expect(b.mine).toHaveLength(0);
    expect(Object.keys(b.group)).toHaveLength(0);
  });

  it("les snapshots sont scopés par serveur", async () => {
    const { listSnapshots } = await import("$lib/server/import");
    expect((await listSnapshots(srvA)).map((s) => s.guid)).toContain(GUID);
    expect(await listSnapshots(srvB)).toHaveLength(0);
  });

  it("claimGuid écrit dans server_members et fusionne sur le bon serveur", async () => {
    const { claimGuid } = await import("$lib/server/import");
    const { getProgress } = await import("$lib/server/progress");
    await claimGuid(srvA, u1, GUID);
    expect((await getProgress(srvA, "tech_unlocked", u1)).mine).toContain("Workbench");
    expect((await getProgress(srvB, "tech_unlocked", u2)).mine).toHaveLength(0);
  });

  it("claimGuid refuse un GUID inconnu du serveur (même s'il existe ailleurs)", async () => {
    const { claimGuid, ClaimError } = await import("$lib/server/import");
    await expect(claimGuid(srvB, u2, GUID)).rejects.toSatisfy(
      (e: unknown) => e instanceof ClaimError && e.code === "guid_unknown",
    );
  });

  it("requireMembership : 404 pour un non-membre", async () => {
    const { requireMembership } = await import("$lib/server/servers");
    const { tables } = await import("$lib/server/db");
    const { eq } = await import("drizzle-orm");
    const [srv] = await db.select().from(tables.servers).where(eq(tables.servers.id, srvA));
    await expect(requireMembership({ id: u2 }, srv.slug)).rejects.toMatchObject({ status: 404 });
    await expect(requireMembership({ id: u1 }, srv.slug)).resolves.toMatchObject({
      membership: { role: "owner" },
    });
  });

  it("un même utilisateur membre de deux serveurs : coches indépendantes", async () => {
    const { setProgress, getProgress } = await import("$lib/server/progress");
    await setProgress(srvA, u1, "pal_caught", "Lamball", true);
    await setProgress(srvB, u1, "pal_caught", "Lamball", true);
    expect((await getProgress(srvA, "pal_caught", u1)).mine).toContain("Lamball");
    expect((await getProgress(srvB, "pal_caught", u1)).mine).toContain("Lamball");
    // Décocher sur A ne doit pas toucher B.
    await setProgress(srvA, u1, "pal_caught", "Lamball", false);
    expect((await getProgress(srvA, "pal_caught", u1)).mine).not.toContain("Lamball");
    expect((await getProgress(srvB, "pal_caught", u1)).mine).toContain("Lamball");
  });
});
