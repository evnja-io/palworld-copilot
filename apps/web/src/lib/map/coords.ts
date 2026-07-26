// Coordonnées et libellés dérivés des marqueurs de carte, partagés entre la
// page carte, la popup Leaflet et le nom des lignes de la barre latérale.
// Module pur : ni DOM, ni i18n, ni Svelte.

/** Coordonnées in-game affichées comme dans le jeu, à partir des pixels de la
 *  texture de carte (repère CRS.Simple : 8192px de texture = 2000 unités
 *  in-game, Y inversé). */
export function inGameCoords(px: number, py: number): [number, number] {
  return [Math.round((px / 8192) * 2000 - 1000), Math.round(1000 - (py / 8192) * 2000)];
}

/** Nom affiché d'un boss humain : ni palId (le sentinelle « None » est retiré
 *  par le pipeline) ni entrée L10N, donc dérivé de son SpawnerID, ex.
 *  `alpha_BOSS_Wandering_Merchant` -> `Wandering Merchant`. */
export function bossLabel(id: string): string {
  return id
    .replace(/^alpha_(?:BOSS_)?/i, "")
    .replaceAll("_", " ")
    .trim();
}
