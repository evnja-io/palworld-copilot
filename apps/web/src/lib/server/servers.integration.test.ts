// Test d'intégration multi-tenant (invitations, création de serveur).
// Gated : ne tourne que si TEST_DATABASE_URL est posée (branche Neon migrée
// avec 0005). Exécution différée en Tâche 11. Les DEUX variables sont requises
// sur la même branche — getDb() lit $env/dynamic/private, figée par le plugin
// SvelteKit à l'init de Vite (pas de beforeAll : ce serait trop tard) :
//   TEST_DATABASE_URL=<url> DATABASE_URL=<url> pnpm --filter web test
import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("servers & invitations", () => {
  const tag = () => randomUUID().slice(0, 8);
  const createdUserIds: string[] = [];
  const createdServerIds: string[] = [];

  async function mkUser(): Promise<string> {
    const { getDb, tables } = await import("$lib/server/db");
    const t = tag();
    const [u] = await getDb()
      .insert(tables.users)
      .values({ discordId: `test-${t}`, username: `u-${t}` })
      .returning();
    createdUserIds.push(u.id);
    return u.id;
  }

  afterEach(async () => {
    const { getDb, tables } = await import("$lib/server/db");
    const { inArray } = await import("drizzle-orm");
    const db = getDb();
    if (createdServerIds.length)
      await db.delete(tables.servers).where(inArray(tables.servers.id, createdServerIds));
    if (createdUserIds.length)
      await db.delete(tables.users).where(inArray(tables.users.id, createdUserIds));
    createdServerIds.length = 0;
    createdUserIds.length = 0;
  });

  it("createServer crée serveur + adhésion owner", async () => {
    const { createServer, requireOwner } = await import("$lib/server/servers");
    const uid = await mkUser();
    const srv = await createServer(uid, "Mon monde");
    createdServerIds.push(srv.id);
    expect(srv.slug).toMatch(/^[0-9A-Za-z]{10}$/);
    const { membership } = await requireOwner({ id: uid }, srv.slug);
    expect(membership.role).toBe("owner");
  });

  it("createServer refuse au-delà de 3 serveurs créés", async () => {
    const { createServer } = await import("$lib/server/servers");
    const uid = await mkUser();
    for (let i = 0; i < 3; i++) createdServerIds.push((await createServer(uid, `S${i}`)).id);
    await expect(createServer(uid, "S4")).rejects.toMatchObject({ status: 403 });
  });

  it("requireOwner : 404 pour un membre non-owner", async () => {
    const { createServer, createInvite, consumeInvite, requireOwner } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const member = await mkUser();
    const srv = await createServer(owner, "Partagé");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    await consumeInvite(inv.code, member);
    await expect(requireOwner({ id: member }, srv.slug)).rejects.toMatchObject({ status: 404 });
  });
});
