// Transform monde -> coordonnées in-game v1.0 (constantes de
// PalworldSaveTools/palworld_coord, variante « new » : scale 725) ; la
// texture T_WorldMap couvre exactement la plage in-game [-1000, 1000]².
// Les POI hors plage appartiennent à la carte de l'Arbre-Monde (T_TreeMap,
// hors v1 - exclus avec comptage). CALIBRÉ VISUELLEMENT en Task 4.
// Module pur : aucun effet de bord, importable par tous les transforms.
export const SIZE = 8192;
export const SCALE = 725;
export const TRANSL_X = 375247;
export const TRANSL_Y = -18;
export const RANGE = 1000;

export function worldToGame(worldX: number, worldY: number): [number, number] {
  return [(worldY - TRANSL_Y) / SCALE, (worldX + TRANSL_X) / SCALE];
}

export function worldToPixel(worldX: number, worldY: number): [number, number] | null {
  const [gx, gy] = worldToGame(worldX, worldY);
  if (Math.abs(gx) > RANGE || Math.abs(gy) > RANGE) return null; // Arbre-Monde
  const px = ((gx + RANGE) / (2 * RANGE)) * SIZE;
  const py = ((RANGE - gy) / (2 * RANGE)) * SIZE;
  return [Math.round(px * 10) / 10, Math.round(py * 10) / 10];
}

/** Rayon monde -> rayon en pixels de texture (l'échelle est isotrope). */
export function radiusToPx(worldRadius: number): number {
  return (worldRadius / SCALE / (2 * RANGE)) * SIZE;
}
