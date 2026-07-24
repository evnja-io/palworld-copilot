// Endpoint appelé par upload() (@vercel/blob/client) depuis la page d'upload :
// handleUpload génère le token client pour l'upload direct-to-Blob. La
// complétion est gérée explicitement par l'action finalize (cf.
// lib/server/uploads.ts), jamais par un callback Blob — cf. onUploadCompleted
// plus bas (délibérément omis).
import { error, json } from "@sveltejs/kit";
import { handleUpload } from "@vercel/blob/client";
import { eq } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { getDb, tables } from "$lib/server/db";
import { requireOwner } from "$lib/server/servers";
import { isValidUploadPathname } from "$lib/server/uploads";
import { MAX_LEVEL_BYTES, MAX_PLAYER_BYTES } from "$lib/upload-limits";
import type { RequestEvent } from "./$types";

/** Plafond de taille selon le type de fichier : Level.sav vs save joueur. */
function maxBytesFor(pathname: string): number {
  return pathname.endsWith("/Level.sav") ? MAX_LEVEL_BYTES : MAX_PLAYER_BYTES;
}

/** Format UUID générique (non restreint à v4) — les id de save_uploads sont
 *  générés par `uuid().defaultRandom()` (Postgres gen_random_uuid()). Rejeter
 *  tôt un uploadId mal formé évite une erreur de cast Postgres (`invalid
 *  input syntax for type uuid`) et permet de retourner un 400 propre. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(event: RequestEvent) {
  // Guard EN PREMIER : même sémantique que sftp-test (401 non authentifié,
  // 404 si non-owner ou slug inconnu — jamais 403, cf. requireOwner).
  const { server } = await requireOwner(event.locals.user, event.params.slug);

  const body = await event.request.json();

  const result = await handleUpload({
    body,
    request: event.request,
    // v2.x lit process.env.BLOB_READ_WRITE_TOKEN automatiquement sur Vercel,
    // mais l'option `token` est acceptée explicitement par HandleUploadOptions
    // (dist/client.d.ts) : on la passe pour rester explicite en local aussi.
    token: env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      // 400 invalid_payload : clientPayload absent/mal formé, ou uploadId
      // manquant/non-UUID — toujours une erreur côté appelant, jamais un bug
      // serveur. 409 bad_state : ligne introuvable / mauvais serveur / statut
      // déjà avancé — état incohérent mais pas nécessairement invalide (course
      // avec finalize/cancel). 400 invalid_pathname : pathname hors motif.
      if (typeof clientPayload !== "string") {
        throw error(400, "invalid_payload");
      }
      let uploadId: unknown;
      try {
        uploadId = (JSON.parse(clientPayload) as { uploadId?: unknown }).uploadId;
      } catch {
        throw error(400, "invalid_payload");
      }
      if (typeof uploadId !== "string" || !UUID_PATTERN.test(uploadId)) {
        throw error(400, "invalid_payload");
      }

      const db = getDb();
      const [row] = await db
        .select({ serverId: tables.saveUploads.serverId, status: tables.saveUploads.status })
        .from(tables.saveUploads)
        .where(eq(tables.saveUploads.id, uploadId));
      if (!row || row.serverId !== server.id || row.status !== "uploading") {
        throw error(409, "bad_state");
      }

      if (!isValidUploadPathname(pathname, server.id, uploadId)) {
        throw error(400, "invalid_pathname");
      }

      return {
        // Checkpoint (vérifié dans node_modules/.pnpm/@vercel+blob@2.6.1/.../
        // dist/client.d.ts) : le type de retour d'onBeforeGenerateToken est
        // Pick<GenerateClientTokenOptions, 'allowedContentTypes' |
        // 'maximumSizeInBytes' | 'validUntil' | 'addRandomSuffix' |
        // 'allowOverwrite' | 'cacheControlMaxAge' | 'ifMatch'> — `access` EN
        // EST EXCLU. Dans cette version, l'accès public/privé n'est plus
        // décidé par le serveur ici mais par l'appel client upload({ access }).
        // La page d'upload (tâche suivante) passera access: "public" ; c'est
        // acceptable ici car le pathname embarque un uploadId UUIDv4 non
        // devinable, et les blobs ne vivent que quelques minutes avant d'être
        // supprimés par finalizeUpload/cancelUpload ou par le worker.
        allowOverwrite: true,
        addRandomSuffix: false,
        maximumSizeInBytes: maxBytesFor(pathname),
      };
    },
    // onUploadCompleted délibérément omis (champ optionnel du type
    // HandleUploadOptions — cf. node_modules/.pnpm/@vercel+blob@2.6.1/.../
    // dist/client.d.ts). Ce callback est de toute façon inatteignable ici :
    // requireOwner ci-dessus exige une session cookie sur CHAQUE POST, alors
    // que l'appel serveur-à-serveur de Vercel Blob (`blob.upload-completed`)
    // n'en porte jamais. La finalisation passe par l'action `finalize`
    // (cf. lib/server/uploads.ts:finalizeUpload), appelée explicitement par
    // le client une fois l'upload direct-to-Blob terminé.
  });

  return json(result);
}
