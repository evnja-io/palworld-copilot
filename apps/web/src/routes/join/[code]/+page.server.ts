import { fail, redirect } from "@sveltejs/kit";
import { consumeInvite, InviteError, peekInvite } from "$lib/server/servers";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ locals, params }: PageServerLoadEvent) {
  const invite = await peekInvite(params.code);
  return { invite, loggedIn: !!locals.user };
}

export const actions: Actions = {
  default: async ({ locals, params }) => {
    if (!locals.user) redirect(302, "/login");
    let slug: string;
    try {
      slug = (await consumeInvite(params.code, locals.user.id)).slug;
    } catch (err) {
      if (err instanceof InviteError) return fail(409, { error: err.code });
      throw err;
    }
    redirect(303, `/s/${slug}`);
  },
};
