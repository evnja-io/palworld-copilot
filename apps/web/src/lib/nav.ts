import { page } from "$app/state";

/** Préfixe un chemin interne avec le serveur courant : appHref('/paldex')
 *  → '/s/<slug>/paldex'. À n'utiliser que sous les routes /s/[slug]. */
export function appHref(path: string): string {
  return `/s/${page.params.slug}${path}`;
}
