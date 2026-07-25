import { error } from "@sveltejs/kit";
import { GUEST_PROGRESS_KINDS, MAX_GUEST_TEAMS } from "$lib/guest";
import { isValidEntity } from "$lib/server/progress";
import { validateTeamInput, type TeamInput } from "$lib/server/teams";

/** Plafond par kind : marker ~138, tech ~313, pals 288. Large, mais borné —
 *  la charge utile vient du navigateur, donc de l'utilisateur. */
export const MAX_IDS_PER_KIND = 2000;

export type GuestImportPayload = {
  /** Ids déjà filtrés au registre, dédupliqués, par kind. */
  progress: Record<string, string[]>;
  teams: TeamInput[];
};

/** Valide la reprise d'un travail fait en mode invité. Toute la validation a
 *  lieu ici, AVANT la moindre écriture : un payload malformé ne doit pas
 *  laisser la progression à moitié importée (Neon HTTP n'a pas de transaction).
 *  Lève un 400 sur toute structure inattendue. */
export function parseGuestImport(body: unknown): GuestImportPayload {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    error(400, "payload invalide");
  const { progress, teams } = body as Record<string, unknown>;

  const out: Record<string, string[]> = {};
  if (progress !== undefined) {
    if (typeof progress !== "object" || progress === null || Array.isArray(progress))
      error(400, "progress invalide");
    for (const kind of GUEST_PROGRESS_KINDS) {
      const raw = (progress as Record<string, unknown>)[kind];
      if (raw === undefined) continue;
      if (!Array.isArray(raw) || raw.length > MAX_IDS_PER_KIND) error(400, `${kind} invalide`);
      // Filtrage au registre : un id inconnu est ignoré, pas rejeté — le
      // stockage local peut être plus ancien qu'une régénération de game-data.
      out[kind] = [...new Set(raw.filter((id): id is string => typeof id === "string"))].filter(
        (id) => isValidEntity(kind, id),
      );
    }
  }

  let parsedTeams: TeamInput[] = [];
  if (teams !== undefined) {
    if (!Array.isArray(teams) || teams.length > MAX_GUEST_TEAMS) error(400, "teams invalide");
    // Mêmes gardes que l'API teams : ids d'espèce/passifs/skills, longueurs,
    // clés exactes, pollution de prototype.
    parsedTeams = teams.map(validateTeamInput);
  }

  return { progress: out, teams: parsedTeams };
}
