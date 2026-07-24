import { json } from "@sveltejs/kit";
import { createTeam, validateTeamInput } from "$lib/server/teams";
import { requireMembership } from "$lib/server/servers";
import type { RequestEvent } from "./$types";

export async function POST(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const input = validateTeamInput(await event.request.json().catch(() => null));
  const team = await createTeam(server.id, event.locals.user!.id, input);
  return json(team, { status: 201 });
}
