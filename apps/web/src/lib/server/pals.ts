import { and, asc, desc, eq, ne } from "drizzle-orm";
import { getDb, tables } from "$lib/server/db";

// Travailleurs de base sans propriétaire (owner_guid = GUID nul, cf.
// extract-pals-lib) : exclus des groupes par propriétaire — ils apparaissent
// sur la page Bases via save_pal_assignments, pas dans les sélecteurs membre.
const ZERO_GUID = "0".repeat(32);

/** Instance individuelle de Pal importée de Level.sav (ligne save_pals). */
export type PalInstance = {
  instanceId: string;
  palId: string;
  gender: "male" | "female" | null;
  level: number;
  nickname: string | null;
  passives: string[];
  talentHp: number | null;
  talentShot: number | null;
  talentDefense: number | null;
};

/** Propriétaire (GUID de joueur du monde) et ses instances, triées level desc.
 *  userId/avatarUrl null tant que le GUID n'est pas revendiqué. */
export type PalOwner = {
  guid: string;
  name: string;
  userId: string | null;
  avatarUrl: string | null;
  instances: PalInstance[];
};

/** Tous les Pals importés du serveur, groupés par propriétaire - visibilité :
 *  tous les membres (décision produit, garde requireMembership via le layout).
 *  name : username revendiqué > pseudo in-game (save_players) > GUID tronqué
 *  (8 chars + …).
 *  Hypothèse de volume : serveur coop ≤ quelques milliers d'instances →
 *  chargement complet (~1 Mo JSON max), pas de pagination ; à paginer si un
 *  serveur dépasse. */
export async function listPalInstances(serverId: string): Promise<PalOwner[]> {
  const db = getDb();
  // Une seule requête : save_pals + identité du propriétaire (membre revendiqué
  // et/ou pseudo in-game). Pas de fan-out : (server_id, pal_player_guid) est
  // unique côté server_members, (server_id, player_guid) est la PK de
  // save_players.
  const rows = await db
    .select({
      instanceId: tables.savePals.instanceId,
      ownerGuid: tables.savePals.ownerGuid,
      palId: tables.savePals.palId,
      gender: tables.savePals.gender,
      level: tables.savePals.level,
      nickname: tables.savePals.nickname,
      passives: tables.savePals.passives,
      talentHp: tables.savePals.talentHp,
      talentShot: tables.savePals.talentShot,
      talentDefense: tables.savePals.talentDefense,
      userId: tables.users.id,
      username: tables.users.username,
      avatarUrl: tables.users.avatarUrl,
      playerNickname: tables.savePlayers.nickname,
    })
    .from(tables.savePals)
    .leftJoin(
      tables.serverMembers,
      and(
        eq(tables.serverMembers.serverId, tables.savePals.serverId),
        eq(tables.serverMembers.palPlayerGuid, tables.savePals.ownerGuid),
      ),
    )
    .leftJoin(tables.users, eq(tables.users.id, tables.serverMembers.userId))
    .leftJoin(
      tables.savePlayers,
      and(
        eq(tables.savePlayers.serverId, tables.savePals.serverId),
        eq(tables.savePlayers.playerGuid, tables.savePals.ownerGuid),
      ),
    )
    .where(
      and(eq(tables.savePals.serverId, serverId), ne(tables.savePals.ownerGuid, ZERO_GUID)),
    )
    .orderBy(asc(tables.savePals.ownerGuid), desc(tables.savePals.level));

  // Groupage en JS : les lignes arrivent contiguës par owner_guid, level desc.
  const byGuid = new Map<string, PalOwner>();
  for (const r of rows) {
    let owner = byGuid.get(r.ownerGuid);
    if (!owner) {
      owner = {
        guid: r.ownerGuid,
        name: r.username ?? r.playerNickname ?? `${r.ownerGuid.slice(0, 8)}…`,
        userId: r.userId,
        avatarUrl: r.avatarUrl,
        instances: [],
      };
      byGuid.set(r.ownerGuid, owner);
    }
    owner.instances.push({
      instanceId: r.instanceId,
      palId: r.palId,
      gender: r.gender,
      level: r.level,
      nickname: r.nickname,
      passives: r.passives,
      talentHp: r.talentHp,
      talentShot: r.talentShot,
      talentDefense: r.talentDefense,
    });
  }
  return [...byGuid.values()].sort((a, b) => a.name.localeCompare(b.name));
}
