import { error, json } from "@sveltejs/kit";
import { getProgress, isValidEntity, isValidKind, setProgress } from "$lib/server/progress";
import { requireMembership } from "$lib/server/servers";
import type { RequestEvent } from "./$types";

export async function POST(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const body = await event.request.json().catch(() => null);
  const { kind, entityId, checked } = body ?? {};
  if (typeof kind !== "string" || typeof entityId !== "string" || typeof checked !== "boolean")
    error(400, "kind, entityId, checked requis");
  if (!isValidEntity(kind, entityId)) error(400, "entité inconnue");
  await setProgress(server.id, event.locals.user!.id, kind, entityId, checked);
  return new Response(null, { status: 204 });
}

export async function GET(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const kind = event.url.searchParams.get("kind") ?? "";
  if (!isValidKind(kind)) error(400, "kind inconnu");
  return json(await getProgress(server.id, kind, event.locals.user!.id));
}
