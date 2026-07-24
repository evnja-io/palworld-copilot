import { listPalInstances } from "$lib/server/pals";
import type { PageServerLoadEvent } from "./$types";

export async function load({ parent }: PageServerLoadEvent) {
  // Garde d'accès : le layout parent applique requireMembership (comme paldex).
  const { server } = await parent();
  return { owners: await listPalInstances(server.id) };
}
