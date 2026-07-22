import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { neon } from "@neondatabase/serverless";

// 1. Arguments et environnement
const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error("Usage: import-save <dossier contenant des Players/*.sav>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante (utiliser --env-file)");
const sql = neon(process.env.DATABASE_URL);
const venvPython = new URL("../.venv/bin/python", import.meta.url).pathname;
if (!existsSync(venvPython)) throw new Error("venv palsav absent — cf. runbook, section saves");

// Serveur cible obligatoire (phase 1 : uuid du serveur legacy)
const serverId = process.env.SERVER_ID;
if (!serverId) throw new Error("SERVER_ID manquante (uuid du serveur cible)");

// 2. Datasets de validation — comparaison case-insensitive (cf. Task 1 :
// la save contient des variantes de casse comme "Sheepball"/"PALBOX"), mais
// l'entityId écrit en base est toujours l'ID canonique du dataset.
const palIdsLower = new Map<string, string>(
  (
    JSON.parse(
      readFileSync(new URL("../../game-data/pals.json", import.meta.url).pathname, "utf8"),
    ) as Array<{ id: string }>
  ).map((p) => [p.id.toLowerCase(), p.id]),
);
const techIdsLower = new Map<string, string>(
  (
    JSON.parse(
      readFileSync(new URL("../../game-data/tech.json", import.meta.url).pathname, "utf8"),
    ) as Array<{ id: string }>
  ).map((t) => [t.id.toLowerCase(), t.id]),
);

// 3. Par fichier .sav : convertir (palsav -> JSON temporaire), extraire, snapshoter
const allSavs = readdirSync(dir).filter((f) => f.endsWith(".sav"));
if (allSavs.length === 0) throw new Error(`Aucun .sav dans ${dir}`);

// Garde sur les noms : seuls les fichiers <guid 32 hex>.sav sont traités.
const guidFilePattern = /^[0-9A-Fa-f]{32}\.sav$/;
const savs = allSavs.filter((f) => {
  if (guidFilePattern.test(f)) return true;
  console.log(`ignoré : ${f}`);
  return false;
});

const failures: Array<{ file: string; message: string }> = [];

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
    const sd = save.properties.SaveData.value;
    const rd = sd.RecordData.value;

    // Extracteurs : règles reprises telles quelles du spike Task 1
    // (packages/pipeline/spike/import-mapping.ts).

    // PaldeckUnlockFlag est une MapProperty { key: string, value: boolean }[] —
    // absente sur une save fraîche (défensif), on ne garde que value===true
    // et on résout le nom interne (casse variable) vers l'ID canonique.
    const paldeckEntries = (
      (rd.PaldeckUnlockFlag?.value ?? []) as Array<{ key: string; value: boolean }>
    )
      .filter((entry) => entry.value === true)
      .map((entry) => entry.key);
    const pals = [
      ...new Set(
        paldeckEntries
          .map((id) => palIdsLower.get(id.toLowerCase()))
          .filter((id): id is string => id !== undefined),
      ),
    ];

    // UnlockedRecipeTechnologyNames est une ArrayProperty { values: string[] } —
    // absente sur une save fraîche (défensif) ; sinon chaque élément est déjà
    // le row name (comparaison toujours case-insensitive).
    const techEntries = (sd.UnlockedRecipeTechnologyNames?.value?.values ?? []) as string[];
    const techs = [
      ...new Set(
        techEntries.map((id) => techIdsLower.get(id.toLowerCase())).filter((id): id is string => id !== undefined),
      ),
    ];

    // RelicObtainForInstanceFlag (effigies) : même forme MapProperty que le
    // Paldeck, mais les keys sont des GUIDs bruts (Phase 7, non fusionnés) —
    // stockés normalisés (minuscules, sans tirets).
    const relicEntries = (
      (rd.RelicObtainForInstanceFlag?.value ?? []) as Array<{ key: string; value: boolean }>
    )
      .filter((entry) => entry.value === true)
      .map((entry) => entry.key.replaceAll("-", "").toLowerCase());
    const relics = [...new Set(relicEntries)];

    const rows = [
      ...pals.map((id) => ({ kind: "pal_caught", id })),
      ...techs.map((id) => ({ kind: "tech_unlocked", id })),
      ...relics.map((id) => ({ kind: "raw:relic", id })),
    ];

    // 4. Remplacement idempotent du snapshot de CE guid — delete + insert par
    // lots (unnest) dans une seule transaction non-interactive.
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
    console.log(`${guid} : ${pals.length} pals, ${techs.length} techs, ${relics.length} effigies (snapshot)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ÉCHEC ${sav} : ${message}`);
    failures.push({ file: sav, message });
  }
}

// 5. Fusion additive vers progress pour les GUIDs revendiqués.
// Kinds directs (pal_caught, tech_unlocked) + effigies : raw:relic -> marker
// 'relic_<guid>' — uniquement celles présentes dans markers.json (les
// effigies de l'Arbre-Monde/hors dataset attendent dans les snapshots).
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

// 6. Récapitulatif des GUIDs non revendiqués
const unclaimed = await sql`
  select s.player_guid, count(*) as n from save_snapshots s
  left join server_members m
    on m.server_id = s.server_id and m.pal_player_guid = s.player_guid
  where s.server_id = ${serverId}::uuid and m.user_id is null
  group by s.player_guid`;
for (const r of unclaimed) console.log(`non revendiqué : ${r.player_guid} (${r.n} entrées) — page /import`);

// 7. Récapitulatif des échecs — sortie non-zéro si des fichiers ont échoué
if (failures.length > 0) {
  console.error(`\n${failures.length} fichier(s) en échec :`);
  for (const f of failures) console.error(`  - ${f.file} : ${f.message}`);
  process.exit(1);
}
