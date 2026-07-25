import { browser } from "$app/environment";
import { MAX_GUEST_TEAMS } from "$lib/guest";
import type { TeamSlot } from "$lib/types";

/** Équipes d'un invité. Une seule clé (≤20 équipes) : les écritures restent
 *  atomiques, contrairement à une clé par équipe. Mêmes gardes défensives que
 *  lib/game/localProgress.ts — un stockage indisponible ne casse rien. */
export const LOCAL_TEAMS_KEY = "guest-teams-v1";

/** Plafond volontairement bas : au-delà, l'invité a de quoi créer un serveur. */
export const MAX_LOCAL_TEAMS = MAX_GUEST_TEAMS;

export type LocalTeam = {
  id: string;
  name: string;
  notes: string;
  slots: TeamSlot[];
  updatedAt: string;
};

type Envelope = { version: 1; teams: LocalTeam[] };

/** Un slot venant du stockage est-il de la forme attendue ?
 *  Le contenu n'est PAS validé ici (ids d'espèce/passifs) : c'est le rôle du
 *  serveur à l'import (validateTeamInput). On écarte juste ce qui casserait
 *  l'affichage. */
function isSlotShape(v: unknown): v is TeamSlot {
  if (v === null) return true;
  if (typeof v !== "object" || Array.isArray(v)) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.palId === "string" && Array.isArray(s.passives) && Array.isArray(s.actives)
  );
}

function isTeamShape(v: unknown): v is LocalTeam {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    typeof t.notes === "string" &&
    Array.isArray(t.slots) &&
    t.slots.every(isSlotShape) &&
    typeof t.updatedAt === "string"
  );
}

function read(): LocalTeam[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(LOCAL_TEAMS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return [];
    const teams = (parsed as Envelope).teams;
    if (!Array.isArray(teams)) return [];
    return teams.filter(isTeamShape).slice(0, MAX_LOCAL_TEAMS);
  } catch {
    return [];
  }
}

function write(teams: LocalTeam[]): void {
  if (!browser) return;
  try {
    const envelope: Envelope = { version: 1, teams: teams.slice(0, MAX_LOCAL_TEAMS) };
    localStorage.setItem(LOCAL_TEAMS_KEY, JSON.stringify(envelope));
  } catch {
    /* quota / navigation privée : la session reste utilisable */
  }
}

/** Plus récemment modifiée d'abord, comme listTeams côté serveur. */
export function listLocalTeams(): LocalTeam[] {
  return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLocalTeam(id: string): LocalTeam | null {
  return read().find((t) => t.id === id) ?? null;
}

export function countLocalTeams(): number {
  return read().length;
}

/** Crée ou remplace. Renvoie false si le plafond est atteint pour une création. */
export function upsertLocalTeam(team: LocalTeam): boolean {
  const teams = read();
  const at = teams.findIndex((t) => t.id === team.id);
  if (at === -1) {
    if (teams.length >= MAX_LOCAL_TEAMS) return false;
    teams.push(team);
  } else {
    teams[at] = team;
  }
  write(teams);
  return true;
}

export function deleteLocalTeam(id: string): void {
  write(read().filter((t) => t.id !== id));
}

/** Purge, après un import réussi vers un serveur. */
export function clearLocalTeams(): void {
  if (!browser) return;
  try {
    localStorage.removeItem(LOCAL_TEAMS_KEY);
  } catch {
    /* ignore */
  }
}
