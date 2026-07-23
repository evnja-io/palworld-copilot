import { and, eq } from "drizzle-orm";
import pals from "@palworld-companion/game-data/pals.json";
import tech from "@palworld-companion/game-data/tech.json";
import markers from "@palworld-companion/game-data/markers.json";
import { getDb, tables } from "$lib/server/db";
import type { GroupUser } from "$lib/types";

// Registre des kinds autorisés -> IDs valides. Les phases suivantes ajoutent
// tech_unlocked (tech.json) et marker (markers/*.json) ICI, nulle part ailleurs.
const REGISTRY: Record<string, Set<string>> = {
  pal_caught: new Set((pals as Array<{ id: string }>).map((p) => p.id)),
  tech_unlocked: new Set((tech as Array<{ id: string }>).map((t) => t.id)),
  // Seules les effigies sont cochables — boss et voyages rapides sont des repères.
  marker: new Set(
    (markers as Array<{ id: string; type: string }>)
      .filter((mk) => mk.type === "relic")
      .map((mk) => mk.id),
  ),
};

export function isValidEntity(kind: string, entityId: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRY, kind) && REGISTRY[kind].has(entityId);
}

export function isValidKind(kind: string): boolean {
  return Object.prototype.hasOwnProperty.call(REGISTRY, kind);
}

export async function setProgress(
  serverId: string,
  userId: string,
  kind: string,
  entityId: string,
  checked: boolean,
) {
  const db = getDb();
  if (checked) {
    await db
      .insert(tables.progress)
      .values({ serverId, userId, kind, entityId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(tables.progress)
      .where(
        and(
          eq(tables.progress.serverId, serverId),
          eq(tables.progress.userId, userId),
          eq(tables.progress.kind, kind),
          eq(tables.progress.entityId, entityId),
        ),
      );
  }
}

export async function getProgress(serverId: string, kind: string, myUserId: string) {
  const db = getDb();
  const rows = await db
    .select({
      entityId: tables.progress.entityId,
      userId: tables.users.id,
      username: tables.users.username,
      avatarUrl: tables.users.avatarUrl,
    })
    .from(tables.progress)
    .innerJoin(tables.users, eq(tables.progress.userId, tables.users.id))
    .where(and(eq(tables.progress.serverId, serverId), eq(tables.progress.kind, kind)));
  const mine: string[] = [];
  const group: Record<string, GroupUser[]> = {};
  for (const r of rows) {
    (group[r.entityId] ??= []).push({ id: r.userId, username: r.username, avatarUrl: r.avatarUrl });
    if (r.userId === myUserId) mine.push(r.entityId);
  }
  return { mine, group };
}
