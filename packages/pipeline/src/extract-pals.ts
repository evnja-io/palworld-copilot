// Coque CLI : extrait les instances de Pals possédées (équipe + palbox) de
// Level.sav et remplace le contenu de save_pals pour le serveur cible.
// Usage : node --experimental-strip-types src/extract-pals.ts <dossier>
// Env : DATABASE_URL + SERVER_ID. Le venv palsav (Phase 0) fait la conversion.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { loadLevelCmap, syncPalInstances } from "./import-lib.ts";

const dir = process.argv[2];
if (!dir || !existsSync(join(dir, "Level.sav"))) {
  console.error("Usage: extract-pals.ts <dossier contenant Level.sav>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
const serverId = process.env.SERVER_ID;
if (!serverId) throw new Error("SERVER_ID manquante (uuid du serveur cible)");

const sql = neon(process.env.DATABASE_URL);
try {
  await syncPalInstances(sql, serverId, loadLevelCmap(dir));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}
