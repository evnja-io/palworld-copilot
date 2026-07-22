import icons from "@palworld-companion/game-data/icons.json";

const present = icons as Record<string, boolean>;

export function palIcon(id: string): string | undefined {
  return present[`pal:${id}`] ? `/icons/pals/${id}.webp` : undefined;
}

export function itemIcon(id: string): string | undefined {
  return present[`item:${id}`] ? `/icons/items/${id}.webp` : undefined;
}
