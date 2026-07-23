import { error } from "@sveltejs/kit";
import items from "@palworld-companion/game-data/items.json";
import type { PageServerLoadEvent } from "./$types";

export function load({ params }: PageServerLoadEvent) {
  if (!(items as Array<{ id: string }>).some((i) => i.id === params.itemId)) error(404);
  return { itemId: params.itemId };
}
