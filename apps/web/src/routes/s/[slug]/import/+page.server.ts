import { fail } from "@sveltejs/kit";
import { ClaimError, claimGuid, listSnapshots } from "$lib/server/import";
import { requireMembership } from "$lib/server/servers";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ parent }: PageServerLoadEvent) {
  const { server, membership } = await parent();
  return { snapshots: await listSnapshots(server.id), mine: membership.palPlayerGuid };
}

export const actions: Actions = {
  claim: async ({ request, locals, params }) => {
    const { server } = await requireMembership(locals.user, params.slug);
    const data = await request.formData();
    const guid = data.get("guid");
    if (typeof guid !== "string" || guid.length === 0) {
      return fail(400, { error: "guid_missing" });
    }
    try {
      await claimGuid(server.id, locals.user!.id, guid);
    } catch (err) {
      if (err instanceof ClaimError) return fail(409, { error: err.code });
      throw err;
    }
    return { success: true };
  },
};
