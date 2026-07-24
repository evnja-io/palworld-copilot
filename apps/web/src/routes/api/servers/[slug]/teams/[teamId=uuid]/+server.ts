import { json } from "@sveltejs/kit";
import { deleteTeam, updateTeam, validateTeamInput } from "$lib/server/teams";
import { requireMembership } from "$lib/server/servers";
import type { RequestEvent } from "./$types";

export async function PUT(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const input = validateTeamInput(await event.request.json().catch(() => null));
  const team = await updateTeam(server.id, event.params.teamId, event.locals.user!.id, input);
  return json(team);
}

export async function DELETE(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  await deleteTeam(server.id, event.params.teamId, event.locals.user!.id);
  return new Response(null, { status: 204 });
}
