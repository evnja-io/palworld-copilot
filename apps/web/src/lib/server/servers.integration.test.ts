// Test d'intégration multi-tenant (invitations, création de serveur).
// Gated : ne tourne que si TEST_DATABASE_URL est posée (branche Neon migrée
// avec 0005). Exécution différée en Tâche 11. Les DEUX variables sont requises
// sur la même branche - getDb() lit $env/dynamic/private, figée par le plugin
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

  it("consumeInvite ajoute un membre et incrémente useCount", async () => {
    const { createServer, createInvite, consumeInvite, listInvites, listMembers } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const friend = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    const res = await consumeInvite(inv.code, friend);
    expect(res).toEqual({ slug: srv.slug, alreadyMember: false });
    expect((await listInvites(srv.id))[0].useCount).toBe(1);
    expect((await listMembers(srv.id)).map((m) => m.userId)).toContain(friend);
  });

  it("consumeInvite est idempotent pour un membre existant (pas de double usage)", async () => {
    const { createServer, createInvite, consumeInvite, listInvites } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const friend = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    await consumeInvite(inv.code, friend);
    const again = await consumeInvite(inv.code, friend);
    expect(again.alreadyMember).toBe(true);
    expect((await listInvites(srv.id))[0].useCount).toBe(1);
  });

  it("consumeInvite refuse une invitation révoquée", async () => {
    const { createServer, createInvite, revokeInvite, consumeInvite, InviteError } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const friend = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    await revokeInvite(inv.code, owner);
    await expect(consumeInvite(inv.code, friend)).rejects.toSatisfy(
      (e: unknown) => e instanceof InviteError && e.code === "invite_revoked",
    );
  });

  it("consumeInvite refuse au-delà de maxUses", async () => {
    const { createServer, createInvite, consumeInvite, InviteError } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const a = await mkUser();
    const b = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, { maxUses: 1 });
    await consumeInvite(inv.code, a);
    await expect(consumeInvite(inv.code, b)).rejects.toSatisfy(
      (e: unknown) => e instanceof InviteError && e.code === "invite_maxed",
    );
  });

  it("consumeInvite refuse une invitation expirée", async () => {
    const { createServer, createInvite, consumeInvite, InviteError } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const friend = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, { expiresAt: new Date(Date.now() - 1000) });
    await expect(consumeInvite(inv.code, friend)).rejects.toSatisfy(
      (e: unknown) => e instanceof InviteError && e.code === "invite_expired",
    );
  });

  it("consumeInvite jette invite_not_found pour un code inconnu", async () => {
    const { consumeInvite, InviteError } = await import("$lib/server/servers");
    const uid = await mkUser();
    await expect(consumeInvite("code-bidon", uid)).rejects.toSatisfy(
      (e: unknown) => e instanceof InviteError && e.code === "invite_not_found",
    );
  });

  it("peekInvite retourne le nom du serveur et la validité", async () => {
    const { createServer, createInvite, peekInvite } = await import("$lib/server/servers");
    const owner = await mkUser();
    const srv = await createServer(owner, "Belle Île");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    const peek = await peekInvite(inv.code);
    expect(peek).toMatchObject({ serverName: "Belle Île", slug: srv.slug, valid: true });
    expect(await peekInvite("nope")).toBeNull();
  });

  it("revokeInvite est refusé à un non-owner", async () => {
    const { createServer, createInvite, consumeInvite, revokeInvite, listInvites } = await import(
      "$lib/server/servers"
    );
    const owner = await mkUser();
    const member = await mkUser();
    const srv = await createServer(owner, "Team");
    createdServerIds.push(srv.id);
    const inv = await createInvite(srv.id, owner, {});
    await consumeInvite(inv.code, member);
    await revokeInvite(inv.code, member); // no-op : member n'est pas owner
    expect((await listInvites(srv.id))[0].revokedAt).toBeNull();
  });
});
