import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lt, sql, or } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { getDb, tables } from "$lib/server/db";

export type ServerSummary = { id: string; slug: string; name: string };
export type Membership = { role: "owner" | "member"; palPlayerGuid: string | null };

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Slug de serveur : 10 caractères base62 (URLs). Léger biais modulo accepté
 *  — l'unicité est garantie par la contrainte UNIQUE + retry (createServer). */
export function generateSlug(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += BASE62[b % 62];
  return out;
}

/** Code d'invitation : 128 bits d'entropie, base64url (22 caractères). */
export function generateInviteCode(): string {
  return randomBytes(16).toString("base64url");
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

export async function listMyServers(userId: string): Promise<ServerSummary[]> {
  const db = getDb();
  return db
    .select({ id: tables.servers.id, slug: tables.servers.slug, name: tables.servers.name })
    .from(tables.serverMembers)
    .innerJoin(tables.servers, eq(tables.serverMembers.serverId, tables.servers.id))
    .where(eq(tables.serverMembers.userId, userId))
    .orderBy(tables.servers.createdAt);
}

/** Garde d'autorisation : à appeler dans CHAQUE load/action/endpoint sous
 *  /s/[slug] et /api/servers/[slug] — les layouts ne protègent pas les actions.
 *  404 (et pas 403) pour ne pas révéler l'existence d'un serveur. */
export async function requireMembership(
  user: { id: string } | null,
  slug: string,
): Promise<{ server: ServerSummary; membership: Membership }> {
  if (!user) error(401);
  const db = getDb();
  const rows = await db
    .select({
      id: tables.servers.id,
      slug: tables.servers.slug,
      name: tables.servers.name,
      role: tables.serverMembers.role,
      palPlayerGuid: tables.serverMembers.palPlayerGuid,
    })
    .from(tables.servers)
    .innerJoin(
      tables.serverMembers,
      and(
        eq(tables.serverMembers.serverId, tables.servers.id),
        eq(tables.serverMembers.userId, user.id),
      ),
    )
    .where(eq(tables.servers.slug, slug));
  const hit = rows[0];
  if (!hit) error(404);
  return {
    server: { id: hit.id, slug: hit.slug, name: hit.name },
    membership: { role: hit.role, palPlayerGuid: hit.palPlayerGuid },
  };
}

/** Garde owner : comme requireMembership mais 404 (et pas 403) si le membre
 *  n'est pas owner — ne révèle ni l'existence du serveur ni le rôle. */
export async function requireOwner(
  user: { id: string } | null,
  slug: string,
): Promise<{ server: ServerSummary; membership: Membership }> {
  const result = await requireMembership(user, slug);
  if (result.membership.role !== "owner") error(404);
  return result;
}

/** Crée un serveur au nom de userId (owner). Limite : 3 serveurs créés par
 *  utilisateur. Slug unique tiré au sort avec retry sur collision.
 *  Sans transactions : insère le serveur puis l'adhésion (onConflictDoNothing,
 *  rejouable). */
export async function createServer(userId: string, name: string): Promise<ServerSummary> {
  const db = getDb();
  const trimmed = name.trim();
  if (trimmed.length === 0) error(400, "Nom de serveur requis");

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tables.servers)
    .where(eq(tables.servers.ownerId, userId));
  if (n >= 3) error(403, "Limite de 3 serveurs créés atteinte");

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    try {
      const [srv] = await db
        .insert(tables.servers)
        .values({ name: trimmed, slug, ownerId: userId })
        .returning({
          id: tables.servers.id,
          slug: tables.servers.slug,
          name: tables.servers.name,
        });
      await db
        .insert(tables.serverMembers)
        .values({ serverId: srv.id, userId, role: "owner" })
        .onConflictDoNothing();
      return srv;
    } catch (err) {
      if (isUniqueViolation(err)) continue; // collision de slug → nouveau tirage
      throw err;
    }
  }
  error(500, "Impossible de générer un slug unique");
}
