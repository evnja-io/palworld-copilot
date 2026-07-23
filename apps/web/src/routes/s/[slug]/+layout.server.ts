import { redirect } from "@sveltejs/kit";
import { listMyServers, requireMembership } from "$lib/server/servers";
import type { LayoutServerLoadEvent } from "./$types";

export async function load({ locals, params, cookies }: LayoutServerLoadEvent) {
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
  return { user: locals.user, server, membership, myServers };
}
