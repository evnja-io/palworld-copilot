import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";

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

/** Liste les GUIDs de sauvegarde connus, regroupés avec leurs stats par kind. */
export async function listSnapshots(): Promise<SnapshotSummary[]> {
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
    .leftJoin(tables.users, eq(tables.users.palPlayerGuid, tables.saveSnapshots.playerGuid))
    .leftJoin(tables.savePlayers, eq(tables.savePlayers.playerGuid, tables.saveSnapshots.playerGuid))
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

/** Revendique guid pour userId puis fusionne additivement ses kinds officiels vers progress. */
export async function claimGuid(userId: string, guid: string): Promise<void> {
  const db = getDb();
  const known = await db
    .select({ playerGuid: tables.saveSnapshots.playerGuid })
    .from(tables.saveSnapshots)
    .where(eq(tables.saveSnapshots.playerGuid, guid))
    .limit(1);
  if (known.length === 0) throw new ClaimError("guid_unknown");
  try {
    const updated = await db
      .update(tables.users)
      .set({ palPlayerGuid: guid })
      .where(and(eq(tables.users.id, userId), isNull(tables.users.palPlayerGuid)))
      .returning();
    if (updated.length === 0) throw new ClaimError("already_claimed_user");
  } catch (err) {
    if (err instanceof ClaimError) throw err;
    if (isUniqueViolation(err)) throw new ClaimError("guid_taken");
    throw err;
  }
  await db.execute(sql`
    insert into progress (user_id, kind, entity_id)
    select ${userId}, kind, entity_id from save_snapshots
    where player_guid = ${guid} and kind in ('pal_caught', 'tech_unlocked')
    on conflict do nothing`);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "23505";
}
