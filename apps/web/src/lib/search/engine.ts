// Moteur de la palette : filtrage par tokens (ET) + fuzzy sur le texte libre.
// Module pur — l'index et le contexte (progression, apprentissages) sont injectés.
import fuzzysort from "fuzzysort";
import type { Locale, MarkerType, Ns, Token } from "./tokens.js";

/** Entrée du search-index.json v2 (voir packages/pipeline/src/search-index.ts). */
export type SearchEntry = {
  id: string;
  fr: string;
  en: string;
  el?: string[];
  wk?: Record<string, number>;
  cat?: string;
  mk?: MarkerType;
  pw?: number;
  ct?: number;
  lvl?: number;
  px?: number;
  py?: number;
  pal?: string;
};

export type ResultItem = {
  entry: SearchEntry;
  /** Indices des caractères matchés dans le nom affiché (surlignage fuzzy). */
  indexes?: readonly number[];
  /** Langue du nom sur lequel le fuzzy a matché. */
  matchLocale?: Locale;
};

export type ResultGroup = { ns: Ns; items: ResultItem[] };

export type SearchContext = {
  locale: Locale;
  /** skillId -> palIds qui apprennent la compétence. */
  learners?: Map<string, ReadonlySet<string>>;
  /** passiveId -> palIds qui possèdent le talent passif inné. */
  passiveHolders?: Map<string, ReadonlySet<string>>;
  /** Ids bruts des marqueurs cochés (progression "marker"). */
  checked?: ReadonlySet<string>;
};

export function entryNs(e: SearchEntry): Ns {
  return e.id.slice(0, e.id.indexOf(":")) as Ns;
}

/** Id brut sans namespace ("marker:relic_x" -> "relic_x"). */
export function rawId(e: SearchEntry): string {
  return e.id.slice(e.id.indexOf(":") + 1);
}

const GROUP_ORDER: Ns[] = ["pal", "item", "skill", "passive", "marker", "tech", "building"];

/** Recherche insensible aux diacritiques : « defense » doit matcher « défense ».
 *  La normalisation NFD + retrait des accents préserve la longueur (précomposés
 *  uniquement) → les indices de surlignage restent valides sur le nom original. */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normCache = new WeakMap<SearchEntry, { fr: string; en: string }>();
function normNames(e: SearchEntry): { fr: string; en: string } {
  let n = normCache.get(e);
  if (!n) {
    n = { fr: norm(e.fr), en: norm(e.en) };
    normCache.set(e, n);
  }
  return n;
}

function matchesToken(e: SearchEntry, t: Token, ctx: SearchContext): boolean {
  switch (t.kind) {
    case "ns":
      return entryNs(e) === t.value;
    case "element":
      return e.el?.includes(t.value) ?? false;
    case "work":
      return (e.wk?.[t.value] ?? 0) >= t.min;
    case "cat":
      return e.cat === t.value;
    case "marker":
      return e.mk === t.value;
    case "progress": {
      // Seules les effigies sont cochables : le filtre de progression s'y limite.
      if (e.mk !== "relic") return false;
      const checked = ctx.checked?.has(rawId(e)) ?? false;
      return t.value === "checked" ? checked : !checked;
    }
    case "skill":
      return entryNs(e) === "pal" && (ctx.learners?.get(t.value)?.has(rawId(e)) ?? false);
    case "passive":
      return entryNs(e) === "pal" && (ctx.passiveHolders?.get(t.value)?.has(rawId(e)) ?? false);
  }
}

/**
 * Filtre l'index par tokens puis matche le texte libre en fuzzy (FR + EN).
 * Retourne des groupes ordonnés par namespace ; la limite par groupe augmente
 * quand les filtres réduisent la recherche à un seul namespace.
 */
export function runSearch(
  index: SearchEntry[],
  tokens: Token[],
  text: string,
  ctx: SearchContext,
): ResultGroup[] {
  const query = text.trim();
  if (!tokens.length && query.length < 2) return [];

  const filtered = tokens.length
    ? index.filter((e) => tokens.every((t) => matchesToken(e, t, ctx)))
    : index;

  let items: ResultItem[];
  if (query) {
    // Le nom dans la langue de l'utilisateur est affiché dès qu'il matche ;
    // l'autre langue ne sert (affichage + surlignage) que s'il ne matche pas.
    const localeIdx = ctx.locale === "fr" ? 0 : 1;
    const otherLocale: Locale = ctx.locale === "fr" ? "en" : "fr";
    items = fuzzysort
      .go(norm(query), filtered, {
        keys: [(e) => normNames(e).fr, (e) => normNames(e).en],
        limit: 200,
      })
      .map((r) => {
        const localMatch = (r[localeIdx]?.score ?? 0) > 0;
        const key = localMatch ? r[localeIdx] : r[1 - localeIdx];
        return {
          entry: r.obj,
          indexes: key?.indexes,
          matchLocale: localMatch ? ctx.locale : otherLocale,
        };
      });
  } else {
    const name = (e: SearchEntry) => e[ctx.locale] ?? e.en;
    items = filtered
      .slice()
      .sort((a, b) => name(a).localeCompare(name(b)))
      .map((entry) => ({ entry }));
  }

  const groups = new Map<Ns, ResultItem[]>();
  for (const it of items) {
    const ns = entryNs(it.entry);
    const list = groups.get(ns);
    if (list) list.push(it);
    else groups.set(ns, [it]);
  }

  const perGroup = groups.size === 1 ? 40 : 8;
  return GROUP_ORDER.filter((ns) => groups.has(ns)).map((ns) => ({
    ns,
    items: groups.get(ns)!.slice(0, perGroup),
  }));
}
