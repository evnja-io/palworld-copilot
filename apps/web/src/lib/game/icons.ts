import icons from "@palworld-companion/game-data/icons.json";

const present = icons as Record<string, boolean>;

export function palIcon(id: string): string | undefined {
  return present[`pal:${id}`] ? `/icons/pals/${id}.webp` : undefined;
}

export function itemIcon(id: string): string | undefined {
  return present[`item:${id}`] ? `/icons/items/${id}.webp` : undefined;
}

/** Icône d'un nœud de techno : le jeu réutilise l'icône de l'item produit,
 *  sinon celle de la construction (namespace `build:`, clés en minuscules
 *  car la casse du IconName ne suit pas toujours celle de la texture). */
export function techIcon(iconName: string | undefined): string | undefined {
  if (!iconName) return undefined;
  if (present[`item:${iconName}`]) return `/icons/items/${iconName}.webp`;
  const lower = iconName.toLowerCase();
  return present[`build:${lower}`] ? `/icons/build/${lower}.webp` : undefined;
}
