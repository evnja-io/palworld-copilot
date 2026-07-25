import spawnsIndex from '@palworld-companion/game-data/spawns-index.json';
import type { SpawnPhase } from '$lib/map/spawnLayer';

export type SpawnCounts = { day: number; night: number };

export const spawnCounts = spawnsIndex as Record<string, SpawnCounts>;

/** Phase à ouvrir pour un Pal : celle qu'implique `nocturnal`, sauf si elle
 *  n'a aucune zone. Deux Pals (Penguin_Electric, WindChimes_Ice) sont classés
 *  diurnes mais n'ont de distribution que la nuit — s'en tenir à `nocturnal`
 *  leur ouvrirait une carte vide. */
export function defaultPhase(counts: SpawnCounts | undefined, nocturnal: boolean): SpawnPhase {
	const preferred: SpawnPhase = nocturnal ? 'night' : 'day';
	if (!counts) return preferred;
	const other: SpawnPhase = preferred === 'day' ? 'night' : 'day';
	if (counts[preferred] > 0) return preferred;
	return counts[other] > 0 ? other : preferred;
}

/** Un Pal a des zones si l'une des deux phases en contient. */
export function hasSpawns(counts: SpawnCounts | undefined): boolean {
	return !!counts && counts.day + counts.night > 0;
}
