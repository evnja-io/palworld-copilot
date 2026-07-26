// Sérialisation de l'état de filtres dans l'URL, pour partager une vue.
// Seuls les écarts aux défauts sont écrits : un lien reste court et lisible.
import { CATEGORIES, type CatKey } from "./categories";
import { defaultQuery, type Query } from "./query";
import type { SpawnPhase } from "./spawnLayer";

export type SpawnState = { spawnPal: string | null; spawnPhase: SpawnPhase };

const LEVEL_MIN = 1;
const LEVEL_MAX = 70;

function isCatKey(v: unknown): v is CatKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CATEGORIES, v);
}

function isPhase(v: unknown): v is SpawnPhase {
  return v === "day" || v === "night";
}

function clampLevel(n: number): number {
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, n));
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

// Clés de vue (sel/vis/lvl/el/todo/q) : ce sont elles qui font qu'une URL
// « décrit une vue ». `pal`/`phase` sont des clés de spawn : elles voyagent
// avec une vue partagée mais ne suffisent pas à en constituer une - la fiche
// Pal utilise `?pal=` seul pour dessiner des zones sans toucher aux filtres
// de l'utilisateur (cf. docs/decisions.md, Fix round 1 tâche 5).

/** `null` si l'URL ne décrit aucune vue valide : l'appelant garde alors
 *  localStorage. La simple présence d'une clé ne suffit pas - `?sel=` (vide)
 *  ou `?sel=doesnotexist` ne valident rien et doivent aussi renvoyer `null`,
 *  sans quoi un paramètre corrompu écraserait localStorage par des défauts. */
export function fromSearchParams(
  params: URLSearchParams,
): { query: Partial<Query>; spawn: Partial<SpawnState> } | null {
  const query: Partial<Query> = {};

  const sel = params.get("sel");
  if (sel && isCatKey(sel)) query.selected = sel;

  const vis = params.get("vis");
  if (vis !== null) query.visible = vis.split(",").filter(isCatKey);

  const lvl = params.get("lvl");
  if (lvl !== null && /^\d+$/.test(lvl)) {
    query.levelMin = clampLevel(Number(lvl));
  }

  const el = params.get("el");
  if (el) query.element = el;

  if (params.get("todo") === "1") query.hideTracked = true;

  const q = params.get("q");
  if (q) query.search = q;

  // Aucune clé de vue n'a validé : pas de vue à restaurer, même si `pal`/
  // `phase` sont présents (lien "voir les zones" depuis une fiche Pal).
  if (Object.keys(query).length === 0) return null;

  const spawn: Partial<SpawnState> = {};
  const pal = params.get("pal");
  if (pal) spawn.spawnPal = pal;

  const phase = params.get("phase");
  if (isPhase(phase)) spawn.spawnPhase = phase;

  return { query, spawn };
}

/** Valide un objet non fiable venant de localStorage, champ par champ - mêmes
 *  règles que `fromSearchParams`, pour ne pas dupliquer la logique. Un champ
 *  invalide est simplement omis (l'appelant retombe alors sur son défaut). */
export function sanitizeQuery(raw: unknown): Partial<Query> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const query: Partial<Query> = {};
  if (isCatKey(r.selected)) query.selected = r.selected;
  if (Array.isArray(r.visible)) query.visible = r.visible.filter(isCatKey);
  if (typeof r.levelMin === "number" && Number.isFinite(r.levelMin)) {
    query.levelMin = clampLevel(r.levelMin);
  }
  if (typeof r.element === "string") query.element = r.element;
  if (typeof r.hideTracked === "boolean") query.hideTracked = r.hideTracked;
  if (typeof r.search === "string") query.search = r.search;
  return query;
}

/** Même contrat que `sanitizeQuery`, pour la partie spawn de l'état persisté. */
export function sanitizeSpawn(raw: unknown): Partial<SpawnState> {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const spawn: Partial<SpawnState> = {};
  if (typeof r.spawnPal === "string" || r.spawnPal === null) spawn.spawnPal = r.spawnPal;
  if (isPhase(r.spawnPhase)) spawn.spawnPhase = r.spawnPhase;
  return spawn;
}
