import { json } from "@sveltejs/kit";
import { createTeam, validateTeamInput } from "$lib/server/teams";
import { requireMembership } from "$lib/server/servers";
import { getPostHogClient } from "$lib/server/posthog";
import type { RequestEvent } from "./$types";

export async function POST(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const input = validateTeamInput(await event.request.json().catch(() => null));
  const team = await createTeam(server.id, event.locals.user!.id, input);
  const posthog = getPostHogClient();
  posthog.capture({ distinctId: event.locals.user!.id, event: "team_created", properties: { server_slug: event.params.slug, team_id: team.id } });
  await posthog.flush();
  return json(team, { status: 201 });
}
