import { listTeams } from "$lib/server/teams";
import { requireMembership } from "$lib/server/servers";
import { GUEST_SLUG } from "$lib/guest";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  // Invité : les équipes vivent en localStorage, donc illisibles côté serveur.
  // La page les hydrate au montage (lib/game/localTeams.ts).
  if (params.slug === GUEST_SLUG) return { teams: [], myUserId: null };
  const { server } = await requireMembership(locals.user, params.slug);
  return { teams: await listTeams(server.id), myUserId: locals.user!.id };
};
