import { and, eq, sql } from "drizzle-orm";
import pals from "@palworld-companion/game-data/pals.json";
import tech from "@palworld-companion/game-data/tech.json";
import markers from "@palworld-companion/game-data/markers.json";
import { getDb, tables } from "$lib/server/db";
import type { PageServerLoadEvent } from "./$types";

const TOTALS = {
  pal_caught: (pals as Array<{ id: string }>).length,
  tech_unlocked: (tech as Array<{ id: string }>).length,
  marker: (markers as Array<{ type: string }>).filter((mk) => mk.type === "relic").length,
};

export type MemberStats = {
  id: string;
  username: string;
  avatarUrl: string | null;
  nickname: string | null;
  counts: Record<keyof typeof TOTALS, number>;
};

export async function load({ parent }: PageServerLoadEvent) {
  const { server } = await parent();
  const db = getDb();
  const [perUser, groupRows, [lastRow]] = await Promise.all([
    db
      .select({
        userId: tables.users.id,
        username: tables.users.username,
        avatarUrl: tables.users.avatarUrl,
        nickname: tables.savePlayers.nickname,
        kind: tables.progress.kind,
        n: sql<number>`count(${tables.progress.entityId})::int`,
      })
      .from(tables.serverMembers)
      .innerJoin(tables.users, eq(tables.users.id, tables.serverMembers.userId))
      .leftJoin(
        tables.progress,
        and(
          eq(tables.progress.serverId, tables.serverMembers.serverId),
          eq(tables.progress.userId, tables.serverMembers.userId),
        ),
      )
      .leftJoin(
        tables.savePlayers,
        and(
          eq(tables.savePlayers.serverId, tables.serverMembers.serverId),
          eq(tables.savePlayers.playerGuid, tables.serverMembers.palPlayerGuid),
        ),
      )
      .where(eq(tables.serverMembers.serverId, server.id))
      .groupBy(
        tables.users.id,
        tables.users.username,
        tables.users.avatarUrl,
        tables.savePlayers.nickname,
        tables.progress.kind,
      ),
    db
      .select({
        kind: tables.progress.kind,
        n: sql<number>`count(distinct ${tables.progress.entityId})::int`,
      })
      .from(tables.progress)
      .where(eq(tables.progress.serverId, server.id))
      .groupBy(tables.progress.kind),
    db
      .select({ last: sql<string | null>`max(${tables.saveSnapshots.importedAt})` })
      .from(tables.saveSnapshots)
      .where(eq(tables.saveSnapshots.serverId, server.id)),
  ]);

  const byUser = new Map<string, MemberStats>();
  for (const r of perUser) {
    let entry = byUser.get(r.userId);
    if (!entry) {
      entry = {
        id: r.userId,
        username: r.username,
        avatarUrl: r.avatarUrl,
        nickname: r.nickname,
        counts: { pal_caught: 0, tech_unlocked: 0, marker: 0 },
      };
      byUser.set(r.userId, entry);
    }
    if (r.kind && r.kind in entry.counts) entry.counts[r.kind as keyof typeof TOTALS] = r.n;
  }
  const members = [...byUser.values()].sort((a, b) => b.counts.pal_caught - a.counts.pal_caught);

  const group: Record<keyof typeof TOTALS, number> = { pal_caught: 0, tech_unlocked: 0, marker: 0 };
  for (const r of groupRows) {
    if (r.kind in group) group[r.kind as keyof typeof TOTALS] = r.n;
  }

  return {
    members,
    group,
    totals: TOTALS,
    lastImport: lastRow?.last ?? null,
  };
}
