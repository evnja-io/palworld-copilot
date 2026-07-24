import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lt, sql, or } from "drizzle-orm";
import { error } from "@sveltejs/kit";
import { getDb, tables } from "$lib/server/db";

export type ServerSummary = { id: string; slug: string; name: string };
export type Membership = { role: "owner" | "member"; palPlayerGuid: string | null };

export type InviteErrorCode =
  | "invite_not_found"
  | "invite_revoked"
  | "invite_expired"
  | "invite_maxed";

/** Erreur d'invitation avec code traduisible (mappé côté route/i18n). */
export class InviteError extends Error {
  constructor(
    public code: InviteErrorCode,
    message?: string,
  ) {
    super(message);
  }
}

export type Invite = {
  code: string;
  serverId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  maxUses: number | null;
  useCount: number;
};

export type MemberSummary = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: Date;
};

export type ConsumeResult = { slug: string; alreadyMember: boolean };
export type InvitePeek = {
  serverName: string;
  slug: string;
  valid: boolean;
  reason: InviteErrorCode | null;
};

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Slug de serveur : 10 caractères base62 (URLs). Léger biais modulo accepté
 *  - l'unicité est garantie par la contrainte UNIQUE + retry (createServer). */
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
 *  /s/[slug] et /api/servers/[slug] - les layouts ne protègent pas les actions.
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
 *  n'est pas owner - ne révèle ni l'existence du serveur ni le rôle. */
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

export type NewInviteOptions = { expiresAt?: Date | null; maxUses?: number | null };

/** Crée une invitation pour serverId (createdBy = userId). */
export async function createInvite(
  serverId: string,
  userId: string,
  opts: NewInviteOptions = {},
): Promise<Invite> {
  const db = getDb();
  const [inv] = await db
    .insert(tables.invites)
    .values({
      code: generateInviteCode(),
      serverId,
      createdBy: userId,
      expiresAt: opts.expiresAt ?? null,
      maxUses: opts.maxUses ?? null,
    })
    .returning();
  return inv;
}

export async function listInvites(serverId: string): Promise<Invite[]> {
  const db = getDb();
  return db
    .select()
    .from(tables.invites)
    .where(eq(tables.invites.serverId, serverId))
    .orderBy(desc(tables.invites.createdAt));
}

export async function listMembers(serverId: string): Promise<MemberSummary[]> {
  const db = getDb();
  return db
    .select({
      userId: tables.serverMembers.userId,
      username: tables.users.username,
      avatarUrl: tables.users.avatarUrl,
      role: tables.serverMembers.role,
      joinedAt: tables.serverMembers.joinedAt,
    })
    .from(tables.serverMembers)
    .innerJoin(tables.users, eq(tables.users.id, tables.serverMembers.userId))
    .where(eq(tables.serverMembers.serverId, serverId))
    .orderBy(tables.serverMembers.joinedAt);
}

/** Révoque une invitation. Owner-only : la clause WHERE limite aux serveurs
 *  dont userId est owner (défense en profondeur). Idempotent (no-op si déjà
 *  révoquée ou non-owner). */
export async function revokeInvite(code: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(tables.invites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(tables.invites.code, code),
        isNull(tables.invites.revokedAt),
        inArray(
          tables.invites.serverId,
          db
            .select({ id: tables.serverMembers.serverId })
            .from(tables.serverMembers)
            .where(
              and(
                eq(tables.serverMembers.userId, userId),
                eq(tables.serverMembers.role, "owner"),
              ),
            ),
        ),
      ),
    );
}

/** Lecture non-consommante : nom du serveur + validité de l'invitation, pour
 *  l'écran /join/[code]. */
export async function peekInvite(code: string): Promise<InvitePeek | null> {
  const db = getDb();
  const rows = await db
    .select({
      serverName: tables.servers.name,
      slug: tables.servers.slug,
      revokedAt: tables.invites.revokedAt,
      expiresAt: tables.invites.expiresAt,
      maxUses: tables.invites.maxUses,
      useCount: tables.invites.useCount,
    })
    .from(tables.invites)
    .innerJoin(tables.servers, eq(tables.servers.id, tables.invites.serverId))
    .where(eq(tables.invites.code, code));
  const inv = rows[0];
  if (!inv) return null;
  let reason: InviteErrorCode | null = null;
  if (inv.revokedAt) reason = "invite_revoked";
  else if (inv.expiresAt && new Date(inv.expiresAt) <= new Date()) reason = "invite_expired";
  else if (inv.maxUses !== null && inv.useCount >= inv.maxUses) reason = "invite_maxed";
  return { serverName: inv.serverName, slug: inv.slug, valid: reason === null, reason };
}

/** Consomme une invitation : ajoute userId comme membre et incrémente useCount.
 *  Garde de concurrence sans transaction : l'UPDATE atomique n'incrémente que
 *  si l'invitation est valide (non révoquée, non expirée, quota non atteint).
 *  Déjà membre → aucun usage consommé (retour alreadyMember). */
export async function consumeInvite(code: string, userId: string): Promise<ConsumeResult> {
  const db = getDb();

  // 1. Résoudre l'invitation (serveur cible + diagnostic d'erreur).
  const found = await db
    .select({
      serverId: tables.invites.serverId,
      slug: tables.servers.slug,
      revokedAt: tables.invites.revokedAt,
      expiresAt: tables.invites.expiresAt,
    })
    .from(tables.invites)
    .innerJoin(tables.servers, eq(tables.servers.id, tables.invites.serverId))
    .where(eq(tables.invites.code, code));
  const inv = found[0];
  if (!inv) throw new InviteError("invite_not_found");

  // 2. Déjà membre ? Ne pas consommer d'usage.
  const existing = await db
    .select({ userId: tables.serverMembers.userId })
    .from(tables.serverMembers)
    .where(
      and(
        eq(tables.serverMembers.serverId, inv.serverId),
        eq(tables.serverMembers.userId, userId),
      ),
    );
  if (existing.length > 0) return { slug: inv.slug, alreadyMember: true };

  // 3. Consommation atomique - équivaut à :
  //    UPDATE invites SET use_count = use_count + 1
  //    WHERE code = $1 AND revoked_at IS NULL
  //      AND (expires_at IS NULL OR expires_at > now())
  //      AND (max_uses IS NULL OR use_count < max_uses)
  //    RETURNING server_id
  const consumed = await db
    .update(tables.invites)
    .set({ useCount: sql`${tables.invites.useCount} + 1` })
    .where(
      and(
        eq(tables.invites.code, code),
        isNull(tables.invites.revokedAt),
        or(isNull(tables.invites.expiresAt), gt(tables.invites.expiresAt, new Date())),
        or(isNull(tables.invites.maxUses), lt(tables.invites.useCount, tables.invites.maxUses)),
      ),
    )
    .returning({ serverId: tables.invites.serverId });

  if (consumed.length === 0) {
    // Diagnostiquer la raison exacte du refus.
    if (inv.revokedAt) throw new InviteError("invite_revoked");
    if (inv.expiresAt && new Date(inv.expiresAt) <= new Date())
      throw new InviteError("invite_expired");
    throw new InviteError("invite_maxed");
  }

  // 4. Adhésion (rejouable).
  await db
    .insert(tables.serverMembers)
    .values({ serverId: inv.serverId, userId, role: "member" })
    .onConflictDoNothing();

  return { slug: inv.slug, alreadyMember: false };
}
