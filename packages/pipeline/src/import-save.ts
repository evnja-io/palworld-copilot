// Coque CLI : lit le dossier (argv) et le serveur cible (SERVER_ID), délègue à
// import-lib. Usage : node --experimental-strip-types src/import-save.ts <dossier>
import { existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { importPlayerSaves } from "./import-lib.ts";

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error("Usage: import-save <dossier contenant des Players/*.sav>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante (utiliser --env-file)");
const serverId = process.env.SERVER_ID;
if (!serverId) throw new Error("SERVER_ID manquante (uuid du serveur cible)");

const sql = neon(process.env.DATABASE_URL);
const stats = await importPlayerSaves(sql, serverId, dir);
if (stats.failures > 0) {
  console.error(`\n${stats.failures} fichier(s) en échec`);
  process.exit(1);
}
