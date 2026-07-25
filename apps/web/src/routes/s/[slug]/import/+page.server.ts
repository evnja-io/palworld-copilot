import { fail, redirect } from "@sveltejs/kit";
import { ClaimError, claimGuid, listSnapshots } from "$lib/server/import";
import { requireMembership } from "$lib/server/servers";
import { getPostHogClient } from "$lib/server/posthog";
import type { Actions, PageServerLoadEvent } from "./$types";

export async function load({ parent }: PageServerLoadEvent) {
  const p = await parent();
  // Synchro de sauvegarde : réservée aux membres.
  if (p.mode === "guest") redirect(302, "/paldex");
  return { snapshots: await listSnapshots(p.server.id), mine: p.membership.palPlayerGuid };
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
    const posthog = getPostHogClient();
    posthog.capture({ distinctId: locals.user!.id, event: "pal_claimed", properties: { server_slug: params.slug } });
    await posthog.flush();
    return { success: true };
  },
};
