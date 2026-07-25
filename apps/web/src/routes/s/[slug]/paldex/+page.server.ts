import { getProgress } from "$lib/server/progress";
import { EMPTY_PROGRESS } from "$lib/guest";
import type { PageServerLoadEvent } from "./$types";

export async function load({ parent }: PageServerLoadEvent) {
  const p = await parent();
  // Invité : la progression vit en localStorage, pas en base (lib/game/localProgress.ts).
  if (p.mode === "guest") return { progress: EMPTY_PROGRESS };
  return { progress: await getProgress(p.server.id, "pal_caught", p.user.id) };
}
