// Page d'upload de saves locales (co-op) — réservée au propriétaire du
// serveur. Les layouts ne protègent pas les actions (cf. servers.ts) : chaque
// action re-vérifie requireOwner, comme settings/+page.server.ts.
import { fail } from "@sveltejs/kit";
import { requireOwner } from "$lib/server/servers";
import { cancelUpload, createUpload, finalizeUpload, listUploads } from "$lib/server/uploads";
import type { Actions, PageServerLoadEvent } from "./$types";

// Format UUID générique (mêmes règles que api/servers/[slug]/upload/+server.ts) :
// les id de save_uploads sont des uuid() Postgres (gen_random_uuid()).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readUploadId(data: FormData): string | null {
  const raw = data.get("uploadId");
  if (typeof raw !== "string" || !UUID_PATTERN.test(raw)) return null;
  return raw;
}

export async function load({ locals, params }: PageServerLoadEvent) {
  const { server } = await requireOwner(locals.user, params.slug);
  return {
    serverId: server.id,
    uploads: await listUploads(server.id),
  };
}

export const actions: Actions = {
  start: async ({ locals, params }) => {
    const { server } = await requireOwner(locals.user, params.slug);
    const result = await createUpload(server.id, locals.user!.id);
    if ("error" in result) return fail(409, { error: result.error });
    return { uploadId: result.id };
  },

  finalize: async ({ request, locals, params }) => {
    const { server } = await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const uploadId = readUploadId(data);
    if (!uploadId) return fail(400, { error: "bad_upload_id" });

    const result = await finalizeUpload(server.id, uploadId);
    if (!result.ok) return fail(400, { error: result.error });
    return { finalized: true, dispatched: result.dispatched };
  },

  cancel: async ({ request, locals, params }) => {
    const { server } = await requireOwner(locals.user, params.slug);
    const data = await request.formData();
    const uploadId = readUploadId(data);
    if (!uploadId) return fail(400, { error: "bad_upload_id" });

    const cancelled = await cancelUpload(server.id, uploadId);
    return { cancelled };
  },
};
