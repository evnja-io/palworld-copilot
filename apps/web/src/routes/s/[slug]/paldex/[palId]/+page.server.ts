import { error } from "@sveltejs/kit";
import pals from "@palworld-companion/game-data/pals.json";
import { getProgress } from "$lib/server/progress";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals, params, parent }: PageServerLoadEvent) {
  if (!(pals as Array<{ id: string }>).some((p) => p.id === params.palId)) error(404);
  const { server } = await parent();
  return {
    palId: params.palId,
    progress: await getProgress(server.id, "pal_caught", locals.user!.id),
  };
}
