import { getProgress } from "$lib/server/progress";
import { requireMembership } from "$lib/server/servers";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const { server } = await requireMembership(locals.user, params.slug);
  return { caught: await getProgress(server.id, "pal_caught", locals.user!.id) };
};
