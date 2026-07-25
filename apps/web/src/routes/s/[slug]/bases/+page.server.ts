import { listGuildBases } from "$lib/server/bases";
import { listPalInstances } from "$lib/server/pals";
import type { PageServerLoadEvent } from "./$types";

export async function load({ parent }: PageServerLoadEvent) {
  // Garde d'accès : le layout parent applique requireMembership (comme paldex).
  const p = await parent();
  // Invité : aucune donnée de sauvegarde. Symétrie avec breeding, le layout
  // bloque déjà /s/__guest/bases (route absente de GUEST_FEATURES).
  if (p.mode === "guest") return { guilds: [], owners: [] };
  return {
    guilds: await listGuildBases(p.server.id),
    // Pool de recommandations : toutes les instances du serveur, par propriétaire.
    owners: await listPalInstances(p.server.id),
  };
}
