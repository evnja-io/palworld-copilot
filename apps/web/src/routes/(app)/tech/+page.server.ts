import { getProgress } from "$lib/server/progress";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals }: PageServerLoadEvent) {
  return { progress: await getProgress("tech_unlocked", locals.user!.id) };
}
