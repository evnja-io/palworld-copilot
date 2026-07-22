import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeGameData } from "./lib.js";
import { OUT_DIR } from "./paths.js";

const load = (p: string) => JSON.parse(readFileSync(join(OUT_DIR, p), "utf8"));
const fr = load("l10n/names.fr.json");
const en = load("l10n/names.en.json");

/** Entrée d'index v2 : noms FR/EN + facettes pour les filtres de la palette. */
type Entry = {
  id: string;
  fr: string;
  en: string;
  el?: string[]; // éléments (pal, skill)
  wk?: Record<string, number>; // aptitudes de travail (pal)
  cat?: string; // catégorie (item typeA)
  mk?: "alpha" | "ft" | "relic"; // type de marqueur
  pw?: number; // puissance (skill)
  ct?: number; // cooldown (skill)
  lvl?: number; // niveau (tech, boss alpha)
  px?: number; // position carte (marker)
  py?: number;
  pal?: string; // palId du boss (marker alpha)
};

const names = (key: string): { fr: string; en: string } | null => {
  const f = fr[key] ?? en[key];
  const e = en[key] ?? fr[key];
  return f || e ? { fr: f, en: e } : null;
};

const index: Entry[] = [];

for (const p of load("pals.json")) {
  const n = names(`pal:${p.id}`);
  if (!n) continue;
  index.push({ id: `pal:${p.id}`, ...n, el: p.elements, wk: p.work });
}

const itemCat = new Map<string, string>(
  load("items.json").map((i: { id: string; typeA: string }) => [i.id, i.typeA]),
);
for (const [key, cat] of itemCat) {
  const n = names(`item:${key}`);
  if (n) index.push({ id: `item:${key}`, ...n, cat });
}

const techLevel = new Map<string, number>();
for (const t of load("tech.json")) if (!techLevel.has(t.nameId)) techLevel.set(t.nameId, t.level);
for (const [nameId, lvl] of techLevel) {
  const n = names(`tech:${nameId}`);
  if (n) index.push({ id: `tech:${nameId}`, ...n, lvl });
}

for (const b of load("buildings.json")) {
  const n = names(`building:${b.mapObjectId}`);
  if (n) index.push({ id: `building:${b.mapObjectId}`, ...n });
}

for (const [skillId, s] of Object.entries<{ element: string; power: number; ct: number }>(
  load("skills.json"),
)) {
  const n = names(`skill:${skillId}`);
  if (!n) continue;
  const el = s.element && s.element !== "None" ? [s.element] : undefined;
  index.push({ id: `skill:${skillId}`, ...n, el, pw: s.power, ct: s.ct });
}

/** Coordonnées in-game (mêmes formules que la carte web). */
const coords = (px: number, py: number): string =>
  `(${Math.round((px / 8192) * 2000 - 1000)}, ${Math.round(1000 - (py / 8192) * 2000)})`;

for (const mk of load("markers.json")) {
  const base = { id: `marker:${mk.id}`, mk: mk.type, px: mk.px, py: mk.py };
  if (mk.type === "alpha") {
    const n = mk.meta?.palId ? names(`pal:${mk.meta.palId}`) : null;
    if (!n) continue;
    index.push({ ...base, ...n, lvl: mk.meta.level, pal: mk.meta.palId });
  } else if (mk.type === "ft") {
    const n = mk.nameId ? names(`ft:${mk.nameId}`) : null;
    if (!n) continue;
    index.push({ ...base, ...n });
  } else {
    const c = coords(mk.px, mk.py);
    index.push({ ...base, fr: `Effigie Lifmunk ${c}`, en: `Lifmunk Effigy ${c}` });
  }
}

index.sort((a, b) => a.id.localeCompare(b.id));
writeGameData("search-index.json", index);

const byNs = index.reduce<Record<string, number>>((acc, e) => {
  const ns = e.id.slice(0, e.id.indexOf(":"));
  acc[ns] = (acc[ns] ?? 0) + 1;
  return acc;
}, {});
console.log(
  `search-index OK (${index.length} entrées : ${Object.entries(byNs)
    .map(([ns, c]) => `${ns} ${c}`)
    .join(", ")})`,
);
