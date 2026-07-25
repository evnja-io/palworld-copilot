import { getProgress } from "$lib/server/progress";
import { EMPTY_PROGRESS } from "$lib/guest";
import type { PageServerLoadEvent } from "./$types";

export async function load({ parent }: PageServerLoadEvent) {
  const p = await parent();
  if (p.mode === "guest") return { progress: EMPTY_PROGRESS };
  return { progress: await getProgress(p.server.id, "tech_unlocked", p.user.id) };
}
