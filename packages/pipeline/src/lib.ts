import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { OUT_DIR, RAW_DIR } from "./paths.js";

/** Racines par usage : le scan de /mnt/c est lent, on ne paie que le nécessaire.
 *  Les transforms lisent DATA_ROOTS ; icons.ts demande explicitement TEXTURE_ROOTS. */
export const DATA_ROOTS = ["Pal/Content/Pal/DataTable", "Pal/Content/L10N"];
export const TEXTURE_ROOTS = ["Pal/Content/Pal/Texture", "Pal/Content/Others"];

function walk(dir: string, acc: string[] = []): string[] {
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

const rootCache = new Map<string, string[]>();
export function exportsUnder(roots: string[]): string[] {
  return roots.flatMap((r) => {
    if (!rootCache.has(r)) rootCache.set(r, walk(join(RAW_DIR, r)));
    return rootCache.get(r)!;
  });
}

export function findExports(hint: RegExp, roots: string[] = DATA_ROOTS): string[] {
  return exportsUnder(roots).filter((f) => hint.test(f));
}

/** Fusionne les Rows de tous les fichiers JSON matchant (variantes _Common). */
export function loadDataTableRows(hint: RegExp): Record<string, any> {
  const files = findExports(hint).filter((f) => f.endsWith(".json"));
  if (files.length === 0) throw new Error(`Aucun export ne matche ${hint}`);
  const merged: Record<string, any> = {};
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const dt = arr.find((o) => o && typeof o === "object" && "Rows" in o);
    if (dt) Object.assign(merged, dt.Rows);
  }
  if (Object.keys(merged).length === 0) throw new Error(`Rows vides pour ${hint}`);
  return merged;
}

/** Premier champ présent parmi les candidats (les noms varient entre versions). */
export function pick<T = any>(row: Record<string, any>, ...names: string[]): T | undefined {
  for (const n of names) if (n in row) return row[n];
  return undefined;
}

export function must<T>(v: T | undefined | null, msg: string): T {
  if (v === undefined || v === null) throw new Error(`Champ manquant : ${msg}`);
  return v;
}

/** Ex. "EPalElementType::Fire" -> "Fire" ; laisse intact sinon. */
export function enumName(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  return v.includes("::") ? v.split("::").pop() : v;
}

function sortDeep(v: any): any {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortDeep(v[k])]),
    );
  }
  return v;
}

/** Écriture déterministe (clés triées) pour des diffs git propres. */
export function writeGameData(relPath: string, data: unknown): void {
  const p = join(OUT_DIR, relPath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(sortDeep(data), null, 1) + "\n");
  console.log(`  écrit : game-data/${relPath}`);
}

/** Texte L10N : clés <PREFIXE>_<id> -> TextData.LocalizedString (décision Phase 0). */
export function l10nMap(hint: RegExp, prefix: string): Record<string, string> {
  const rows = loadDataTableRows(hint);
  const out: Record<string, string> = {};
  for (const [key, row] of Object.entries(rows)) {
    const text = (row as any)?.TextData?.LocalizedString;
    if (typeof text === "string" && key.startsWith(prefix)) out[key.slice(prefix.length)] = text;
  }
  return out;
}
