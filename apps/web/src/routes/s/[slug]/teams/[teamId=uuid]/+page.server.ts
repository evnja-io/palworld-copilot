import { error } from "@sveltejs/kit";
import { getTeam } from "$lib/server/teams";
import { getProgress } from "$lib/server/progress";
import { requireMembership } from "$lib/server/servers";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const { server } = await requireMembership(locals.user, params.slug);
  const team = await getTeam(server.id, params.teamId);
  if (!team) error(404);
  return {
    team,
    caught: await getProgress(server.id, "pal_caught", locals.user!.id),
    myUserId: locals.user!.id,
  };
};
