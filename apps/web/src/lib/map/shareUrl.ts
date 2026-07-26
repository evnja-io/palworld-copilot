// Sérialisation de l'état de filtres dans l'URL, pour partager une vue.
// Seuls les écarts aux défauts sont écrits : un lien reste court et lisible.
import { CATEGORIES, type CatKey } from "./categories";
import { defaultQuery, type Query } from "./query";
import type { SpawnPhase } from "./spawnLayer";

export type SpawnState = { spawnPal: string | null; spawnPhase: SpawnPhase };

const LEVEL_MIN = 1;
const LEVEL_MAX = 70;

function isCatKey(v: string): v is CatKey {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, v);
}

export function toSearchParams(q: Query, spawn: SpawnState): URLSearchParams {
  const d = defaultQuery();
  const p = new URLSearchParams();
  if (q.selected !== d.selected) p.set("sel", q.selected);
  if (q.visible.join(",") !== d.visible.join(",")) p.set("vis", q.visible.join(","));
  if (q.levelMin !== d.levelMin) p.set("lvl", String(q.levelMin));
  if (q.element) p.set("el", q.element);
  if (q.hideTracked) p.set("todo", "1");
  if (q.search.trim()) p.set("q", q.search.trim());
  if (spawn.spawnPal) {
    p.set("pal", spawn.spawnPal);
    p.set("phase", spawn.spawnPhase);
  }
  return p;
}

/** `null` si l'URL ne porte aucun filtre : l'appelant garde alors localStorage.
 *  Un `?focus=` seul ne compte pas — c'est un lien de marqueur, pas de vue. */
export function fromSearchParams(
  params: URLSearchParams,
): { query: Partial<Query>; spawn: Partial<SpawnState> } | null {
  const KEYS = ["sel", "vis", "lvl", "el", "todo", "q", "pal", "phase"];
  if (!KEYS.some((k) => params.has(k))) return null;

  const query: Partial<Query> = {};
  const spawn: Partial<SpawnState> = {};

  const sel = params.get("sel");
  if (sel && isCatKey(sel)) query.selected = sel;

  const vis = params.get("vis");
  if (vis !== null) query.visible = vis.split(",").filter(isCatKey);

  const lvl = params.get("lvl");
  if (lvl !== null && /^\d+$/.test(lvl)) {
    query.levelMin = Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Number(lvl)));
  }

  const el = params.get("el");
  if (el) query.element = el;

  if (params.get("todo") === "1") query.hideTracked = true;

  const q = params.get("q");
  if (q) query.search = q;

  const pal = params.get("pal");
  if (pal) spawn.spawnPal = pal;

  const phase = params.get("phase");
  if (phase === "day" || phase === "night") spawn.spawnPhase = phase;

  return { query, spawn };
}
