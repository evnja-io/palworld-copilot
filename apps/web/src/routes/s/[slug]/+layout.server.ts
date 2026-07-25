import { redirect } from "@sveltejs/kit";
import { listMyServers, requireMembership } from "$lib/server/servers";
import { GUEST_SLUG, isGuestRouteId, stripGuestPrefix } from "$lib/guest";
import { deLocalizeHref } from "$lib/paraglide/runtime";
import type { LayoutServerLoadEvent } from "./$types";

export async function load({ locals, params, cookies, url, route }: LayoutServerLoadEvent) {
  // ---- Mode invité : /paldex, /items, … résolus vers /s/__guest/… par le
  // reroute (src/hooks.ts). Aucun accès base, aucune appartenance.
  if (params.slug === GUEST_SLUG) {
    if (locals.user) {
      // Un membre connecté n'a rien à faire en mode invité : on le renvoie vers
      // son serveur, sur le MÊME sous-chemin.
      const myServers = await listMyServers(locals.user.id);
      if (myServers.length === 0) redirect(302, "/servers/new");
      const last = cookies.get("last_server");
      const target = myServers.find((s) => s.slug === last) ?? myServers[0];
      redirect(302, `/s/${target.slug}${guestSubPath(url.pathname)}${url.search}`);
    }
    // Route tenant atteinte via /s/__guest/... tapé à la main.
    if (!isGuestRouteId(route.id)) redirect(302, "/paldex");
    return {
      mode: "guest" as const,
      user: null,
      server: null,
      membership: null,
      myServers: [],
    };
  }

  // ---- Mode membre : inchangé.
  if (!locals.user) redirect(302, "/login");
  const { server, membership } = await requireMembership(locals.user, params.slug);
  const myServers = await listMyServers(locals.user.id);
  // Mémorise le dernier serveur visité (redirection racine, Tâche 9).
  cookies.set("last_server", server.slug, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { mode: "member" as const, user: locals.user, server, membership, myServers };
}

/** Sous-chemin de fonctionnalité à partir de l'URL *affichée*, débarrassé du
 *  préfixe de langue PUIS du préfixe interne :
 *  '/en/paldex/SheepBall' → '/paldex/SheepBall'.
 *  Les deux passes sont nécessaires : sans la première on redirige vers
 *  /s/<slug>/en/paldex, sans la seconde vers /s/<slug>/s/__guest/paldex. */
function guestSubPath(pathname: string): string {
  return stripGuestPrefix(deLocalizeHref(pathname));
}
