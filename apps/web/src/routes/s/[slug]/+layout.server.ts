import { redirect } from "@sveltejs/kit";
import { requireMembership } from "$lib/server/servers";
import type { LayoutServerLoadEvent } from "./$types";

export async function load({ locals, params }: LayoutServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  const { server, membership } = await requireMembership(locals.user, params.slug);
  return { user: locals.user, server, membership };
}
