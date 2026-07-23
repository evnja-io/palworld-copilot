import { redirect } from "@sveltejs/kit";
import { listMyServers } from "$lib/server/servers";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals, cookies }: PageServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  const mine = await listMyServers(locals.user.id);
  // Aucun serveur → page de choix/création. Sinon dernier serveur visité
  // (cookie posé par le layout /s/[slug]), à défaut le premier.
  if (mine.length === 0) redirect(302, "/servers");
  const last = cookies.get("last_server");
  const target = mine.find((s) => s.slug === last) ?? mine[0];
  redirect(302, `/s/${target.slug}`);
}
