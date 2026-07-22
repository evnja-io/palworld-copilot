import { error, json } from "@sveltejs/kit";
import { getProgress, isValidEntity, isValidKind, setProgress } from "$lib/server/progress";
import type { RequestEvent } from "./$types";

export async function POST(event: RequestEvent) {
  if (!event.locals.user) error(401);
  const body = await event.request.json().catch(() => null);
  const { kind, entityId, checked } = body ?? {};
  if (typeof kind !== "string" || typeof entityId !== "string" || typeof checked !== "boolean")
    error(400, "kind, entityId, checked requis");
  if (!isValidEntity(kind, entityId)) error(400, "entité inconnue");
  await setProgress(event.locals.user.id, kind, entityId, checked);
  return new Response(null, { status: 204 });
}

export async function GET(event: RequestEvent) {
  if (!event.locals.user) error(401);
  const kind = event.url.searchParams.get("kind") ?? "";
  if (!isValidKind(kind)) error(400, "kind inconnu");
  return json(await getProgress(kind, event.locals.user.id));
}
