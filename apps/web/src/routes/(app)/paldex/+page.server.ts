import { getProgress } from "$lib/server/progress";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals }: PageServerLoadEvent) {
  return { progress: await getProgress("pal_caught", locals.user!.id) };
}
