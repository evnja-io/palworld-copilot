// Coque CLI : extrait les instances de Pals possédées (équipe + palbox) et
// les travailleurs de base sans propriétaire de Level.sav, et remplace le
// contenu de save_pals pour le serveur cible.
// Usage : node --experimental-strip-types src/extract-pals.ts <dossier>
// Env : DATABASE_URL + SERVER_ID. Le venv palsav (Phase 0) fait la conversion.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { extractBaseData } from "./extract-bases-lib.ts";
import { loadLevelSections, syncPalInstances } from "./import-lib.ts";

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
  const sections = loadLevelSections(dir);
  // Extraction pure (aucune écriture des tables de bases ici) : sert
  // uniquement à conserver les travailleurs de base dans save_pals.
  const { assignments } = extractBaseData(
    sections.groups,
    sections.baseCamps,
    sections.charContainers,
  );
  const keepIds = new Set(assignments.map((a) => a.instanceId));
  await syncPalInstances(sql, serverId, sections.cmap, keepIds);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}
