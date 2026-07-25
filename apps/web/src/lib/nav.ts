import { page } from "$app/state";
import { GUEST_SLUG } from "$lib/guest";
import { localizeHref } from "$lib/paraglide/runtime";

/** Lien interne vers une fonctionnalité, selon le contexte de la page courante :
 *
 *  - membre  : appHref('/paldex') → '/s/<slug>/paldex' (non localisé, ces routes
 *              gardent la locale par cookie — cf. routeStrategies).
 *  - invité  : appHref('/paldex') → '/paldex' en FR, '/en/paldex' en EN.
 *
 *  Le slug sentinelle ne doit jamais apparaître dans une URL partagée : c'est un
 *  détail de résolution interne (src/hooks.ts). */
export function appHref(path: string): string {
  return page.params.slug === GUEST_SLUG ? localizeHref(path) : `/s/${page.params.slug}${path}`;
}
