import { listTeams } from "$lib/server/teams";
import { requireMembership } from "$lib/server/servers";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const { server } = await requireMembership(locals.user, params.slug);
  return { teams: await listTeams(server.id), myUserId: locals.user!.id };
};
