// Coque CLI : extrait guildes, bases et affectations de travail de Level.sav
// et remplace le contenu de save_guilds/save_guild_members/save_bases/
// save_pal_assignments pour le serveur cible (base_demands jamais touchée).
// Usage : node --experimental-strip-types src/extract-bases.ts <dossier>
// Env : DATABASE_URL + SERVER_ID. Le venv palsav (Phase 0) fait la conversion.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { loadLevelSections, syncBaseData } from "./import-lib.ts";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "Level.sav"))) {
  console.error("Usage: extract-bases.ts <dossier contenant Level.sav>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
const serverId = process.env.SERVER_ID;
if (!serverId) throw new Error("SERVER_ID manquante (uuid du serveur cible)");

const sql = neon(process.env.DATABASE_URL);
try {
  await syncBaseData(sql, serverId, loadLevelSections(dir));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}
