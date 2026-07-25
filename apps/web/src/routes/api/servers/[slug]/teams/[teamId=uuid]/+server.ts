import { json } from "@sveltejs/kit";
import { deleteTeam, updateTeam, validateTeamInput } from "$lib/server/teams";
import { requireMembership } from "$lib/server/servers";
import { getPostHogClient } from "$lib/server/posthog";
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
  const posthog = getPostHogClient();
  posthog.capture({ distinctId: event.locals.user!.id, event: "team_deleted", properties: { server_slug: event.params.slug, team_id: event.params.teamId } });
  await posthog.flush();
  return new Response(null, { status: 204 });
}
