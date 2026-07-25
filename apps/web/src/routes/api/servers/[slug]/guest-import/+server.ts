import { json } from "@sveltejs/kit";
import { getDb, tables } from "$lib/server/db";
import { parseGuestImport } from "$lib/server/guestImport";
import { requireMembership } from "$lib/server/servers";
import { createTeam } from "$lib/server/teams";
import type { RequestEvent } from "./$types";

/** Reprise du travail fait en mode invité (localStorage) vers un serveur.
 *  Déclenché par la bannière du shell après une création de serveur ou une
 *  adhésion par invitation.
 *
 *  Sémantique : fusion ADDITIVE, jamais de suppression. Réexécuter l'appel est
 *  donc sans effet sur la progression (onConflictDoNothing) — c'est le client
 *  qui purge son stockage local, et seulement après un succès confirmé. */

/** Neon HTTP n'a pas de transaction : on insère par lots bornés. */
const CHUNK = 500;

export async function POST(event: RequestEvent) {
  const { server } = await requireMembership(event.locals.user, event.params.slug);
  const userId = event.locals.user!.id;
  const body = await event.request.json().catch(() => null);

  // Validation complète avant toute écriture (cf. lib/server/guestImport.ts).
  const payload = parseGuestImport(body);

  const rows = Object.entries(payload.progress).flatMap(([kind, ids]) =>
    ids.map((entityId) => ({ serverId: server.id, userId, kind, entityId })),
  );

  const db = getDb();
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(tables.progress)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoNothing();
  }

  // L'id local n'est jamais réutilisé : le serveur réémet le sien.
  // createTeam lève un 403 au-delà de MAX_TEAMS_PER_SERVER ; faute de
  // transaction, on rend compte de ce qui est réellement passé plutôt que de
  // faire échouer tout l'appel après avoir déjà écrit la progression.
  let importedTeams = 0;
  let teamsTruncated = false;
  for (const input of payload.teams) {
    try {
      await createTeam(server.id, userId, input);
      importedTeams++;
    } catch {
      teamsTruncated = true;
      break;
    }
  }

  const importedProgress = Object.fromEntries(
    Object.entries(payload.progress).map(([kind, ids]) => [kind, ids.length]),
  );
  return json({ progress: importedProgress, teams: importedTeams, teamsTruncated });
}
