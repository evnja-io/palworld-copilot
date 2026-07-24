import { error } from "@sveltejs/kit";
import { and, desc, eq, sql } from "drizzle-orm";
import { ACTIVE_SKILL_IDS, PAL_IDS, PASSIVE_IDS } from "$lib/game/team-data";
import { getDb, tables } from "$lib/server/db";
import type { TeamSlot } from "$lib/types";

export type TeamInput = { name: string; notes: string; slots: TeamSlot[] };

export const MAX_SLOTS = 5;
export const MAX_PASSIVES = 4;
export const MAX_ACTIVES = 3;
export const MAX_TEAMS_PER_SERVER = 100;

const SLOT_KEYS = new Set(["palId", "passives", "actives"]);

function validIdList(v: unknown, max: number, registry: Set<string>): v is string[] {
  if (!Array.isArray(v) || v.length > max) return false;
  if (v.some((x) => typeof x !== "string" || !registry.has(x))) return false;
  return new Set(v).size === v.length;
}

function validateSlot(raw: unknown): TeamSlot {
  if (raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) error(400, "slot invalide");

  const { palId, passives, actives } = raw as Record<string, unknown>;
  if (typeof palId !== "string" || !PAL_IDS.has(palId)) error(400, "pal inconnu");
  if (!validIdList(passives, MAX_PASSIVES, PASSIVE_IDS)) error(400, "passifs invalides");
  if (!validIdList(actives, MAX_ACTIVES, ACTIVE_SKILL_IDS)) error(400, "skills invalides");

  // Check all properties are expected (exact match on count and keys)
  const keys = Object.keys(raw as object);
  if (keys.length !== SLOT_KEYS.size || keys.some((k) => !SLOT_KEYS.has(k)))
    error(400, "slot invalide");

  // Prevent prototype pollution
  const proto = Object.getPrototypeOf(raw);
  if (proto !== Object.prototype) {
    error(400, "slot invalide");
  }

  return { palId, passives, actives };
}

/** Valide et normalise un payload d'équipe (400 sinon). Slots paddés à 5 null. */
export function validateTeamInput(raw: unknown): TeamInput {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw))
    error(400, "payload invalide");
  const { name, notes, slots } = raw as Record<string, unknown>;
  if (typeof name !== "string") error(400, "nom requis");
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 80) error(400, "nom : 1 à 80 caractères");
  if (typeof notes !== "string" || notes.length > 2000) error(400, "notes : 2000 caractères max");
  if (!Array.isArray(slots) || slots.length > MAX_SLOTS) error(400, "5 slots maximum");
  const parsed = slots.map(validateSlot);
  while (parsed.length < MAX_SLOTS) parsed.push(null);
  return { name: trimmed, notes, slots: parsed };
}

export type TeamRow = {
  id: string;
  name: string;
  notes: string;
  slots: TeamSlot[];
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  updatedAt: Date;
};

const teamSelect = {
  id: tables.teams.id,
  name: tables.teams.name,
  notes: tables.teams.notes,
  slots: tables.teams.slots,
  authorId: tables.teams.authorId,
  authorName: tables.users.username,
  authorAvatarUrl: tables.users.avatarUrl,
  updatedAt: tables.teams.updatedAt,
};

export async function listTeams(serverId: string): Promise<TeamRow[]> {
  const db = getDb();
  return db
    .select(teamSelect)
    .from(tables.teams)
    .innerJoin(tables.users, eq(tables.teams.authorId, tables.users.id))
    .where(eq(tables.teams.serverId, serverId))
    .orderBy(desc(tables.teams.updatedAt));
}

export async function getTeam(serverId: string, teamId: string): Promise<TeamRow | null> {
  const db = getDb();
  const rows = await db
    .select(teamSelect)
    .from(tables.teams)
    .innerJoin(tables.users, eq(tables.teams.authorId, tables.users.id))
    .where(and(eq(tables.teams.id, teamId), eq(tables.teams.serverId, serverId)));
  return rows[0] ?? null;
}

export async function createTeam(
  serverId: string,
  userId: string,
  input: TeamInput,
): Promise<TeamRow> {
  const db = getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tables.teams)
    .where(eq(tables.teams.serverId, serverId));
  if (n >= MAX_TEAMS_PER_SERVER) error(403, "Limite de 100 équipes atteinte");
  const [row] = await db
    .insert(tables.teams)
    .values({ serverId, authorId: userId, ...input })
    .returning({ id: tables.teams.id });
  return (await getTeam(serverId, row.id))!;
}

/** UPDATE … WHERE id AND server_id AND author_id ; 0 ligne → re-select pour
 *  distinguer 404 (inconnu) de 403 (pas l'auteur). */
export async function updateTeam(
  serverId: string,
  teamId: string,
  userId: string,
  input: TeamInput,
): Promise<TeamRow> {
  const db = getDb();
  const updated = await db
    .update(tables.teams)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(
        eq(tables.teams.id, teamId),
        eq(tables.teams.serverId, serverId),
        eq(tables.teams.authorId, userId),
      ),
    )
    .returning({ id: tables.teams.id });
  if (updated.length === 0) {
    const existing = await getTeam(serverId, teamId);
    if (!existing) error(404, "équipe inconnue");
    error(403, "seul l'auteur peut modifier cette équipe");
  }
  return (await getTeam(serverId, teamId))!;
}

export async function deleteTeam(serverId: string, teamId: string, userId: string): Promise<void> {
  const db = getDb();
  const deleted = await db
    .delete(tables.teams)
    .where(
      and(
        eq(tables.teams.id, teamId),
        eq(tables.teams.serverId, serverId),
        eq(tables.teams.authorId, userId),
      ),
    )
    .returning({ id: tables.teams.id });
  if (deleted.length === 0) {
    const existing = await getTeam(serverId, teamId);
    if (!existing) error(404, "équipe inconnue");
    error(403, "seul l'auteur peut supprimer cette équipe");
  }
}
