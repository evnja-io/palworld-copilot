import { fail } from "@sveltejs/kit";
import { ClaimError, claimGuid, listSnapshots } from "$lib/server/import";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ locals }: PageServerLoadEvent) {
  return {
    snapshots: await listSnapshots(),
    mine: locals.user!.palPlayerGuid,
  };
}

export const actions: Actions = {
  claim: async ({ request, locals }) => {
    const data = await request.formData();
    const guid = data.get("guid");
    if (typeof guid !== "string" || guid.length === 0) {
      return fail(400, { error: "GUID manquant." });
    }
    try {
      await claimGuid(locals.user!.id, guid);
    } catch (err) {
      if (err instanceof ClaimError) return fail(409, { error: err.message });
      throw err;
    }
    return { success: true };
  },
};
