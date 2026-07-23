import { error } from "@sveltejs/kit";
import buildings from "@palworld-companion/game-data/buildings.json";
import type { PageServerLoadEvent } from "./$types";

export function load({ params }: PageServerLoadEvent) {
  if (!(buildings as Array<{ id: string }>).some((b) => b.id === params.buildingId)) error(404);
  return { buildingId: params.buildingId };
}
