// Extrait les pseudos in-game de Level.sav et les upsert dans save_players.
// Usage : node --experimental-strip-types src/extract-players.ts <dossier contenant Level.sav>
// Env : DATABASE_URL. Le venv palsav (Phase 0) fait la conversion PlM -> JSON.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "Level.sav"))) {
  console.error("Usage: extract-players.ts <dossier contenant Level.sav>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
const sql = neon(process.env.DATABASE_URL);
const venvPython = new URL("../.venv/bin/python", import.meta.url).pathname;
if (!existsSync(venvPython)) throw new Error("venv palsav absent — cf. runbook, section saves");

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

/** UUID "00afd495-0000-…" -> "00AFD495000000000000000000000000" (format des
 *  noms de fichiers Players/ et de save_snapshots.player_guid). */
function normalizeGuid(uuid: string): string {
  return uuid.replaceAll("-", "").toUpperCase();
}

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

if (players.length === 0) {
  console.error("Aucun joueur trouvé dans Level.sav — structure inattendue ?");
  process.exit(1);
}
await sql`
  insert into save_players (player_guid, nickname, updated_at)
  select unnest(${players.map((p) => p.guid)}::text[]),
         unnest(${players.map((p) => p.nickname)}::text[]),
         now()
  on conflict (player_guid)
  do update set nickname = excluded.nickname, updated_at = now()`;
for (const p of players) console.log(`${p.nickname} (${p.guid.slice(0, 8)}…)`);
console.log(`${players.length} joueurs synchronisés dans save_players`);
