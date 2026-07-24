// Endpoint appelé par upload() (@vercel/blob/client) depuis la page d'upload :
// handleUpload gère à la fois la génération de token (avant l'upload direct-to-
// Blob) et la notification de complétion (onUploadCompleted, cf. plus bas).
import { json } from "@sveltejs/kit";
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
      if (typeof clientPayload !== "string") {
        throw new Error("clientPayload manquant");
      }
      let uploadId: unknown;
      try {
        uploadId = (JSON.parse(clientPayload) as { uploadId?: unknown }).uploadId;
      } catch {
        throw new Error("clientPayload invalide (JSON)");
      }
      if (typeof uploadId !== "string") {
        throw new Error("uploadId manquant dans clientPayload");
      }

      const db = getDb();
      const [row] = await db
        .select({ serverId: tables.saveUploads.serverId, status: tables.saveUploads.status })
        .from(tables.saveUploads)
        .where(eq(tables.saveUploads.id, uploadId));
      if (!row || row.serverId !== server.id || row.status !== "uploading") {
        throw new Error("upload introuvable ou déjà finalisé");
      }

      if (!isValidUploadPathname(pathname, server.id, uploadId)) {
        throw new Error("pathname hors motif attendu");
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
    onUploadCompleted: async ({ blob }) => {
      // No-op volontaire : sur Vercel ce callback nécessite une URL de rappel
      // joignable publiquement, jamais le cas en localhost ou derrière la
      // protection de déploiement. Le client appelle finalizeUpload
      // explicitement à la place (cf. lib/server/uploads.ts, tâche 2).
      console.log("upload Blob terminé (callback informatif) :", blob.pathname);
    },
  });

  return json(result);
}
