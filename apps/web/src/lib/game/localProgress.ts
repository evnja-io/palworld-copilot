import { browser } from "$app/environment";

/** Progression d'un invité : source de vérité en localStorage, une clé par kind
 *  (écritures petites et indépendantes). Même schéma défensif que
 *  lib/map/mapState.svelte.ts : tout est enveloppé, un stockage indisponible
 *  (navigation privée, quota) ne doit jamais casser la page. */
export const localProgressKey = (kind: string) => `guest-progress-${kind}-v1`;

/** Garde-fou : au-delà, on tronque plutôt que de faire gonfler le stockage. */
const MAX_ENTRIES = 5000;

/** Ids cochés pour ce kind. `valid` filtre les ids devenus inconnus après une
 *  régénération de game-data (sinon les compteurs mentent). */
export function readLocalProgress(kind: string, valid?: ReadonlySet<string>): string[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(localProgressKey(kind));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids = [...new Set(parsed.filter((x): x is string => typeof x === "string"))].slice(
      0,
      MAX_ENTRIES,
    );
    return valid ? ids.filter((id) => valid.has(id)) : ids;
  } catch {
    return [];
  }
}

export function writeLocalProgress(kind: string, ids: Iterable<string>): void {
  if (!browser) return;
  try {
    localStorage.setItem(localProgressKey(kind), JSON.stringify([...ids].slice(0, MAX_ENTRIES)));
  } catch {
    /* stockage indisponible : la session reste utilisable, sans persistance */
  }
}

/** Purge, après un import réussi vers un serveur (étape 2). */
export function clearLocalProgress(kinds: readonly string[]): void {
  if (!browser) return;
  for (const kind of kinds) {
    try {
      localStorage.removeItem(localProgressKey(kind));
    } catch {
      /* ignore */
    }
  }
}
