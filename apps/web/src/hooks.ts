import type { Reroute } from "@sveltejs/kit";
import { guestTarget } from "$lib/guest";
import { deLocalizeUrl } from "$lib/paraglide/runtime";

/** Résolution de route en deux temps. Paraglide possède `reroute` dès que la
 *  stratégie « url » est active, donc les deux se composent au lieu de se
 *  disputer le hook :
 *
 *    /en/paldex  --deLocalizeUrl-->  /paldex  --guestTarget-->  /s/__guest/paldex
 *
 *  L'URL affichée n'est jamais modifiée (Kit n'utilise cette valeur que pour
 *  faire correspondre une route) : page.url.pathname reste « /en/paldex »,
 *  page.params.slug vaut « __guest », page.route.id vaut « /s/[slug]/paldex ».
 *
 *  Doit rester pur : Kit met le résultat en cache par href côté client.
 */
export const reroute: Reroute = ({ url }) => {
  // Toujours renvoyer le chemin dé-localisé, même hors périmètre invité :
  // sinon /en/docs ne résoudrait pas (le préfixe de langue resterait).
  const path = deLocalizeUrl(url).pathname;
  return guestTarget(path) ?? path;
};
