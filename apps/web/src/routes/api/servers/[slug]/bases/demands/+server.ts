import { error } from "@sveltejs/kit";
import { WORK_KEYS } from "$lib/game/basework";
import { setBaseDemand } from "$lib/server/bases";
import { requireMembership } from "$lib/server/servers";
import type { RequestEvent } from "./$types";

// Upsert du poids de demande d'un type de travail pour une base.
// Éditable par tout membre (requireMembership suffit, décision produit).
export async function POST(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const body = await event.request.json().catch(() => null);
  const { baseId, workType, weight } = body ?? {};
  if (typeof baseId !== "string" || !/^[0-9A-F]{32}$/.test(baseId)) error(400, "baseId invalide");
  if (typeof workType !== "string" || !(WORK_KEYS as readonly string[]).includes(workType))
    error(400, "workType inconnu");
  if (!Number.isInteger(weight) || weight < 0 || weight > 3) error(400, "weight 0..3 requis");
  if (!(await setBaseDemand(server.id, baseId, workType, weight))) error(404, "base inconnue");
  return new Response(null, { status: 204 });
}
