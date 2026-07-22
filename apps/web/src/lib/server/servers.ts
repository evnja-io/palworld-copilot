import { and, eq } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { getDb, tables } from "$lib/server/db";

export type ServerSummary = { id: string; slug: string; name: string };
export type Membership = { role: "owner" | "member"; palPlayerGuid: string | null };

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
