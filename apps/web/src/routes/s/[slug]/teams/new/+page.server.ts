import { getProgress } from "$lib/server/progress";
import { requireMembership } from "$lib/server/servers";
import { EMPTY_PROGRESS, GUEST_SLUG } from "$lib/guest";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  // Invité : le filtre « seulement capturés » du sélecteur se lit en local.
  if (params.slug === GUEST_SLUG) return { caught: EMPTY_PROGRESS };
  const { server } = await requireMembership(locals.user, params.slug);
  return { caught: await getProgress(server.id, "pal_caught", locals.user!.id) };
};
