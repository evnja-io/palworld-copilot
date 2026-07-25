import type { GroupUser } from "$lib/types";

/** Slug sentinelle du mode invité. Impossible à générer : generateSlug() tire
 *  dans BASE62, qui ne contient pas « _ ». Voir lib/server/servers.ts. */
export const GUEST_SLUG = "__guest";

/** Fonctionnalités accessibles sans compte, en URL propre (/paldex, /items, …).
 *  Source UNIQUE : pilote le reroute, la nav du shell invité et le sitemap.
 *  Liste blanche : tout le reste (/, /docs, /servers, /join, /api, /s/*, assets)
 *  reste fermé sans avoir à écrire une seule règle. */
export const GUEST_FEATURES = [
  "/paldex",
  "/breeding",
  "/teams",
  "/items",
  "/craft",
  "/tech",
  "/buildings",
  "/map",
] as const;

/** Fonctionnalités ouvertes aux invités mais NON indexables : espaces de travail
 *  personnels, sans contenu pour un moteur (la liste d'équipes d'un visiteur est
 *  vide par définition). Elles restent dans GUEST_FEATURES — donc accessibles et
 *  dans la nav — mais sont exclues du sitemap et portent `noindex`. */
export const GUEST_NOINDEX: readonly string[] = ["/teams"];

/** Chemins de fonctionnalité à publier dans le sitemap. */
export const GUEST_INDEXABLE_FEATURES = GUEST_FEATURES.filter(
  (f) => !GUEST_NOINDEX.includes(f),
);

/** Kinds de progression stockables côté invité. Miroir du REGISTRY de
 *  lib/server/progress.ts, réexprimé ici pour rester importable côté client. */
export const GUEST_PROGRESS_KINDS = ["pal_caught", "tech_unlocked", "marker"] as const;

/** Plafond d'équipes locales. Défini ici (module pur) plutôt que dans
 *  localTeams.ts, pour que l'endpoint d'import puisse le borner sans importer
 *  un module qui touche à localStorage. */
export const MAX_GUEST_TEAMS = 20;

/** Chemin interne pour une URL publique (/paldex → /s/__guest/paldex),
 *  ou undefined si le chemin est hors du périmètre invité.
 *  Le chemin reçu doit déjà être dé-localisé (cf. src/hooks.ts). */
export function guestTarget(pathname: string): string | undefined {
  // Slash final retiré : /paldex/ doit matcher comme /paldex.
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  for (const feature of GUEST_FEATURES) {
    // `startsWith(feature + "/")` et pas `startsWith(feature)` : sinon
    // /paldexical serait capturé par /paldex.
    if (path === feature || path.startsWith(`${feature}/`)) return `/s/${GUEST_SLUG}${path}`;
  }
  return undefined;
}

/** Ce route id (/s/[slug]/paldex/[palId]) est-il ouvert aux invités ?
 *  Garde-fou pour /s/__guest/settings tapé à la main. */
export function isGuestRouteId(routeId: string | null): boolean {
  if (!routeId) return false;
  return GUEST_FEATURES.some(
    (feature) => routeId === `/s/[slug]${feature}` || routeId.startsWith(`/s/[slug]${feature}/`),
  );
}

/** Retire le préfixe interne du mode invité d'un chemin déjà dé-localisé :
 *  '/s/__guest/paldex/SheepBall' → '/paldex/SheepBall'.
 *  Sert à rediriger un membre connecté vers SON serveur sur le même sous-chemin.
 *  Sans ce nettoyage on obtiendrait '/s/<réel>/s/__guest/paldex'. */
export function stripGuestPrefix(pathname: string): string {
  const prefix = `/s/${GUEST_SLUG}`;
  if (pathname === prefix) return "";
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

/** Progression vide renvoyée par les loads en mode invité. Typée explicitement
 *  pour que les deux branches (invité / membre) sérialisent la même forme. */
export const EMPTY_PROGRESS: { mine: string[]; group: Record<string, GroupUser[]> } = {
  mine: [],
  group: {},
};
