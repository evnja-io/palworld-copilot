import { getProgress } from "$lib/server/progress";
import type { PageServerLoadEvent } from "./$types";

export async function load({ locals, parent }: PageServerLoadEvent) {
  const { server } = await parent();
  return { progress: await getProgress(server.id, "pal_caught", locals.user!.id) };
}
