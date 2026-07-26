import { and, asc, eq } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";
import type { PalInstance } from "$lib/server/pals";

/** Membre de guilde avec identité résolue (voir chaîne de fallback ci-dessous). */
export type GuildMemberView = {
  playerGuid: string;
  name: string;
  userId: string | null;
  avatarUrl: string | null;
};

/** Pal assigné à une base : instance save_pals + propriétaire + slot. */
export type AssignedPal = PalInstance & { ownerGuid: string; slotIndex: number };

/** Base d'une guilde : pals assignés, capacité et profil de demande. */
export type GuildBaseView = {
  baseId: string;
  name: string | null;
  worldX: number | null;
  worldY: number | null;
  slotCount: number | null;
  assigned: AssignedPal[];
  unresolvedCount: number;
  demands: Array<{ workType: string; weight: number }>;
};

/** Guilde importée : membres et bases assemblés côté serveur. */
export type GuildView = {
  guildId: string;
  name: string | null;
  baseCampLevel: number;
  adminPlayerGuid: string | null;
  members: GuildMemberView[];
  bases: GuildBaseView[];
};

/** Guildes -> bases -> pals assignés (+ demandes) du serveur. Visibilité : tous les
 *  membres (garde requireMembership via le layout, comme listPalInstances).
 *  4 requêtes scopées serveur puis assemblage en JS (pas de méga-jointure).
 *  Identité membre : username revendiqué > pseudo in-game (save_players) >
 *  nom porté par la save de guilde (save_guild_members.player_name) > GUID
 *  tronqué (8 chars + …). last_online_ticks volontairement non sélectionné
 *  (bigint non sérialisable, non-objectif v1). */
export async function listGuildBases(serverId: string): Promise<GuildView[]> {
  const db = getDb();

  // 1. Guildes du serveur, triées par nom (NULLs en dernier côté Postgres).
  const guildRows = await db
    .select({
      guildId: tables.saveGuilds.guildId,
      name: tables.saveGuilds.name,
      baseCampLevel: tables.saveGuilds.baseCampLevel,
      adminPlayerGuid: tables.saveGuilds.adminPlayerGuid,
    })
    .from(tables.saveGuilds)
    .where(eq(tables.saveGuilds.serverId, serverId))
    .orderBy(asc(tables.saveGuilds.name));

  // 2. Membres + résolution d'identité, même idiome que listPalInstances :
  //    pas de fan-out, (server_id, pal_player_guid) est unique côté
  //    server_members et (server_id, player_guid) est la PK de save_players.
  const memberRows = await db
    .select({
      guildId: tables.saveGuildMembers.guildId,
      playerGuid: tables.saveGuildMembers.playerGuid,
      playerName: tables.saveGuildMembers.playerName,
      userId: tables.users.id,
      username: tables.users.username,
      avatarUrl: tables.users.avatarUrl,
      playerNickname: tables.savePlayers.nickname,
    })
    .from(tables.saveGuildMembers)
    .leftJoin(
      tables.serverMembers,
      and(
        eq(tables.serverMembers.serverId, tables.saveGuildMembers.serverId),
        eq(tables.serverMembers.palPlayerGuid, tables.saveGuildMembers.playerGuid),
      ),
    )
    .leftJoin(tables.users, eq(tables.users.id, tables.serverMembers.userId))
    .leftJoin(
      tables.savePlayers,
      and(
        eq(tables.savePlayers.serverId, tables.saveGuildMembers.serverId),
        eq(tables.savePlayers.playerGuid, tables.saveGuildMembers.playerGuid),
      ),
    )
    .where(eq(tables.saveGuildMembers.serverId, serverId));

  // 3. Bases + affectations (LEFT) + instance save_pals (LEFT). Une affectation
  //    sans ligne save_pals (espèce inconnue, pal sauvage) alimente
  //    unresolvedCount au lieu d'être listée.
  const baseRows = await db
    .select({
      baseId: tables.saveBases.baseId,
      guildId: tables.saveBases.guildId,
      name: tables.saveBases.name,
      worldX: tables.saveBases.worldX,
      worldY: tables.saveBases.worldY,
      slotCount: tables.saveBases.slotCount,
      assignedInstanceId: tables.savePalAssignments.instanceId,
      slotIndex: tables.savePalAssignments.slotIndex,
      palInstanceId: tables.savePals.instanceId,
      palId: tables.savePals.palId,
      ownerGuid: tables.savePals.ownerGuid,
      gender: tables.savePals.gender,
      level: tables.savePals.level,
      nickname: tables.savePals.nickname,
      passives: tables.savePals.passives,
      talentHp: tables.savePals.talentHp,
      talentShot: tables.savePals.talentShot,
      talentDefense: tables.savePals.talentDefense,
    })
    .from(tables.saveBases)
    .leftJoin(
      tables.savePalAssignments,
      and(
        eq(tables.savePalAssignments.serverId, tables.saveBases.serverId),
        eq(tables.savePalAssignments.baseId, tables.saveBases.baseId),
      ),
    )
    .leftJoin(
      tables.savePals,
      and(
        eq(tables.savePals.serverId, tables.saveBases.serverId),
        eq(tables.savePals.instanceId, tables.savePalAssignments.instanceId),
      ),
    )
    .where(eq(tables.saveBases.serverId, serverId))
    .orderBy(asc(tables.saveBases.baseId), asc(tables.savePalAssignments.slotIndex));

  // 4. Profils de demande (config utilisateur, jamais touchée par l'import).
  const demandRows = await db
    .select({
      baseId: tables.baseDemands.baseId,
      workType: tables.baseDemands.workType,
      weight: tables.baseDemands.weight,
    })
    .from(tables.baseDemands)
    .where(eq(tables.baseDemands.serverId, serverId))
    .orderBy(asc(tables.baseDemands.baseId), asc(tables.baseDemands.workType));

  // Assemblage : guildes dans l'ordre de la requête (nom asc).
  const byGuildId = new Map<string, GuildView>();
  for (const g of guildRows) {
    byGuildId.set(g.guildId, {
      guildId: g.guildId,
      name: g.name,
      baseCampLevel: g.baseCampLevel,
      adminPlayerGuid: g.adminPlayerGuid,
      members: [],
      bases: [],
    });
  }

  // Membres : chaîne d'identité puis tri par nom d'affichage (stabilité UI).
  for (const m of memberRows) {
    const guild = byGuildId.get(m.guildId);
    if (!guild) continue; // membre d'une guilde absente de save_guilds : ignoré
    guild.members.push({
      playerGuid: m.playerGuid,
      name: m.username ?? m.playerNickname ?? m.playerName ?? `${m.playerGuid.slice(0, 8)}…`,
      userId: m.userId,
      avatarUrl: m.avatarUrl,
    });
  }
  for (const guild of byGuildId.values())
    guild.members.sort((a, b) => a.name.localeCompare(b.name));

  // Bases : les lignes arrivent contiguës par base_id, slot_index asc.
  const byBaseId = new Map<string, GuildBaseView>();
  for (const r of baseRows) {
    let base = byBaseId.get(r.baseId);
    if (!base) {
      base = {
        baseId: r.baseId,
        name: r.name,
        worldX: r.worldX,
        worldY: r.worldY,
        slotCount: r.slotCount,
        assigned: [],
        unresolvedCount: 0,
        demands: [],
      };
      byBaseId.set(r.baseId, base);
      byGuildId.get(r.guildId)?.bases.push(base); // base orpheline de guilde : ignorée
    }
    if (r.assignedInstanceId === null) continue; // base sans affectation (LEFT JOIN)
    if (r.palInstanceId === null || r.palId === null || r.ownerGuid === null) {
      base.unresolvedCount += 1; // affectation sans instance dans save_pals
      continue;
    }
    base.assigned.push({
      instanceId: r.palInstanceId,
      palId: r.palId,
      gender: r.gender,
      level: r.level ?? 1,
      nickname: r.nickname,
      passives: r.passives ?? [],
      talentHp: r.talentHp,
      talentShot: r.talentShot,
      talentDefense: r.talentDefense,
      ownerGuid: r.ownerGuid,
      slotIndex: r.slotIndex ?? 0,
    });
  }

  for (const d of demandRows)
    byBaseId.get(d.baseId)?.demands.push({ workType: d.workType, weight: d.weight });

  return [...byGuildId.values()];
}

/** Upsert d'un poids de demande ; false si la base n'existe pas sur ce serveur
 *  (la validation workType/weight reste côté endpoint). */
export async function setBaseDemand(
  serverId: string,
  baseId: string,
  workType: string,
  weight: number,
): Promise<boolean> {
  const db = getDb();
  const exists = await db
    .select({ baseId: tables.saveBases.baseId })
    .from(tables.saveBases)
    .where(and(eq(tables.saveBases.serverId, serverId), eq(tables.saveBases.baseId, baseId)))
    .limit(1);
  if (exists.length === 0) return false;
  await db
    .insert(tables.baseDemands)
    .values({ serverId, baseId, workType, weight })
    .onConflictDoUpdate({
      target: [tables.baseDemands.serverId, tables.baseDemands.baseId, tables.baseDemands.workType],
      set: { weight, updatedAt: new Date() },
    });
  return true;
}
