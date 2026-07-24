// Extrait les instances de Pals possédées (équipe + palbox) de Level.sav et
// remplace le contenu de save_pals pour le serveur cible (idempotent).
// Usage : node --experimental-strip-types src/extract-pals.ts <dossier contenant Level.sav>
// Env : DATABASE_URL + SERVER_ID. Le venv palsav (Phase 0) fait la conversion PlM -> JSON.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { extractPalInstances } from "./extract-pals-lib.ts";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "Level.sav"))) {
  console.error("Usage: extract-pals.ts <dossier contenant Level.sav>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
const sql = neon(process.env.DATABASE_URL);
const serverId = process.env.SERVER_ID;
if (!serverId) throw new Error("SERVER_ID manquante (uuid du serveur cible)");
const venvPython = new URL("../.venv/bin/python", import.meta.url).pathname;
if (!existsSync(venvPython)) throw new Error("venv palsav absent — cf. runbook, section saves");

// Dataset de validation : lookup case-insensitive -> id canonique
// (pattern import-save.ts — la save contient des variantes de casse).
const palIdsLower = new Map<string, string>(
  (
    JSON.parse(
      readFileSync(new URL("../../game-data/pals.json", import.meta.url).pathname, "utf8"),
    ) as Array<{ id: string }>
  ).map((p) => [p.id.toLowerCase(), p.id]),
);

const jsonPath = join(dir, "level.sav.json");
execFileSync(venvPython, [
  "-m", "palsav.commands.convert",
  join(dir, "Level.sav"),
  "--to-json", "-o", jsonPath, "--force",
]);

const level = JSON.parse(readFileSync(jsonPath, "utf8"));
rmSync(jsonPath); // 170 Mo — ne pas laisser traîner
const cmap: any[] =
  level?.properties?.worldSaveData?.value?.CharacterSaveParameterMap?.value ?? [];

if (cmap.length === 0) {
  console.error("CharacterSaveParameterMap vide — structure inattendue ?");
  process.exit(1);
}

const { rows, stats } = extractPalInstances(cmap, palIdsLower);

// Garde-fou : zéro instance extraite d'une cmap non vide signale une
// divergence d'enveloppe (cf. plan, risque n°1) — on n'écrase PAS le
// snapshot existant avec un delete à vide.
if (rows.length === 0) {
  console.error(
    `Aucune instance extraite (${stats.players} joueurs, ${stats.noOwner} sans propriétaire, ` +
      `${stats.unknownSpecies} espèces inconnues) — save_pals laissé intact.`,
  );
  process.exit(1);
}

// Remplacement idempotent pour CE serveur : 1 delete + inserts par tranches de
// 1000 lignes (unnest de 10 tableaux parallèles) dans une seule transaction
// non-interactive (batch neon). passives est encodée CSV côté client (les
// row-names UE n'ont pas de virgule) et décodée côté serveur par
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

// Récapitulatif
const owners = new Set(rows.map((r) => r.ownerGuid));
console.log(
  `ignorés : ${stats.players} joueurs, ${stats.noOwner} sans propriétaire, ` +
    `${stats.unknownSpecies} espèces inconnues, ${stats.duplicates} doublons`,
);
console.log(
  `${rows.length} instances de Pals (${owners.size} propriétaires) synchronisées dans save_pals`,
);
