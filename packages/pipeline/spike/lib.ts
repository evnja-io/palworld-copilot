import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const RAW_DIR = process.env.RAW_DIR ?? "/mnt/c/PalExports/Exports";

/** Sous-arbres utiles seulement : le dossier d'export complet peut contenir
 *  des dizaines de milliers de fichiers (lenteur /mnt/c oblige). */
const SCAN_ROOTS = [
  "Pal/Content/Pal/DataTable",
  "Pal/Content/L10N",
  "Pal/Content/Pal/Texture/UI/Map",
];

export function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

let cachedFiles: string[] | null = null;
export function allExports(): string[] {
  if (!cachedFiles) {
    cachedFiles = SCAN_ROOTS.flatMap((r) => walk(join(RAW_DIR, r)));
  }
  return cachedFiles;
}

export function findExports(pathHint: RegExp): string[] {
  return allExports().filter((f) => f.endsWith(".json") && pathHint.test(f));
}

export function findExport(pathHint: RegExp): string {
  const hit = findExports(pathHint)[0];
  if (!hit) throw new Error(`Aucun export JSON ne matche ${pathHint}`);
  return hit;
}

/** Un export FModel « Save Properties » d'une DataTable est un tableau d'objets ;
 *  celui de type DataTable porte une clé Rows { rowName: {props} }.
 *  Les tables v1.0+ sont parfois éclatées en DT_Xxx + DT_Xxx_Common :
 *  on fusionne les Rows de tous les fichiers qui matchent. */
export function loadDataTableRows(pathHint: RegExp): Record<string, any> {
  const files = findExports(pathHint);
  if (files.length === 0) throw new Error(`Aucun export JSON ne matche ${pathHint}`);
  const merged: Record<string, any> = {};
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const dt = arr.find((o) => o && typeof o === "object" && "Rows" in o);
    if (!dt) continue;
    console.log(`  source : ${file.replace(RAW_DIR + "/", "")} (${Object.keys(dt.Rows).length} lignes)`);
    Object.assign(merged, dt.Rows);
  }
  if (Object.keys(merged).length === 0) {
    throw new Error(`Aucune clé Rows dans les fichiers matchant ${pathHint}`);
  }
  return merged;
}
