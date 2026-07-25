import { error } from "@sveltejs/kit";
import pals from "@palworld-companion/game-data/pals.json";
import { getProgress } from "$lib/server/progress";
import { EMPTY_PROGRESS } from "$lib/guest";
import type { PageServerLoadEvent } from "./$types";

export async function load({ params, parent }: PageServerLoadEvent) {
  if (!(pals as Array<{ id: string }>).some((p) => p.id === params.palId)) error(404);
  const p = await parent();
  if (p.mode === "guest") return { palId: params.palId, progress: EMPTY_PROGRESS };
  return {
    palId: params.palId,
    progress: await getProgress(p.server.id, "pal_caught", p.user.id),
  };
}
