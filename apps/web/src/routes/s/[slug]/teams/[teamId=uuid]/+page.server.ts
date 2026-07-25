import { error } from "@sveltejs/kit";
import { getTeam } from "$lib/server/teams";
import { getProgress } from "$lib/server/progress";
import { requireMembership } from "$lib/server/servers";
import { EMPTY_PROGRESS, GUEST_SLUG } from "$lib/guest";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  // Invité : équipe illisible côté serveur (localStorage). `team: null` signale
  // à la page qu'elle doit la résoudre au montage — un 404 ici serait faux.
  if (params.slug === GUEST_SLUG) {
    return { team: null, caught: EMPTY_PROGRESS, myUserId: null };
  }
  const { server } = await requireMembership(locals.user, params.slug);
  const team = await getTeam(server.id, params.teamId);
  if (!team) error(404);
  return {
    team,
    caught: await getProgress(server.id, "pal_caught", locals.user!.id),
    myUserId: locals.user!.id,
  };
};
