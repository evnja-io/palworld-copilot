import { listPalInstances } from "$lib/server/pals";
import { getProgress } from "$lib/server/progress";
import { EMPTY_PROGRESS } from "$lib/guest";
import type { PageServerLoadEvent } from "./$types";

export async function load({ parent }: PageServerLoadEvent) {
  // Garde d'accès : le layout parent applique requireMembership (comme paldex).
  const p = await parent();
  // Invité : aucune sauvegarde importée, donc aucune instance. Le mode calc
  // bascule sur la saisie manuelle et le mode path sur les pals cochés en local.
  if (p.mode === "guest") return { owners: [], caught: EMPTY_PROGRESS };
  return {
    owners: await listPalInstances(p.server.id),
    // Alimente le filtre « seulement capturés » du sélecteur de pal.
    caught: await getProgress(p.server.id, "pal_caught", p.user.id),
  };
}
