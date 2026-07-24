// Corps réutilisables de l'import (appelés par les coques CLI import-save.ts /
// extract-players.ts et par le worker fan-out import-all.ts). Refactor pur :
// le SQL est repris tel quel de l'existant (client neon() brut, sans transactions
// interactives ; tableaux ${arr}::text[] acceptés par ce client).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { extractPalInstances } from "./extract-pals-lib.ts";

type Sql = NeonQueryFunction<false, false>;
export type ImportStats = {
  files: number;
  pals: number;
  techs: number;
  relics: number;
  merged: number;
  unclaimed: number;
  failures: number;
};

const venvPython = new URL("../.venv/bin/python", import.meta.url).pathname;

function requireVenv(): void {
  if (!existsSync(venvPython)) throw new Error("venv palsav absent - cf. runbook, section saves");
}

/** UUID "00afd495-0000-…" -> "00AFD495000000000000000000000000". */
export function normalizeGuid(uuid: string): string {
  return uuid.replaceAll("-", "").toUpperCase();
}

/** Extraction pure d'une save JSON convertie -> lignes de snapshot. */
export function computeSnapshotRows(
  save: any,
  palIdsLower: Map<string, string>,
  techIdsLower: Map<string, string>,
): Array<{ kind: string; id: string }> {
  const sd = save.properties.SaveData.value;
  const rd = sd.RecordData.value;

  const paldeckEntries = ((rd.PaldeckUnlockFlag?.value ?? []) as Array<{ key: string; value: boolean }>)
    .filter((entry) => entry.value === true)
    .map((entry) => entry.key);
  const pals = [
    ...new Set(
      paldeckEntries
        .map((id) => palIdsLower.get(id.toLowerCase()))
        .filter((id): id is string => id !== undefined),
    ),
  ];

  const techEntries = (sd.UnlockedRecipeTechnologyNames?.value?.values ?? []) as string[];
  const techs = [
    ...new Set(
      techEntries
        .map((id) => techIdsLower.get(id.toLowerCase()))
        .filter((id): id is string => id !== undefined),
    ),
  ];

  const relicEntries = (
    (rd.RelicObtainForInstanceFlag?.value ?? []) as Array<{ key: string; value: boolean }>
  )
    .filter((entry) => entry.value === true)
    .map((entry) => entry.key.replaceAll("-", "").toLowerCase());
  const relics = [...new Set(relicEntries)];

  return [
    ...pals.map((id) => ({ kind: "pal_caught", id })),
    ...techs.map((id) => ({ kind: "tech_unlocked", id })),
    ...relics.map((id) => ({ kind: "raw:relic", id })),
  ];
}

/** Importe les Players/*.sav d'un dossier vers save_snapshots + fusion progress. */
export async function importPlayerSaves(sql: Sql, serverId: string, dir: string): Promise<ImportStats> {
  requireVenv();

  const palIdsLower = new Map<string, string>(
    (JSON.parse(
      readFileSync(new URL("../../game-data/pals.json", import.meta.url).pathname, "utf8"),
    ) as Array<{ id: string }>).map((p) => [p.id.toLowerCase(), p.id]),
  );
  const techIdsLower = new Map<string, string>(
    (JSON.parse(
      readFileSync(new URL("../../game-data/tech.json", import.meta.url).pathname, "utf8"),
    ) as Array<{ id: string }>).map((t) => [t.id.toLowerCase(), t.id]),
  );

  const allSavs = readdirSync(dir).filter((f) => f.endsWith(".sav"));
  if (allSavs.length === 0) throw new Error(`Aucun .sav dans ${dir}`);
  const guidFilePattern = /^[0-9A-Fa-f]{32}\.sav$/;
  const savs = allSavs.filter((f) => {
    if (guidFilePattern.test(f)) return true;
    console.log(`ignoré : ${f}`);
    return false;
  });

  const failures: Array<{ file: string; message: string }> = [];
  let palCount = 0;
  let techCount = 0;
  let relicCount = 0;

  for (const sav of savs) {
    try {
      const guid = basename(sav, ".sav");
      const jsonPath = join(dir, `${guid}.sav.json`);
      execFileSync(venvPython, [
        "-m",
        "palsav.commands.convert",
        join(dir, sav),
        "--to-json",
        "-o",
        jsonPath,
        "--force",
      ]);
      const save = JSON.parse(readFileSync(jsonPath, "utf8"));
      const rows = computeSnapshotRows(save, palIdsLower, techIdsLower);
      const pals = rows.filter((r) => r.kind === "pal_caught").length;
      const techs = rows.filter((r) => r.kind === "tech_unlocked").length;
      const relics = rows.filter((r) => r.kind === "raw:relic").length;
      palCount += pals;
      techCount += techs;
      relicCount += relics;

      const kinds = rows.map((r) => r.kind);
      const ids = rows.map((r) => r.id);
      await sql.transaction([
        sql.query("delete from save_snapshots where server_id = $2::uuid and player_guid = $1", [
          guid,
          serverId,
        ]),
        sql.query(
          `insert into save_snapshots (server_id, player_guid, kind, entity_id)
           select $4::uuid, $1, k, e from unnest($2::text[], $3::text[]) as t(k, e)
           on conflict do nothing`,
          [guid, kinds, ids, serverId],
        ),
      ]);
      console.log(`${guid} : ${pals} pals, ${techs} techs, ${relics} effigies (snapshot)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`ÉCHEC ${sav} : ${message}`);
      failures.push({ file: sav, message });
    }
  }

  // Fusion additive vers progress (kinds directs + reliques présentes dans markers.json).
  const markersJson = JSON.parse(
    readFileSync(new URL("../../game-data/markers.json", import.meta.url).pathname, "utf8"),
  ) as Array<{ id: string; type: string }>;
  const relicIds = markersJson.filter((mk) => mk.type === "relic").map((mk) => mk.id);
  const merged = await sql`
    insert into progress (server_id, user_id, kind, entity_id)
    select s.server_id, m.user_id, s.kind, s.entity_id
    from save_snapshots s
    join server_members m on m.server_id = s.server_id and m.pal_player_guid = s.player_guid
    where s.server_id = ${serverId}::uuid and s.kind in ('pal_caught', 'tech_unlocked')
    union
    select s.server_id, m.user_id, 'marker', 'relic_' || s.entity_id
    from save_snapshots s
    join server_members m on m.server_id = s.server_id and m.pal_player_guid = s.player_guid
    where s.server_id = ${serverId}::uuid and s.kind = 'raw:relic'
      and ('relic_' || s.entity_id) = any(${relicIds}::text[])
    on conflict do nothing
    returning user_id`;
  console.log(`fusion : ${merged.length} nouvelles coches appliquées`);

  const unclaimed = await sql`
    select s.player_guid, count(*) as n from save_snapshots s
    left join server_members m
      on m.server_id = s.server_id and m.pal_player_guid = s.player_guid
    where s.server_id = ${serverId}::uuid and m.user_id is null
    group by s.player_guid`;
  for (const r of unclaimed) {
    console.log(`non revendiqué : ${r.player_guid} (${r.n} entrées) - page /import`);
  }

  // Récapitulatif des échecs - repris de l'original (perdu par erreur dans le refactor initial).
  if (failures.length > 0) {
    console.error(`\n${failures.length} fichier(s) en échec :`);
    for (const f of failures) console.error(`  - ${f.file} : ${f.message}`);
  }

  return {
    files: savs.length,
    pals: palCount,
    techs: techCount,
    relics: relicCount,
    merged: merged.length,
    unclaimed: unclaimed.length,
    failures: failures.length,
  };
}

/** Convertit Level.sav en JSON temporaire (supprimé après parse) et retourne
 *  CharacterSaveParameterMap.value. Une seule conversion pour les deux syncs
 *  qui en dépendent (pseudos + instances de Pals) : le JSON fait ~170 Mo. */
export function loadLevelCmap(dir: string): any[] {
  requireVenv();
  if (!existsSync(join(dir, "Level.sav"))) throw new Error(`Level.sav absent de ${dir}`);

  const jsonPath = join(dir, "level.sav.json");
  execFileSync(venvPython, [
    "-m",
    "palsav.commands.convert",
    join(dir, "Level.sav"),
    "--to-json",
    "-o",
    jsonPath,
    "--force",
  ]);
  const level = JSON.parse(readFileSync(jsonPath, "utf8"));
  rmSync(jsonPath); // 170 Mo - ne pas laisser traîner
  return level?.properties?.worldSaveData?.value?.CharacterSaveParameterMap?.value ?? [];
}

/** Extrait les pseudos in-game d'une cmap (cf. loadLevelCmap) et les upsert
 *  dans save_players. */
export async function syncPlayerNames(
  sql: Sql,
  serverId: string,
  cmap: any[],
): Promise<{ players: number }> {
  const players: Array<{ guid: string; nickname: string }> = [];
  for (const entry of cmap) {
    const sp = entry?.value?.RawData?.value?.object?.SaveParameter?.value;
    if (!sp?.IsPlayer?.value) continue;
    const uid = entry?.key?.PlayerUId?.value;
    const nickname = sp?.NickName?.value;
    if (typeof uid === "string" && typeof nickname === "string" && nickname.length > 0) {
      players.push({ guid: normalizeGuid(uid), nickname });
    }
  }
  if (players.length === 0) throw new Error("Aucun joueur trouvé dans Level.sav - structure inattendue ?");

  await sql`
    insert into save_players (server_id, player_guid, nickname, updated_at)
    select ${serverId}::uuid,
           unnest(${players.map((p) => p.guid)}::text[]),
           unnest(${players.map((p) => p.nickname)}::text[]),
           now()
    on conflict (server_id, player_guid)
    do update set nickname = excluded.nickname, updated_at = now()`;
  for (const p of players) console.log(`${p.nickname} (${p.guid.slice(0, 8)}…)`);
  console.log(`${players.length} joueurs synchronisés dans save_players`);
  return { players: players.length };
}

/** Extrait les instances de Pals possédées d'une cmap (cf. loadLevelCmap) et
 *  remplace le contenu de save_pals pour ce serveur (idempotent). Jette si
 *  aucune instance n'est extraite : on n'écrase PAS un snapshot existant avec
 *  un delete à vide (fail loud, pas de wipe silencieux). */
export async function syncPalInstances(
  sql: Sql,
  serverId: string,
  cmap: any[],
): Promise<{ pals: number; owners: number }> {
  const palIdsLower = new Map<string, string>(
    (JSON.parse(
      readFileSync(new URL("../../game-data/pals.json", import.meta.url).pathname, "utf8"),
    ) as Array<{ id: string }>).map((p) => [p.id.toLowerCase(), p.id]),
  );

  const { rows, stats } = extractPalInstances(cmap, palIdsLower);
  console.log(
    `ignorés : ${stats.players} joueurs, ${stats.noOwner} sans propriétaire, ` +
      `${stats.unknownSpecies} espèces inconnues, ${stats.duplicates} doublons`,
  );
  if (rows.length === 0) {
    throw new Error("Aucune instance de Pal extraite de Level.sav : save_pals laissé intact");
  }

  // Remplacement idempotent pour CE serveur : 1 delete + inserts par tranches
  // de 1000 lignes (unnest de 10 tableaux parallèles) dans une seule
  // transaction non-interactive (batch neon). passives est encodée CSV côté
  // client (les row-names UE n'ont pas de virgule) et décodée côté serveur par
  // string_to_array ; gender/nickname vides -> NULL via nullif.
  const CHUNK = 1000;
  const queries = [sql.query("delete from save_pals where server_id = $1::uuid", [serverId])];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    queries.push(
      sql.query(
        `insert into save_pals
           (server_id, instance_id, owner_guid, pal_id, gender, level, nickname,
            passives, talent_hp, talent_shot, talent_defense)
         select $1::uuid, t.iid, t.og, t.pid, nullif(t.g, ''), t.lv, nullif(t.nick, ''),
                coalesce(string_to_array(nullif(t.pv, ''), ','), '{}'), t.thp, t.tsh, t.tdf
         from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[],
                     $7::text[], $8::text[], $9::int[], $10::int[], $11::int[])
              as t(iid, og, pid, g, lv, nick, pv, thp, tsh, tdf)`,
        [
          serverId,
          chunk.map((r) => r.instanceId),
          chunk.map((r) => r.ownerGuid),
          chunk.map((r) => r.palId),
          chunk.map((r) => r.gender ?? ""),
          chunk.map((r) => r.level),
          chunk.map((r) => r.nickname ?? ""),
          chunk.map((r) => r.passives.join(",")),
          chunk.map((r) => r.talentHp),
          chunk.map((r) => r.talentShot),
          chunk.map((r) => r.talentDefense),
        ],
      ),
    );
  }
  await sql.transaction(queries);

  const owners = new Set(rows.map((r) => r.ownerGuid)).size;
  console.log(`${rows.length} instances de Pals (${owners} propriétaires) synchronisées dans save_pals`);
  return { pals: rows.length, owners };
}
