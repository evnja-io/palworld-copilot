import { fail, isHttpError, redirect } from "@sveltejs/kit";
import { createServer, type ServerKind } from "$lib/server/servers";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ locals }: PageServerLoadEvent) {
  if (!locals.user) redirect(302, "/login");
  return {};
}

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) redirect(302, "/login");
    const data = await request.formData();
    const name = data.get("name");
    const kindRaw = data.get("kind");
    if (typeof name !== "string" || name.trim().length === 0) {
      return fail(400, { error: "name_required" });
    }
    const kind: ServerKind = kindRaw === "dedicated" ? "dedicated" : "local";
    let slug: string;
    try {
      slug = (await createServer(locals.user.id, name, kind)).slug;
    } catch (err) {
      if (isHttpError(err, 403)) return fail(403, { error: "server_limit" });
      throw err;
    }
    // Assistant post-création : configuration de l'import puis invitation.
    redirect(303, `/s/${slug}/setup`);
  },
};
