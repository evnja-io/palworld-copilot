import { redirect } from "@sveltejs/kit";
import { listMyServers } from "$lib/server/servers";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals }: PageServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  const mine = await listMyServers(locals.user.id);
  // Phase 1 : tout utilisateur autorisé est membre du serveur legacy (backfill
  // + shim du callback). La page /servers (choix multiple) arrive en phase 2.
  if (mine.length === 0) redirect(302, "/login/denied");
  redirect(302, `/s/${mine[0].slug}`);
}
