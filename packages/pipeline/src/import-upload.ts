// Worker de traitement des saves navigateur uploadées (co-op local) : télécharge
// les blobs Vercel Blob d'un upload, réutilise le cœur d'import existant
// (import-lib.ts) SANS le modifier, écrit le statut/stats dans save_uploads,
// supprime les blobs puis nettoie /tmp. Deux modes :
//   - ciblé  (UPLOAD_ID défini)  : traite un seul upload (repository_dispatch)
//   - sweep  (UPLOAD_ID absent)  : reprend tous les 'pending' orphelins,
//     purge les lignes bloquées et les blobs orphelins (cron 6h)
// Usage :
//   node --experimental-strip-types src/import-upload.ts
//   UPLOAD_ID=<uuid> node --experimental-strip-types src/import-upload.ts
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { del, list } from "@vercel/blob";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { computeExitCode } from "./import-all.ts";
import { importPlayerSaves, syncPlayerNames } from "./import-lib.ts";

type Sql = NeonQueryFunction<false, false>;

const PLAYER_SAV_PATTERN = /^[0-9A-Fa-f]{32}\.sav$/;
const RUNNING_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2h — job perdu
const UPLOADING_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h — upload jamais finalisé

/** Préfixe Blob dédié à un upload : uploads/<serverId>/<uploadId>/.
 *  Dupliqué depuis apps/web/src/lib/server/uploads.ts (paquets séparés, pas
 *  d'import cross-package possible ici). */
function blobPrefix(serverId: string, uploadId: string): string {
  return `uploads/${serverId}/${uploadId}/`;
}

/** Traduit un pathname Blob (…/<uploadId>/Level.sav ou …/<uploadId>/Players/<GUID>.sav)
 *  en nom de fichier local à plat : "Level.sav" ou "<GUID>.sav". Retourne null
 *  pour toute forme hors des deux motifs attendus — défensif : le endpoint de
 *  token a déjà validé à l'upload, le worker revérifie avant d'écrire sur disque. */
export function localPathFor(pathname: string, uploadId: string): string | null {
  const marker = `/${uploadId}/`;
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;
  const rest = pathname.slice(idx + marker.length);
  if (rest === "Level.sav") return "Level.sav";
  const parts = rest.split("/");
  if (parts.length === 2 && parts[0] === "Players" && PLAYER_SAV_PATTERN.test(parts[1])) {
    return parts[1];
  }
  return null;
}

type StaleRow = {
  status: string;
  startedAt: Date | string | null;
  createdAt: Date | string;
};

/** Classifie une ligne save_uploads pour le nettoyage sweep. Pure : `now` est
 *  injecté par l'appelant (jamais lu ici) pour rester déterministe et testable. */
export function classifyStale(row: StaleRow, now: Date): "running_lost" | "uploading_abandoned" | "ok" {
  if (row.status === "running" && row.startedAt) {
    const startedAt = new Date(row.startedAt);
    if (now.getTime() - startedAt.getTime() > RUNNING_TIMEOUT_MS) return "running_lost";
  }
  if (row.status === "uploading") {
    const createdAt = new Date(row.createdAt);
    if (now.getTime() - createdAt.getTime() > UPLOADING_TIMEOUT_MS) return "uploading_abandoned";
  }
  return "ok";
}

/** Suppression best-effort des blobs d'un upload — ne propage jamais, journalise. */
async function deleteUploadBlobs(serverId: string, uploadId: string, token: string): Promise<void> {
  try {
    const { blobs } = await list({ prefix: blobPrefix(serverId, uploadId), token });
    if (blobs.length > 0) {
      await del(
        blobs.map((b) => b.url),
        { token },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`upload ${uploadId} : échec de suppression des blobs: ${message}`);
  }
}

/** Réclame atomiquement une ligne 'pending' (dispatch ciblé ou sweep) et
 *  retourne son server_id, ou null si déjà réclamée/traitée entre-temps. */
async function claimUpload(sql: Sql, uploadId: string): Promise<string | null> {
  const rows = (await sql`
    update save_uploads set status = 'running', started_at = now()
    where id = ${uploadId}::uuid and status = 'pending'
    returning server_id`) as Array<{ server_id: string }>;
  return rows.length > 0 ? rows[0].server_id : null;
}

/** Traite un upload déjà réclamé (statut 'running') : télécharge les blobs,
 *  importe via import-lib.ts (inchangé), écrit statut/stats, supprime les
 *  blobs et nettoie /tmp. Mirroir du corps par-tenant d'import-all.ts. */
export async function processUpload(sql: Sql, uploadId: string, serverId: string): Promise<{ ok: boolean }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN!;
  const dest = `/tmp/uploads/${uploadId}`;

  try {
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });

    const { blobs } = await list({ prefix: blobPrefix(serverId, uploadId), token });
    let hasPlayerSav = false;
    for (const blob of blobs) {
      const localName = localPathFor(blob.pathname, uploadId);
      if (!localName) {
        console.log(`ignoré (pathname inattendu) : ${blob.pathname}`);
        continue;
      }
      const res = await fetch(blob.downloadUrl ?? blob.url);
      if (!res.ok) throw new Error(`téléchargement échoué pour ${blob.pathname} (HTTP ${res.status})`);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(join(dest, localName), buf);
      if (localName !== "Level.sav") hasPlayerSav = true;
    }
    if (!hasPlayerSav) throw new Error("aucune save joueur");

    const importStats = await importPlayerSaves(sql, serverId, dest);

    // Sync des pseudos non bloquante (cf. import-all.ts) : un Level.sav
    // absent/inattendu ne doit pas invalider un import par ailleurs réussi.
    let players = 0;
    try {
      const syncResult = await syncPlayerNames(sql, serverId, dest);
      players = syncResult.players;
    } catch (syncErr) {
      const syncMessage = syncErr instanceof Error ? syncErr.message : String(syncErr);
      console.error(`upload ${uploadId} : sync des pseudos échouée (non bloquant): ${syncMessage}`);
    }
    const stats = { ...importStats, players };

    // Un import où TOUS les fichiers ont échoué à la conversion doit être
    // signalé en erreur (importPlayerSaves ne throw que si 0 .sav, jamais sur
    // des échecs de conversion individuels).
    const totalFailure = importStats.files > 0 && importStats.failures === importStats.files;
    let ok: boolean;
    if (totalFailure) {
      const message = `tous les fichiers de save ont échoué à la conversion (${importStats.failures}/${importStats.files})`;
      console.error(`upload ${uploadId} : ÉCHEC ${message}`);
      ok = false;
      try {
        await sql`update save_uploads
                  set status = 'error', error = ${message}, stats = ${JSON.stringify(stats)}::jsonb,
                      finished_at = now()
                  where id = ${uploadId}::uuid`;
      } catch (writeErr) {
        const writeMessage = writeErr instanceof Error ? writeErr.message : String(writeErr);
        console.error(`upload ${uploadId} : échec d'écriture du statut error: ${writeMessage}`);
      }
    } else {
      await sql`update save_uploads
                set status = 'ok', error = null, stats = ${JSON.stringify(stats)}::jsonb,
                    finished_at = now()
                where id = ${uploadId}::uuid`;
      console.log(`upload ${uploadId} : OK ${JSON.stringify(stats)}`);
      ok = true;
    }

    // Toujours supprimer les blobs de l'upload, succès ou échec.
    await deleteUploadBlobs(serverId, uploadId, token);
    return { ok };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`upload ${uploadId} : ÉCHEC ${message}`);
    // Comptabiliser l'échec AVANT l'écriture du statut : si cette écriture
    // échoue à son tour, l'upload reste correctement compté comme en échec.
    try {
      await sql`update save_uploads
                set status = 'error', error = ${message}, finished_at = now()
                where id = ${uploadId}::uuid`;
    } catch (writeErr) {
      // Une panne d'écriture du statut ne doit jamais se propager : elle
      // bloquerait le sweep pour les uploads suivants.
      const writeMessage = writeErr instanceof Error ? writeErr.message : String(writeErr);
      console.error(`upload ${uploadId} : échec d'écriture du statut error: ${writeMessage}`);
    }
    await deleteUploadBlobs(serverId, uploadId, token);
    return { ok: false };
  } finally {
    // Level.sav converti ≈ 170 Mo — ne pas laisser traîner entre uploads.
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  }
}

/** Nettoie les lignes bloquées ('running' perdu, 'uploading' abandonné) —
 *  best-effort, chaque échec est journalisé sans interrompre la boucle. */
async function cleanupStale(sql: Sql): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN!;
  const rows = (await sql`
    select id, server_id, status, started_at, created_at
    from save_uploads where status in ('running', 'uploading')`) as Array<{
    id: string;
    server_id: string;
    status: string;
    started_at: Date | string | null;
    created_at: Date | string;
  }>;
  const now = new Date();

  for (const row of rows) {
    const classification = classifyStale(
      { status: row.status, startedAt: row.started_at, createdAt: row.created_at },
      now,
    );
    if (classification === "ok") continue;

    const message = classification === "running_lost" ? "job perdu (timeout worker)" : "upload abandonné";
    try {
      await sql`update save_uploads
                set status = 'error', error = ${message}, finished_at = now()
                where id = ${row.id}::uuid`;
      console.log(`upload ${row.id} : marqué en échec (${message})`);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error(`upload ${row.id} : échec d'écriture du nettoyage stale: ${errMessage}`);
      continue;
    }
    if (classification === "uploading_abandoned") {
      await deleteUploadBlobs(row.server_id, row.id, token);
    }
  }
}

/** Supprime les blobs sous uploads/ qui n'ont pas de ligne save_uploads
 *  correspondante et sont plus vieux que 24h. Best-effort et paginé (le
 *  store peut dépasser la limite par défaut de list()). */
async function cleanupOrphanBlobs(sql: Sql): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN!;
  try {
    const known = (await sql`select distinct id from save_uploads`) as Array<{ id: string }>;
    const knownIds = new Set(known.map((r) => r.id));
    const now = new Date();
    const staleUrls: string[] = [];

    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "uploads/", token, cursor });
      for (const blob of page.blobs) {
        // uploads/<serverId>/<uploadId>/...
        const uploadId = blob.pathname.split("/")[2];
        if (!uploadId || knownIds.has(uploadId)) continue;
        const age = now.getTime() - new Date(blob.uploadedAt).getTime();
        if (age > UPLOADING_TIMEOUT_MS) staleUrls.push(blob.url);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    if (staleUrls.length > 0) {
      await del(staleUrls, { token });
      console.log(`${staleUrls.length} blob(s) orphelin(s) supprimé(s)`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`nettoyage des blobs orphelins échoué (non bloquant): ${message}`);
  }
}

/** Mode ciblé : un seul upload, désigné par UPLOAD_ID (repository_dispatch). */
async function runTargeted(sql: Sql, uploadId: string): Promise<never> {
  const serverId = await claimUpload(sql, uploadId);
  if (!serverId) {
    console.log(`upload ${uploadId} : déjà réclamé ou traité, rien à faire`);
    process.exit(0);
  }
  const result = await processUpload(sql, uploadId, serverId);
  process.exit(computeExitCode([result]));
}

/** Mode sweep (cron 6h) : reprend tous les 'pending' orphelins, puis nettoie
 *  les lignes bloquées et les blobs orphelins. */
async function runSweep(sql: Sql): Promise<never> {
  const pending = (await sql`select id, server_id from save_uploads where status = 'pending'`) as Array<{
    id: string;
    server_id: string;
  }>;
  console.log(`${pending.length} upload(s) en attente`);

  const results: Array<{ ok: boolean }> = [];
  for (const row of pending) {
    const serverId = await claimUpload(sql, row.id);
    if (!serverId) {
      console.log(`upload ${row.id} : déjà réclamé entre-temps, ignoré`);
      continue;
    }
    results.push(await processUpload(sql, row.id, serverId));
  }

  await cleanupStale(sql);
  await cleanupOrphanBlobs(sql);

  process.exit(computeExitCode(results));
}

export async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN manquant");
  const sql = neon(process.env.DATABASE_URL);

  const uploadId = process.env.UPLOAD_ID;
  if (uploadId) {
    await runTargeted(sql, uploadId);
  } else {
    await runSweep(sql);
  }
}

// Exécution directe uniquement : garde l'import du module sûr pour les tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
