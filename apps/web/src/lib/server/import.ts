import { and, eq, isNull, or, sql } from "drizzle-orm";
import markers from "@palworld-companion/game-data/markers.json";
import { getDb, tables } from "$lib/server/db";

const RELIC_IDS = (markers as Array<{ id: string; type: string }>)
  .filter((mk) => mk.type === "relic")
  .map((mk) => mk.id);

export type SnapshotSummary = {
  guid: string;
  nickname: string | null;
  kinds: Record<string, number>;
  claimedBy: string | null;
  lastImport: string;
};

export type ClaimErrorCode = "already_claimed_user" | "guid_taken" | "guid_unknown";

/** Erreur avec code traduisible. */
export class ClaimError extends Error {
  constructor(
    public code: ClaimErrorCode,
    message?: string
  ) {
    super(message);
  }
}

/** Liste les GUIDs de sauvegarde connus pour un serveur, regroupés avec leurs
 *  stats par kind. */
export async function listSnapshots(serverId: string): Promise<SnapshotSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      playerGuid: tables.saveSnapshots.playerGuid,
      kind: tables.saveSnapshots.kind,
      count: sql<number>`count(*)::int`,
      lastImport: sql<string>`max(${tables.saveSnapshots.importedAt})`,
      claimedBy: tables.users.username,
      nickname: tables.savePlayers.nickname,
    })
    .from(tables.saveSnapshots)
    .leftJoin(
      tables.serverMembers,
      and(
        eq(tables.serverMembers.serverId, tables.saveSnapshots.serverId),
        eq(tables.serverMembers.palPlayerGuid, tables.saveSnapshots.playerGuid),
      ),
    )
    .leftJoin(tables.users, eq(tables.users.id, tables.serverMembers.userId))
    .leftJoin(
      tables.savePlayers,
      and(
        eq(tables.savePlayers.serverId, tables.saveSnapshots.serverId),
        eq(tables.savePlayers.playerGuid, tables.saveSnapshots.playerGuid),
      ),
    )
    .where(eq(tables.saveSnapshots.serverId, serverId))
    .groupBy(
      tables.saveSnapshots.playerGuid,
      tables.saveSnapshots.kind,
      tables.users.username,
      tables.savePlayers.nickname,
    );

  const byGuid = new Map<string, SnapshotSummary>();
  for (const r of rows) {
    let entry = byGuid.get(r.playerGuid);
    if (!entry) {
      entry = {
        guid: r.playerGuid,
        nickname: r.nickname,
        kinds: {},
        claimedBy: r.claimedBy,
        lastImport: r.lastImport,
      };
      byGuid.set(r.playerGuid, entry);
    }
    entry.kinds[r.kind] = r.count;
    if (new Date(r.lastImport) > new Date(entry.lastImport)) entry.lastImport = r.lastImport;
    if (r.claimedBy) entry.claimedBy = r.claimedBy;
  }
  return [...byGuid.values()].sort((a, b) => a.guid.localeCompare(b.guid));
}

/** Revendique guid pour (serverId, userId) puis fusionne additivement ses
 *  kinds officiels vers progress. Rejouable : re-revendiquer son propre GUID
 *  est permis (pas de transactions avec neon-http). */
export async function claimGuid(serverId: string, userId: string, guid: string): Promise<void> {
  const db = getDb();
  const known = await db
    .select({ playerGuid: tables.saveSnapshots.playerGuid })
    .from(tables.saveSnapshots)
    .where(
      and(eq(tables.saveSnapshots.serverId, serverId), eq(tables.saveSnapshots.playerGuid, guid)),
    )
    .limit(1);
  if (known.length === 0) throw new ClaimError("guid_unknown");
  try {
    // La ligne d'adhésion existe forcément : requireMembership est passé avant.
    const updated = await db
      .update(tables.serverMembers)
      .set({ palPlayerGuid: guid })
      .where(
        and(
          eq(tables.serverMembers.serverId, serverId),
          eq(tables.serverMembers.userId, userId),
          or(
            isNull(tables.serverMembers.palPlayerGuid),
            eq(tables.serverMembers.palPlayerGuid, guid),
          ),
        ),
      )
      .returning();
    if (updated.length === 0) throw new ClaimError("already_claimed_user");
  } catch (err) {
    if (err instanceof ClaimError) throw err;
    if (isUniqueViolation(err)) throw new ClaimError("guid_taken");
    throw err;
  }
  // string_to_array : cf. contrainte globale drizzle+neon-http.
  await db.execute(sql`
    insert into progress (server_id, user_id, kind, entity_id)
    select ${serverId}::uuid, ${userId}::uuid, kind, entity_id from save_snapshots
    where server_id = ${serverId}::uuid and player_guid = ${guid}
      and kind in ('pal_caught', 'tech_unlocked')
    union
    select ${serverId}::uuid, ${userId}::uuid, 'marker', 'relic_' || entity_id from save_snapshots
    where server_id = ${serverId}::uuid and player_guid = ${guid} and kind = 'raw:relic'
      and ('relic_' || entity_id) = any(string_to_array(${RELIC_IDS.join(",")}, ','))
    on conflict do nothing`);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}
