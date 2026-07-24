// Upload de saves navigateur (co-op local) : cycle de vie
// uploading -> pending -> running -> ok|error, stocké dans save_uploads.
// Les fichiers transitent par Vercel Blob sous le préfixe blobPrefix(serverId, uploadId).
import { del, list } from "@vercel/blob";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { getDb, tables } from "$lib/server/db";
import { MAX_FILES, MAX_LEVEL_BYTES, MAX_PLAYER_BYTES, PLAYER_SAV_PATTERN } from "$lib/upload-limits";
import { dispatchImportUpload } from "./github";

/** Préfixe Blob dédié à un upload : uploads/<serverId>/<uploadId>/. */
export function blobPrefix(serverId: string, uploadId: string): string {
  return `uploads/${serverId}/${uploadId}/`;
}

/** Valide qu'un pathname Blob appartient bien à cet upload et respecte la
 *  forme attendue : <prefix>Level.sav ou <prefix>Players/<32 hex>.sav.
 *  Rejette toute traversée (../), imbrication ou nom hors motif. */
export function isValidUploadPathname(
  pathname: string,
  serverId: string,
  uploadId: string,
): boolean {
  const prefix = blobPrefix(serverId, uploadId);
  if (!pathname.startsWith(prefix)) return false;
  const rest = pathname.slice(prefix.length);
  if (rest === "Level.sav") return true;
  const parts = rest.split("/");
  return parts.length === 2 && parts[0] === "Players" && PLAYER_SAV_PATTERN.test(parts[1]);
}

export type BlobListItem = { pathname: string; size: number };

export type BlobListingValidation =
  | { ok: true; fileCount: number; totalBytes: number }
  | { ok: false; error: string };

/** Valide le contenu d'un dossier d'upload avant transition vers 'pending' :
 *  pathnames conformes, présence de Level.sav et d'au moins une save joueur,
 *  quota de fichiers et plafonds de taille (level vs joueur). Code d'erreur
 *  court, mappé côté UI plus tard. */
export function validateBlobListing(
  blobs: BlobListItem[],
  serverId: string,
  uploadId: string,
): BlobListingValidation {
  if (blobs.length === 0) return { ok: false, error: "empty" };
  if (blobs.length > MAX_FILES) return { ok: false, error: "too_many_files" };

  let hasLevel = false;
  let playerCount = 0;
  let totalBytes = 0;

  for (const blob of blobs) {
    if (!isValidUploadPathname(blob.pathname, serverId, uploadId)) {
      return { ok: false, error: "invalid_pathname" };
    }
    const isLevel = blob.pathname.endsWith("/Level.sav");
    if (isLevel) {
      if (blob.size > MAX_LEVEL_BYTES) return { ok: false, error: "level_too_large" };
      hasLevel = true;
    } else {
      if (blob.size > MAX_PLAYER_BYTES) return { ok: false, error: "player_too_large" };
      playerCount++;
    }
    totalBytes += blob.size;
  }

  if (!hasLevel) return { ok: false, error: "missing_level" };
  if (playerCount === 0) return { ok: false, error: "missing_player" };

  return { ok: true, fileCount: blobs.length, totalBytes };
}

/** Crée un upload (statut initial 'uploading'). Single-flight par serveur :
 *  INSERT ... ON CONFLICT DO NOTHING contre l'index unique partiel
 *  save_uploads_active_unique (schema.ts) — un seul statement, donc pas de
 *  fenêtre TOCTOU entre deux appels concurrents pour le même serveur. */
export async function createUpload(
  serverId: string,
  userId: string,
): Promise<{ id: string } | { error: "already_active" }> {
  const db = getDb();
  const [row] = await db
    .insert(tables.saveUploads)
    .values({ serverId, uploadedBy: userId })
    .onConflictDoNothing({
      target: tables.saveUploads.serverId,
      where: sql`${tables.saveUploads.status} in ('uploading', 'pending', 'running')`,
    })
    .returning({ id: tables.saveUploads.id });
  if (!row) return { error: "already_active" };
  return { id: row.id };
}

/** Finalise un upload une fois les fichiers déposés côté client : liste le
 *  Blob, valide le contenu, bascule la ligne en 'pending' (transition
 *  atomique) puis déclenche le worker GitHub. Un échec de dispatch n'est pas
 *  fatal (le sweep cron de 6h reprend les 'pending' orphelins). */
export async function finalizeUpload(
  serverId: string,
  uploadId: string,
): Promise<{ ok: true; dispatched: boolean } | { ok: false; error: string }> {
  const { blobs } = await list({
    prefix: blobPrefix(serverId, uploadId),
    token: env.BLOB_READ_WRITE_TOKEN,
  });

  const validation = validateBlobListing(blobs, serverId, uploadId);
  if (!validation.ok) return { ok: false, error: validation.error };

  const db = getDb();
  const updated = await db
    .update(tables.saveUploads)
    .set({
      status: "pending",
      fileCount: validation.fileCount,
      totalBytes: validation.totalBytes,
    })
    .where(
      and(
        eq(tables.saveUploads.id, uploadId),
        eq(tables.saveUploads.serverId, serverId),
        eq(tables.saveUploads.status, "uploading"),
      ),
    )
    .returning({ id: tables.saveUploads.id });
  if (updated.length === 0) return { ok: false, error: "bad_state" };

  try {
    await dispatchImportUpload({ uploadId, serverId });
    return { ok: true, dispatched: true };
  } catch (err) {
    console.error("dispatchImportUpload a échoué :", err);
    return { ok: true, dispatched: false };
  }
}

/** Historique des uploads d'un serveur, plus récent d'abord. */
export async function listUploads(serverId: string, limit = 5) {
  const db = getDb();
  return db
    .select()
    .from(tables.saveUploads)
    .where(eq(tables.saveUploads.serverId, serverId))
    .orderBy(desc(tables.saveUploads.createdAt))
    .limit(limit);
}

/** Annule un upload non démarré (uploading/pending) — jamais un 'running',
 *  qui appartient au worker. Transition atomique puis suppression best-effort
 *  des blobs déjà déposés. */
export async function cancelUpload(serverId: string, uploadId: string): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(tables.saveUploads)
    .set({ status: "error", error: "cancelled", finishedAt: new Date() })
    .where(
      and(
        eq(tables.saveUploads.id, uploadId),
        eq(tables.saveUploads.serverId, serverId),
        inArray(tables.saveUploads.status, ["uploading", "pending"]),
      ),
    )
    .returning({ id: tables.saveUploads.id });
  if (updated.length === 0) return false;

  try {
    const { blobs } = await list({
      prefix: blobPrefix(serverId, uploadId),
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    if (blobs.length > 0) {
      await del(
        blobs.map((b) => b.url),
        { token: env.BLOB_READ_WRITE_TOKEN },
      );
    }
  } catch (err) {
    console.error("échec de suppression des blobs annulés :", err);
  }

  return true;
}
