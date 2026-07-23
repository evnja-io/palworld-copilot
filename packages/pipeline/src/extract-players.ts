// Coque CLI : extrait les pseudos in-game de Level.sav vers save_players.
// Usage : node --experimental-strip-types src/extract-players.ts <dossier>
import { existsSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { syncPlayerNames } from "./import-lib.ts";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "Level.sav"))) {
  console.error("Usage: extract-players.ts <dossier contenant Level.sav>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
const serverId = process.env.SERVER_ID;
if (!serverId) throw new Error("SERVER_ID manquante (uuid du serveur cible)");

const sql = neon(process.env.DATABASE_URL);
await syncPlayerNames(sql, serverId, dir);
