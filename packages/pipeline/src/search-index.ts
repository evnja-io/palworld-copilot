import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeGameData } from "./lib.js";
import { OUT_DIR } from "./paths.js";

const load = (p: string) => JSON.parse(readFileSync(join(OUT_DIR, p), "utf8"));
const fr = load("l10n/names.fr.json");
const en = load("l10n/names.en.json");

// Seules les entités qui ont une page dans l'app entrent dans l'index global.
const SEARCHABLE = ["pal:", "item:", "tech:", "building:"];

const index = [...new Set([...Object.keys(en), ...Object.keys(fr)])]
  .filter((key) => SEARCHABLE.some((ns) => key.startsWith(ns)))
  .map((key) => ({ id: key, fr: fr[key] ?? en[key], en: en[key] ?? fr[key] }))
  .filter((e) => e.fr || e.en)
  .sort((a, b) => a.id.localeCompare(b.id));
writeGameData("search-index.json", index);
console.log(`search-index OK (${index.length} entrées)`);
