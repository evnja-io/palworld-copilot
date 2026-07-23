import { redirect } from "@sveltejs/kit";
import { listMyServers } from "$lib/server/servers";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals }: PageServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  return { servers: await listMyServers(locals.user.id) };
}
