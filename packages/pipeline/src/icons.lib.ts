/** Alias `<ns><id>` -> nom réel du .webp quand seule la casse diverge entre
 *  l'id du jeu (DT_PalMonsterParameter) et la clé de la table d'icônes.
 *  Ex. pals.json a « VolcanicMonster », le fichier est « Volcanicmonster.webp ». */
export function caseAliases(
  present: Record<string, boolean | string>,
  ns: string,
  ids: string[],
): Record<string, string> {
  const byLower = new Map<string, string>();
  for (const key of Object.keys(present)) {
    if (!key.startsWith(ns)) continue;
    const id = key.slice(ns.length);
    byLower.set(id.toLowerCase(), id);
  }
  const out: Record<string, string> = {};
  for (const id of ids) {
    if (present[ns + id]) continue;
    const target = byLower.get(id.toLowerCase());
    if (!target || target === id) continue;
    out[ns + id] = target;
  }
  return out;
}
